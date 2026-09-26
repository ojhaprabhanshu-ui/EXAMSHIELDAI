import mongoose from "mongoose";
import { Exam, RecoveryItem, StudentSession } from "../models/index.js";
import { appendAuditEventInSession } from "./audit-chain.js";
import { transitionExam } from "../domain/exam-state.js";
import { emitExamEvent, REALTIME_EVENTS } from "../realtime/events.js";

export async function persistQueuedSubmission(item) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      let recovery = await RecoveryItem.findOne({ sessionId: item.sessionId, submissionId: item.submissionId }).session(session);
      if (recovery?.status === "COMPLETED") return;
      if (!recovery) {
        recovery = new RecoveryItem({
          examId: item.examId,
          sessionId: item.sessionId,
          submissionId: item.submissionId,
          revision: item.revision,
          payload: item.payload,
          status: "PROCESSING",
          attempts: item.attempts,
        });
      } else {
        recovery.status = "PROCESSING";
        recovery.attempts = item.attempts;
      }

      const studentSession = await StudentSession.findById(item.sessionId).session(session);
      if (!studentSession || studentSession.status !== "ACTIVE") throw new Error("Student session is not active");
      if (item.revision > studentSession.answerRevision) {
        studentSession.answerRevision = item.revision;
        studentSession.lastSubmission = {
          submissionId: item.submissionId,
          revision: item.revision,
          acceptedAt: new Date(),
        };
        await studentSession.save({ session });
      }
      recovery.status = "COMPLETED";
      recovery.completedAt = new Date();
      await recovery.save({ session });
      await appendAuditEventInSession({
        actorRole: "SYSTEM",
        eventType: "SUBMISSION_RECOVERED",
        entityType: "StudentSession",
        entityId: studentSession.id,
        payload: { submissionId: item.submissionId, revision: item.revision },
      }, session);
    });
  } finally {
    await session.endSession();
  }
}

export async function finalizeExamRecovery(examId, queue, io, continuity) {
  const counts = queue.counts(examId);
  if (counts.PENDING || counts.PROCESSING || counts.FAILED) return false;
  const session = await mongoose.startSession();
  let change;
  try {
    await session.withTransaction(async () => {
      const exam = await Exam.findById(examId).session(session);
      if (!exam || exam.state !== "RECOVERING") return;
      change = transitionExam(exam, "RECOVERED", { reason: "pending submissions flushed" });
      exam.continuity.enabled = false;
      exam.continuity.recoveredAt = new Date();
      exam.continuity.pendingCount = 0;
      await exam.save({ session });
      await appendAuditEventInSession({
        actorRole: "SYSTEM",
        eventType: "EXAM_RECOVERED",
        entityType: "Exam",
        entityId: exam.id,
        payload: change,
      }, session);
    });
  } finally {
    await session.endSession();
  }
  if (!change) return false;
  continuity.deactivateExam(examId);
  emitExamEvent(io, examId, REALTIME_EVENTS.STATE_CHANGED, change);
  emitExamEvent(io, examId, REALTIME_EVENTS.CONTINUITY_UPDATED, { state: "RECOVERED", enabled: false });
  return true;
}

export async function beginRecoveryForActiveExams(io) {
  const activeExams = await Exam.find({ state: "CONTINUITY_ACTIVE" }).select("_id").lean();
  for (const { _id: examId } of activeExams) {
    const session = await mongoose.startSession();
    let change;
    try {
      await session.withTransaction(async () => {
        const exam = await Exam.findById(examId).session(session);
        if (!exam || exam.state !== "CONTINUITY_ACTIVE") return;
        change = transitionExam(exam, "RECOVERING", { reason: "database connection restored" });
        await exam.save({ session });
        await appendAuditEventInSession({
          actorRole: "SYSTEM",
          eventType: "RECOVERY_STARTED",
          entityType: "Exam",
          entityId: exam.id,
          payload: change,
        }, session);
      });
    } finally {
      await session.endSession();
    }
    if (change) emitExamEvent(io, examId, REALTIME_EVENTS.STATE_CHANGED, change);
  }
}
