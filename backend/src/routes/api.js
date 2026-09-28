import { Router } from "express";
import mongoose from "mongoose";
import { Exam, AuditEvent, Telemetry, StudentSession, Student, Incident, AnalysisRun } from "../models/index.js";
import { requireDatabase, requireRole } from "../middleware/access.js";
import { transitionExam, EXAM_STATES } from "../domain/exam-state.js";
import { emitExamEvent, REALTIME_EVENTS } from "../realtime/events.js";
import { appendAuditEventInSession, verifyAuditEvents } from "../services/audit-chain.js";
import { finalizeExamRecovery } from "../services/submission-store.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { analyzeScenario } from "../services/ai-service.js";

export const apiRouter = Router();

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttemptCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, attempt] of loginAttempts) if (attempt.resetAt <= now) loginAttempts.delete(ip);
}, LOGIN_WINDOW_MS);
loginAttemptCleanup.unref?.();

const demoRequests = new Map();
const DEMO_SCENARIOS = new Set(["NORMAL", "NETWORK_DEGRADATION", "LOGIN_SPIKE", "SERVER_OVERLOAD", "DATABASE_SLOWDOWN", "POWER_OUTAGE"]);
const demoRequestCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of demoRequests) if (entry.resetAt <= now) demoRequests.delete(ip);
}, 60_000);
demoRequestCleanup.unref?.();

apiRouter.post("/ai/simulate", async (req, res, next) => {
  try {
    const scenario = req.body?.scenario;
    if (typeof scenario !== "string" || !DEMO_SCENARIOS.has(scenario)) return res.status(400).json({ error: "Unsupported simulation scenario" });
    const now = Date.now();
    const attempts = demoRequests.get(req.ip);
    if (attempts?.resetAt > now && attempts.count >= 30) return res.status(429).json({ error: "Demo simulation rate limit reached; try again shortly" });
    const current = attempts?.resetAt > now ? attempts : { count: 0, resetAt: now + 60_000 };
    current.count += 1;
    demoRequests.set(req.ip, current);

    const report = await analyzeScenario(scenario);
    let persisted = false;
    if (req.app.locals.databaseReady?.()) {
      try {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await AnalysisRun.create([{
              runId: report.id, scenario, entityCount: report.entityCount, riskScore: report.risk.score,
              status: report.risk.status, rootCause: report.rootCause.classification,
              affectedStudents: report.forensics.affectedStudents,
              estimatedDowntimeMinutes: report.forensics.estimatedDowntimeMinutes, report,
            }], { session });
            const signalRows = Object.entries(report.metrics).map(([signalType, value]) => ({
              observedAt: new Date(report.generatedAt), source: "python-telemetry-simulator", signalType,
              value, unit: signalType.endsWith("_ms") ? "ms" : signalType.endsWith("_pct") ? "%" : signalType === "power_status" ? undefined : "count",
              severity: report.risk.status === "CRITICAL" ? "CRITICAL" : report.risk.status === "AT_RISK" ? "HIGH" : "INFO",
              riskScore: report.risk.score, metadata: { runId: report.id, scenario, simulated: true },
            }));
            await Telemetry.insertMany(signalRows, { ordered: true, session });
            if (report.anomaly.detected) {
              const duration = report.forensics.estimatedRecoveryMinutes;
              await Incident.create([{
                status: "RESOLVED", severity: report.risk.status === "CRITICAL" ? "CRITICAL" : "HIGH",
                title: `${scenario.replaceAll("_", " ")} simulation`, summary: report.explanation,
                reasonCodes: [report.rootCause.classification, `SIMULATION:${report.id}`],
                openedAt: new Date(Date.now() - duration * 60_000), resolvedAt: new Date(),
              }], { session });
            }
          });
        } finally { await session.endSession(); }
        persisted = true;
      } catch (storageError) {
        console.error("AI demo persistence failed", storageError.message);
      }
    }
    return res.json({ ...report, persisted });
  } catch (error) {
    if (error.name === "AbortError") return res.status(503).json({ error: "AI analysis service timed out" });
    return next(error);
  }
});

