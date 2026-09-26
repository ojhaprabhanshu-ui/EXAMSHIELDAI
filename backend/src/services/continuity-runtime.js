export class ContinuityRuntime {
  constructor(queue) {
    this.queue = queue;
    this.sessions = new Map();
    this.activeExams = new Set();
  }

  cacheSession(session) {
    this.sessions.set(String(session.id ?? session._id), {
      id: String(session.id ?? session._id),
      examId: String(session.examId),
      studentId: String(session.studentId),
      status: session.status,
      answerRevision: session.answerRevision ?? 0,
    });
  }

  activateExam(examId) { this.activeExams.add(String(examId)); }
  deactivateExam(examId) { this.activeExams.delete(String(examId)); }

  acceptSubmission({ sessionId, studentId, submissionId, revision, payload }) {
    const session = this.sessions.get(String(sessionId));
    if (!session || session.studentId !== String(studentId) || session.status !== "ACTIVE") {
      const error = new Error("Active student session not available in continuity cache");
      error.status = 404;
      throw error;
    }
    if (!this.activeExams.has(session.examId)) {
      const error = new Error("Continuity mode is not active for this exam");
      error.status = 409;
      throw error;
    }
    const existing = this.queue.get(session.id, submissionId);
    if (existing) return { item: existing, duplicate: true };
    if (!Number.isInteger(revision) || revision <= session.answerRevision) {
      const error = new Error("Submission revision must be newer than the last accepted revision");
      error.status = 409;
      throw error;
    }
    const accepted = this.queue.enqueue({ examId: session.examId, sessionId: session.id, submissionId, revision, payload });
    session.answerRevision = Math.max(session.answerRevision, revision);
    return accepted;
  }
}
