import { verifyAccessToken } from "../middleware/jwt-auth.js";
import { Exam } from "../models/exam.js";

export const REALTIME_EVENTS = Object.freeze({
  RISK_UPDATED: "exam:risk-updated",
  TELEMETRY_RECORDED: "exam:telemetry-recorded",
  STATE_CHANGED: "exam:state-changed",
  CONTINUITY_UPDATED: "exam:continuity-updated",
  SUBMISSION_RECOVERED: "continuity:submission-recovered",
  SUBMISSION_RETRY: "continuity:submission-retry",
  REMEDIATION_UPDATED: "remediation:updated",
});

export function examRoom(examId) {
  return `exam:${String(examId)}`;
}

// Call only after authorization and durable persistence have succeeded.
export function emitExamEvent(io, examId, event, payload) {
  if (!Object.values(REALTIME_EVENTS).includes(event)) throw new TypeError("Unsupported realtime event");
  io.to(examRoom(examId)).emit(event, { examId: String(examId), ...payload });
}

// Room joins require an authorization adapter; no unauthenticated join handler
// is registered by default.
export function installAuthorizedRoomJoin(io, authorizeJoin) {
  if (typeof authorizeJoin !== "function") throw new TypeError("authorizeJoin adapter is required");
  io.on("connection", (socket) => {
    socket.on("exam:join", async ({ examId } = {}, acknowledge = () => {}) => {
      try {
        if (!examId || !(await authorizeJoin(socket, String(examId)))) {
          acknowledge({ ok: false, error: "Forbidden" });
          return;
        }
        await socket.join(examRoom(examId));
        acknowledge({ ok: true });
      } catch {
        acknowledge({ ok: false, error: "Unable to authorize room access" });
      }
    });
  });
}

export function installSocketSecurity(io) {
  io.use((socket, next) => {
    try {
      socket.data.user = verifyAccessToken(socket.handshake.auth?.token);
      next();
    } catch (error) {
      const failure = new Error(error.code === "AUTH_NOT_CONFIGURED" ? "Authentication is not configured" : "Unauthorized");
      failure.data = { code: error.code ?? "INVALID_TOKEN" };
      next(failure);
    }
  });
  installAuthorizedRoomJoin(io, async (socket, examId) => {
    if (!["Admin", "Examiner", "Moderator"].includes(socket.data.user?.role)) return false;
    return Boolean(await Exam.exists({ _id: examId }));
  });
}