apiRouter.get("/ai/reports", async (req, res, next) => {
  try {
    if (!req.app.locals.databaseReady?.()) return res.json({ reports: [], persisted: false });
    const reports = await AnalysisRun.find({ mode: "SIMULATED" }).sort({ createdAt: -1 }).limit(20)
      .select("runId scenario riskScore status rootCause affectedStudents estimatedDowntimeMinutes createdAt report")
      .lean();
    return res.json({ reports: reports.map((item) => ({ id: item.runId, scenario: item.scenario,
      risk: { score: item.riskScore, status: item.status }, rootCause: { classification: item.rootCause },
      forensics: item.report.forensics, generatedAt: item.createdAt })), persisted: true });
  } catch (error) { return next(error); }
});

apiRouter.post("/auth/login", requireDatabase, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password || email.length > 320 || password.length > 128) {
      return res.status(400).json({ error: "A valid email and password are required" });
    }

    const now = Date.now();
    const attempt = loginAttempts.get(req.ip);
    if (attempt && attempt.resetAt > now && attempt.count >= LOGIN_MAX_ATTEMPTS) {
      res.setHeader("Retry-After", Math.ceil((attempt.resetAt - now) / 1000));
      return res.status(429).json({ error: "Too many sign-in attempts; try again later" });
    }

    const user = await mongoose.model("User").findOne({ email, active: true }).select("+passwordHash");
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !passwordMatches) {
      const previous = attempt?.resetAt > now ? attempt : { count: 0, resetAt: now + LOGIN_WINDOW_MS };
      previous.count += 1;
      loginAttempts.set(req.ip, previous);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    loginAttempts.delete(req.ip);
    if (!config.jwtSecret || Buffer.byteLength(config.jwtSecret, "utf8") < 32) {
      return res.status(503).json({ error: "Authentication secret is not configured correctly" });
    }
    const accessToken = jwt.sign({ role: user.role }, config.jwtSecret, {
      algorithm: "HS256",
      subject: user.id,
      issuer: "examshield",
      audience: "examshield-api",
      expiresIn: "30m",
    });
    return res.json({
      accessToken,
      expiresInSeconds: 1800,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    });
  } catch (error) { return next(error); }
});

apiRouter.get("/health", (req, res) => {
  const databaseReady = req.app.locals.databaseReady();
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ready" : "degraded",
    database: databaseReady ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

apiRouter.post("/exams/:examId/sessions", requireRole("Student"), requireDatabase, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "Invalid exam id" });
    let studentSession;
    await session.withTransaction(async () => {
      const student = await Student.findOne({ _id: req.user.id, active: true }).session(session);
      if (!student) {
        const error = new Error("Active student account not found");
        error.status = 403;
        throw error;
      }
      const exam = await Exam.findById(req.params.examId).session(session);
      if (!exam || exam.status !== "ACTIVE") {
        const error = new Error("Exam is not active");
        error.status = 409;
        throw error;
      }
      const existing = await StudentSession.findOne({ examId: exam.id, studentId: req.user.id, status: "ACTIVE" }).session(session);
      studentSession = existing ?? new StudentSession({ examId: exam.id, studentId: req.user.id, expiresAt: exam.endsAt });
      if (!existing) {
        await studentSession.save({ session });
        await appendAuditEventInSession({
          actorId: req.user.id, actorRole: req.user.role,
          eventType: "STUDENT_SESSION_STARTED", entityType: "StudentSession", entityId: studentSession.id,
          payload: { examId: exam.id },
        }, session);
      }
    });
    req.app.locals.continuity?.cacheSession(studentSession);
    return res.status(201).json({ id: studentSession.id, examId: studentSession.examId, status: studentSession.status, expiresAt: studentSession.expiresAt });
  } catch (error) { return next(error); }
  finally { await session.endSession(); }
});

