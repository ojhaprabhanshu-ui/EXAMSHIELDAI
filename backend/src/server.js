import "dotenv/config";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDatabase } from "./services/database.js";
import { ContinuityQueue } from "./services/continuity-queue.js";
import { ContinuityRuntime } from "./services/continuity-runtime.js";
import { emitExamEvent, installSocketSecurity } from "./realtime/events.js";
import { isAllowedOrigin } from "./middleware/cors.js";
import { config } from "./config.js";
import { Exam, StudentSession } from "./models/index.js";
import { RecoveryWorker } from "./services/recovery-worker.js";
import { persistQueuedSubmission, finalizeExamRecovery, beginRecoveryForActiveExams } from "./services/submission-store.js";

const port = config.port;

const queue = new ContinuityQueue();
const continuity = new ContinuityRuntime(queue);

const recoveryWorker = new RecoveryWorker({
  queue,
  submit: persistQueuedSubmission,
  emit: (event, item) => emitExamEvent(io, item.examId, event, {
    submissionId: item.submissionId,
    status: item.status,
    pendingCount: queue.counts(item.examId).PENDING,
  }),
  afterComplete: async (item) => {
    await finalizeExamRecovery(item.examId, queue, io, continuity);
  },
});

// Initialize Express App first
const app = createApp({ io: null, continuity });

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  transports: ["websocket", "polling"],
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
  },
});

// Attach io instance to Express app locals
app.locals.io = io;

installSocketSecurity(io);

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[Backend Error] Port ${port} is already in use by another process.`);
    console.error(`Please terminate the process using port ${port} or set a different PORT environment variable.`);
  } else {
    console.error("[Backend Error]", err);
  }
  process.exit(1);
});

httpServer.listen(port, () => {
  console.log(`ExamShield backend listening on port ${port}.`);
});

const shutdownController = new AbortController();
void connectDatabase(config.mongoUri, {
  signal: shutdownController.signal,
  onConnected: async () => {
    const liveSessions = await StudentSession.find({ status: "ACTIVE" }).select("examId studentId status answerRevision").lean();
    for (const session of liveSessions) continuity.cacheSession(session);
    const activeExams = await Exam.find({ state: { $in: ["CONTINUITY_ACTIVE", "RECOVERING"] } }).select("_id").lean();
    for (const exam of activeExams) {
      continuity.activateExam(exam._id);
      await Exam.updateOne({ _id: exam._id }, { $set: { "continuity.pendingCount": queue.counts(exam._id).PENDING } });
    }
    await beginRecoveryForActiveExams(io);
    recoveryWorker.start();
    await recoveryWorker.drain();
    const recoveringExams = await Exam.find({ state: "RECOVERING" }).select("_id").lean();
    for (const exam of recoveringExams) await finalizeExamRecovery(exam._id, queue, io, continuity);
    app.locals.setDatabaseReady(true);
  },
  onDisconnected: () => {
    app.locals.setDatabaseReady(false);
    recoveryWorker.stop();
  },
});

async function shutdown(signal) {
  console.log(`${signal}: shutting down backend`);
  shutdownController.abort();
  await mongoose.disconnect();
  io.close(() => httpServer.close(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