apiRouter.post("/student-sessions/:sessionId/submissions", requireRole("Student"), async (req, res, next) => {
  try {
    const { submissionId, revision, payload } = req.body ?? {};
    if (typeof submissionId !== "string" || !submissionId || submissionId.length > 128 || payload === undefined) {
      return res.status(400).json({ error: "submissionId and payload are required" });
    }
    const result = req.app.locals.continuity.acceptSubmission({
      sessionId: req.params.sessionId, studentId: req.user.id, submissionId, revision, payload,
    });
    emitExamEvent(req.app.locals.io, result.item.examId, REALTIME_EVENTS.CONTINUITY_UPDATED, {
      state: "CONTINUITY_ACTIVE",
      pendingCount: req.app.locals.continuity.queue.counts(result.item.examId).PENDING,
      latestSubmissionId: submissionId,
    });
    return res.status(202).json({ status: "QUEUED", duplicate: result.duplicate, submissionId, acceptedAt: result.item.createdAt });
  } catch (error) { return next(error); }
});

apiRouter.get("/continuity/queue", requireRole("Admin", "Examiner", "Moderator"), (req, res) => {
  return res.json({ counts: req.app.locals.continuity.queue.counts() });
});

apiRouter.get("/exams", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    const exams = await Exam.find({ status: { $in: ["SCHEDULED", "ACTIVE"] } })
      .select("title status startsAt endsAt state stateVersion risk continuity")
      .sort({ startsAt: 1 })
      .lean();
    return res.json({ exams });
  } catch (error) { return next(error); }
});

apiRouter.post("/exams", requireRole("Admin", "Examiner"), requireDatabase, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { title, startsAt, endsAt, durationSeconds } = req.body ?? {};
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    const duration = Number(durationSeconds);
    if (typeof title !== "string" || !title.trim() || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate || !Number.isInteger(duration) || duration < 1) {
      return res.status(400).json({ error: "title, valid startsAt/endsAt, and positive durationSeconds are required" });
    }
    let exam;
    await session.withTransaction(async () => {
      exam = new Exam({
        title: title.trim(),
        status: "SCHEDULED",
        startsAt: startDate,
        endsAt: endDate,
        durationSeconds: duration,
        createdBy: req.user.id,
        updatedBy: req.user.id,
      });
      await exam.save({ session });
      await appendAuditEventInSession({
        actorId: req.user.id,
        actorRole: req.user.role,
        eventType: "EXAM_CREATED",
        entityType: "Exam",
        entityId: exam.id,
        payload: { title: exam.title, startsAt: startDate, endsAt: endDate },
      }, session);
    });
    return res.status(201).json({ exam });
  } catch (error) { return next(error); }
  finally { await session.endSession(); }
});

apiRouter.get("/exams/:examId/dashboard", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "Invalid exam id" });
    const exam = await Exam.findById(req.params.examId).lean();
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    const [sessions, telemetry, incidents, auditEvents] = await Promise.all([
      StudentSession.find({ examId: exam._id }).sort({ lastSeenAt: -1 }).limit(500).lean(),
      Telemetry.find({ examId: exam._id }).sort({ observedAt: -1 }).limit(250).lean(),
      Incident.find({ examId: exam._id }).sort({ openedAt: -1 }).limit(100).lean(),
      AuditEvent.find({ entityType: "Exam", entityId: String(exam._id) }).sort({ sequence: -1 }).limit(100).lean(),
    ]);
    return res.json({ exam, sessions, telemetry: telemetry.reverse(), incidents: incidents.reverse(), auditEvents: auditEvents.reverse() });
  } catch (error) { return next(error); }
});

apiRouter.get("/exams/:examId", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "Invalid exam id" });
    const exam = await Exam.findById(req.params.examId).lean();
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    return res.json(exam);
  } catch (error) { return next(error); }
});

apiRouter.post("/exams/:examId/state", requireRole("Admin", "Examiner"), requireDatabase, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "Invalid exam id" });
    const { state, reason, expectedVersion } = req.body ?? {};
    if (!EXAM_STATES.includes(state)) return res.status(400).json({ error: "Invalid exam state" });
    let exam;
    let change;
    await session.withTransaction(async () => {
      exam = await Exam.findById(req.params.examId).session(session);
      if (!exam) {
        const error = new Error("Exam not found");
        error.status = 404;
        throw error;
      }
      if (expectedVersion !== undefined && exam.stateVersion !== expectedVersion) {
        const error = new Error("Exam state changed; reload before retrying");
        error.status = 409;
        error.stateVersion = exam.stateVersion;
        throw error;
      }
      if (state === "RECOVERED") {
        const counts = req.app.locals.continuity.queue.counts(exam.id);
        if (counts.PENDING || counts.PROCESSING || counts.FAILED) {
          const error = new Error("Queued submissions must flush before the exam can be marked recovered");
          error.status = 409;
          throw error;
        }
      }
      change = transitionExam(exam, state, { reason });
      if (state === "CONTINUITY_ACTIVE") {
        exam.continuity.enabled = true;
        exam.continuity.activatedAt = new Date();
      } else if (state === "RECOVERED") {
        exam.continuity.enabled = false;
        exam.continuity.recoveredAt = new Date();
      }
      await exam.save({ session });
      await appendAuditEventInSession({
        actorId: req.user.id,
        actorRole: req.user.role,
        eventType: "EXAM_STATE_CHANGED",
        entityType: "Exam",
        entityId: exam.id,
        payload: { from: change.from, to: change.to, version: change.version, reason: reason ?? null },
      }, session);
    });
    emitExamEvent(req.app.locals.io, exam.id, REALTIME_EVENTS.STATE_CHANGED, change);
    if (state === "CONTINUITY_ACTIVE" || state === "RECOVERING" || state === "RECOVERED") {
      if (state === "CONTINUITY_ACTIVE" || state === "RECOVERING") req.app.locals.continuity?.activateExam(exam.id);
      if (state === "RECOVERED") req.app.locals.continuity?.deactivateExam(exam.id);
      emitExamEvent(req.app.locals.io, exam.id, REALTIME_EVENTS.CONTINUITY_UPDATED, {
        state,
        enabled: exam.continuity.enabled,
        pendingCount: req.app.locals.continuity.queue.counts(exam.id).PENDING,
      });
    }
    if (state === "RECOVERING") {
      await finalizeExamRecovery(exam.id, req.app.locals.continuity.queue, req.app.locals.io, req.app.locals.continuity);
    }
    return res.json({ id: exam.id, state: exam.state, stateVersion: exam.stateVersion, continuity: exam.continuity });
  } catch (error) {
    if (error.stateVersion !== undefined) return res.status(409).json({ error: error.message, stateVersion: error.stateVersion });
    return next(error);
  } finally { await session.endSession(); }
});

apiRouter.post("/exams/:examId/telemetry", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "Invalid exam id" });
    const { source, signalType, value, unit, severity = "INFO", riskScore, observedAt, metadata } = req.body ?? {};
    if (typeof source !== "string" || typeof signalType !== "string") {
      return res.status(400).json({ error: "source and signalType are required" });
    }
    if (riskScore !== undefined && (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100)) {
      return res.status(400).json({ error: "riskScore must be between 0 and 100" });
    }
    const severityScores = { INFO: 0, LOW: 25, MEDIUM: 50, HIGH: 75, CRITICAL: 100 };
    if (!(severity in severityScores)) return res.status(400).json({ error: "Invalid severity" });
    let telemetry;
    let exam;
    let changes = [];
    await session.withTransaction(async () => {
      changes = [];
      exam = await Exam.findById(req.params.examId).session(session);
      if (!exam) {
        const error = new Error("Exam not found");
        error.status = 404;
        throw error;
      }
      [telemetry] = await Telemetry.create([{
        examId: req.params.examId, source, signalType, value, unit, severity, riskScore,
        observedAt: observedAt ? new Date(observedAt) : new Date(), metadata,
      }], { session });
      const score = riskScore ?? severityScores[severity];
      exam.risk.score = score;
      exam.risk.evaluatedAt = telemetry.observedAt;
      exam.risk.reasons = score >= exam.risk.threshold ? [signalType] : [];

      const transition = (nextState, reason) => {
        const change = transitionExam(exam, nextState, { reason });
        changes.push(change);
      };
      if (score >= exam.risk.threshold) {
        if (exam.state === "RECOVERED") transition("NORMAL", "risk signal returned");
        if (exam.state === "RECOVERING") {
          transition("CONTINUITY_ACTIVE", "risk returned during recovery");
          exam.continuity.enabled = true;
          exam.continuity.activatedAt = new Date();
        }
        if (exam.state === "NORMAL") transition("AT_RISK", "risk threshold crossed");
        if (score >= exam.risk.threshold && exam.state === "AT_RISK") transition("AFFECTED", "risk threshold crossed");
        if (score >= exam.risk.threshold && exam.state === "AFFECTED") {
          transition("CONTINUITY_ACTIVE", "risk threshold; continuity activated");
          exam.continuity.enabled = true;
          exam.continuity.activatedAt = new Date();
        }
      } else if (exam.state === "AT_RISK") {
        transition("NORMAL", "risk returned below threshold");
      } else if (exam.state === "AFFECTED" || exam.state === "CONTINUITY_ACTIVE") {
        transition("RECOVERING", "risk returned below threshold; flushing queued submissions");
      }
      await exam.save({ session });
      await appendAuditEventInSession({
        actorId: req.user.id,
        actorRole: req.user.role,
        eventType: "TELEMETRY_RECORDED",
        entityType: "Exam",
        entityId: exam.id,
        payload: { telemetryId: telemetry.id, signalType, severity: telemetry.severity, riskScore: score },
      }, session);
      for (const change of changes) {
        await appendAuditEventInSession({
          actorId: req.user.id,
          actorRole: req.user.role,
          eventType: "EXAM_STATE_CHANGED",
          entityType: "Exam",
          entityId: exam.id,
          payload: change,
        }, session);
      }
    });
    for (const change of changes) {
      emitExamEvent(req.app.locals.io, exam.id, REALTIME_EVENTS.STATE_CHANGED, change);
      if (change.to === "CONTINUITY_ACTIVE") {
        req.app.locals.continuity?.activateExam(exam.id);
      }
      if (change.to === "RECOVERED") req.app.locals.continuity?.deactivateExam(exam.id);
      if (["CONTINUITY_ACTIVE", "RECOVERING", "RECOVERED"].includes(change.to)) {
        emitExamEvent(req.app.locals.io, exam.id, REALTIME_EVENTS.CONTINUITY_UPDATED, {
          state: change.to,
          enabled: change.to !== "RECOVERED",
          pendingCount: req.app.locals.continuity.queue.counts(exam.id).PENDING,
        });
      }
    }
    emitExamEvent(req.app.locals.io, req.params.examId, REALTIME_EVENTS.RISK_UPDATED, {
      telemetryId: telemetry.id, signalType, severity: telemetry.severity, riskScore: exam.risk.score, observedAt: telemetry.observedAt,
    });
    if (exam.state === "RECOVERING") {
      await finalizeExamRecovery(exam.id, req.app.locals.continuity.queue, req.app.locals.io, req.app.locals.continuity);
    }
    return res.status(201).json({ id: telemetry.id, receivedAt: telemetry.receivedAt });
  } catch (error) { return next(error); }
  finally { await session.endSession(); }
});

apiRouter.get("/audit/verify", requireRole("Admin", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    const stream = String(req.query.stream ?? "platform");
    const events = await AuditEvent.find({ stream }).sort({ sequence: 1 }).lean();
    return res.json({ stream, count: events.length, ...verifyAuditEvents(events) });
  } catch (error) { return next(error); }
});

apiRouter.get("/exams/:examId/sessions", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "Invalid exam id" });
    const sessions = await StudentSession.find({ examId: req.params.examId }).select("status startedAt lastSeenAt answerRevision continuity").lean();
    return res.json({ sessions });
  } catch (error) { return next(error); }
});
