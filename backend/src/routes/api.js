import { Router } from "express";
import mongoose from "mongoose";
import { Exam, AuditEvent, Telemetry, StudentSession, Student, Incident, AnalysisRun, RemediationRun, RecoveryItem } from "../models/index.js";
import { requireDatabase, requireRole } from "../middleware/access.js";
import { transitionExam, EXAM_STATES } from "../domain/exam-state.js";
import { emitExamEvent, REALTIME_EVENTS } from "../realtime/events.js";
import { appendAuditEventAtomically, appendAuditEventInSession, verifyAuditEvents } from "../services/audit-chain.js";
import { finalizeExamRecovery } from "../services/submission-store.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { analyzeScenario } from "../services/ai-service.js";
import { AutoRemediationEngine, normalizeRemediationCause } from "../services/auto-remediation.js";

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
    const [sessions, telemetry, incidents, auditEvents, recoveryItems] = await Promise.all([
      StudentSession.find({ examId: exam._id }).sort({ lastSeenAt: -1 }).limit(500).lean(),
      Telemetry.find({ examId: exam._id }).sort({ observedAt: -1 }).limit(250).lean(),
      Incident.find({ examId: exam._id }).sort({ openedAt: -1 }).limit(100).lean(),
      AuditEvent.find({ entityType: "Exam", entityId: String(exam._id) }).sort({ sequence: -1 }).limit(100).lean(),
      RecoveryItem.find({ examId: exam._id }).select("sessionId status").lean(),
    ]);
    const recoveryBySession = {};
    for (const item of recoveryItems) {
      const key = String(item.sessionId);
      const status = item.status.toLowerCase();
      recoveryBySession[key] ??= { pending: 0, processing: 0, recovered: 0, failed: 0 };
      recoveryBySession[key][status] += 1;
    }
    for (const item of sessions) {
      const key = String(item._id);
      recoveryBySession[key] ??= { pending: 0, processing: 0, recovered: 0, failed: 0 };
      const counts = req.app.locals.continuity.queue.counts(exam.id, key);
      recoveryBySession[key].pending += counts.PENDING;
      recoveryBySession[key].processing += counts.PROCESSING;
      recoveryBySession[key].recovered += counts.COMPLETED;
      recoveryBySession[key].failed += counts.FAILED;
    }
    return res.json({ exam, sessions, telemetry: telemetry.reverse(), incidents: incidents.reverse(), auditEvents: auditEvents.reverse(), recoveryBySession });
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

apiRouter.get("/exams/:examId/remediation/latest", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "Invalid exam id" });
    const remediation = await RemediationRun.findOne({ examId: req.params.examId }).sort({ startedAt: -1 }).lean();
    const counts = req.app.locals.continuity.queue.counts(req.params.examId);
    return res.json({ remediation, pendingSubmissions: counts.PENDING, processingSubmissions: counts.PROCESSING, recoveredSubmissions: counts.COMPLETED });
  } catch (error) { return next(error); }
});

apiRouter.post("/exams/:examId/remediation", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.examId)) return res.status(400).json({ error: "Invalid exam id" });
    const { cause, confidence, evidence, metricsBefore, simulationRunId } = req.body ?? {};
    const playbook = normalizeRemediationCause(cause);
    if (!playbook) return res.status(422).json({ error: "No approved playbook matches the supplied diagnosis" });
    const simulationRecord = typeof simulationRunId === "string"
      ? await AnalysisRun.findOne({ runId: simulationRunId, mode: "SIMULATED" }).select("rootCause").lean()
      : null;
    const simulation = Boolean(simulationRecord && normalizeRemediationCause(simulationRecord.rootCause) === playbook);
    if (confidence !== undefined && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) return res.status(400).json({ error: "confidence must be between 0 and 1" });
    if (evidence !== undefined && (!Array.isArray(evidence) || evidence.length > 8 || evidence.some((item) => typeof item !== "string" || item.length > 500))) return res.status(400).json({ error: "evidence must be an array of at most 8 short strings" });
    const examExists = await Exam.exists({ _id: req.params.examId });
    if (!examExists) return res.status(404).json({ error: "Exam not found" });
    const inProgress = await RemediationRun.exists({ examId: req.params.examId, state: { $in: ["DETECTED", "DIAGNOSING", "REMEDIATING", "VERIFYING"] } });
    if (inProgress) return res.status(409).json({ error: "A remediation playbook is already running for this exam" });
    const controls = req.app.locals.remediationControls ??= new Map();
    const queue = req.app.locals.continuity.queue;
    const io = req.app.locals.io;
    const engine = new AutoRemediationEngine({
      persist: (run) => RemediationRun.findOneAndUpdate({ runId: run.runId }, { $set: run }, { upsert: true, new: true, setDefaultsOnInsert: true }),
      audit: ({ eventType, examId, incidentId, remediationId, payload }) => appendAuditEventAtomically({
        actorRole: "SYSTEM", eventType, entityType: "RemediationRun", entityId: remediationId,
        incidentId, payload: { examId, ...payload },
      }),
      emit: (run) => emitExamEvent(io, run.examId, REALTIME_EVENTS.REMEDIATION_UPDATED, { remediation: run }),
      executeAction: async (action, { examId, simulation: isSimulation }) => {
        const pendingSubmissions = queue.counts(examId).PENDING;
        if (action === "ACTIVATE_CONTINUITY") {
          req.app.locals.continuity.activateExam(examId);
          await Exam.updateOne({ _id: examId }, { $set: { "continuity.enabled": true, "continuity.activatedAt": new Date() } });
          await StudentSession.updateMany({ examId, status: "ACTIVE" }, { $set: { "continuity.active": true, "continuity.activatedAt": new Date() } });
          return { details: "Continuity runtime enabled; active student sessions remain active", pendingSubmissions };
        }
        if (action === "QUEUE_SUBMISSIONS") return { details: `Continuity submission queue is ready (${pendingSubmissions} pending)`, pendingSubmissions };
        if (action === "ENABLE_RETRY") {
          req.app.locals.recoveryWorker?.start();
          return { details: "Bounded recovery retry worker enabled", pendingSubmissions };
        }
        if (action === "RUN_RECOVERY_WORKER") {
          await req.app.locals.recoveryWorker?.drain();
          return { details: "Recovery worker drained all currently due submissions", pendingSubmissions: queue.counts(examId).PENDING };
        }
        if (["PRIORITIZE_EXAM_TRAFFIC", "THROTTLE_NON_CRITICAL_OPERATIONS", "PAUSE_NON_CRITICAL_WRITES", "RETRY_AUTH_VALIDATION", "PROTECT_ACTIVE_SESSIONS"].includes(action)) {
          controls.set(`${examId}:${action}`, { enabled: true, at: new Date() });
          if (action === "PROTECT_ACTIVE_SESSIONS") await StudentSession.updateMany({ examId, status: "ACTIVE" }, { $set: { "continuity.active": true } });
          const details = action === "PRIORITIZE_EXAM_TRAFFIC" || action === "THROTTLE_NON_CRITICAL_OPERATIONS" || action === "PAUSE_NON_CRITICAL_WRITES"
            ? "ExamShield application policy flag set; no external infrastructure commands were issued"
            : "Approved authentication/session protection policy enabled";
          return { details, pendingSubmissions };
        }
        if (action.startsWith("MONITOR_")) {
          const latest = await Telemetry.findOne({ examId }).sort({ observedAt: -1 }).lean();
          return { details: latest ? `Latest backend telemetry observed at ${latest.observedAt.toISOString()}` : "Waiting for backend telemetry" };
        }
        if (action === "RESTORE_NORMAL") {
          const session = await mongoose.startSession();
          let change;
          try {
            await session.withTransaction(async () => {
              const exam = await Exam.findById(examId).session(session);
              if (exam && ["CONTINUITY_ACTIVE", "AFFECTED"].includes(exam.state)) {
                change = transitionExam(exam, "RECOVERING", { reason: "approved remediation passed health verification" });
                exam.risk.score = 0;
                exam.risk.reasons = [];
                exam.continuity.pendingCount = pendingSubmissions;
                await exam.save({ session });
                await appendAuditEventInSession({ actorRole: "SYSTEM", eventType: "EXAM_STATE_CHANGED", entityType: "Exam", entityId: exam.id, payload: change }, session);
              }
            });
          } finally { await session.endSession(); }
          if (change) emitExamEvent(io, examId, REALTIME_EVENTS.STATE_CHANGED, change);
          await req.app.locals.recoveryWorker?.drain();
          const recovered = await finalizeExamRecovery(examId, queue, io, req.app.locals.continuity);
          if (recovered) await StudentSession.updateMany({ examId, status: "ACTIVE" }, { $set: { "continuity.active": false } });
          return { details: isSimulation ? "Scenario restored to healthy baseline after verification" : "Recovery transition started after health verification", pendingSubmissions: queue.counts(examId).PENDING };
        }
        throw Object.assign(new Error(`Action ${action} is not implemented by the safe executor`), { status: 500 });
      },
      rollback: async ({ run }) => {
        for (const action of ["PRIORITIZE_EXAM_TRAFFIC", "THROTTLE_NON_CRITICAL_OPERATIONS", "PAUSE_NON_CRITICAL_WRITES", "RETRY_AUTH_VALIDATION"]) {
          controls.delete(`${run.examId}:${action}`);
        }
        return "Temporary policy flags cleared; continuity and active-session protection remain enabled";
      },
      verifyHealth: async ({ simulation: isSimulation }) => {
        const queueCounts = queue.counts(req.params.examId);
        const pendingSubmissions = queueCounts.PENDING + queueCounts.PROCESSING + queueCounts.FAILED;
        const metricsAfter = isSimulation ? {
          latency_ms: 48, packet_loss_pct: 0.35, cpu_pct: 48, memory_pct: 51,
          db_response_ms: 28, availability_pct: 99.9, login_failures: 8,
          submission_failures: 3, concurrent_users: 970,
        } : {};
        const rows = isSimulation ? [] : await Telemetry.find({ examId: req.params.examId }).sort({ observedAt: -1 }).limit(200).lean();
        if (!isSimulation) {
          for (const row of rows) if (metricsAfter[row.signalType] === undefined) metricsAfter[row.signalType] = row.value;
        }
        const withinThresholds = Number(metricsAfter.latency_ms) <= 150
          && Number(metricsAfter.packet_loss_pct) <= 2
          && Number(metricsAfter.cpu_pct) <= 80
          && Number(metricsAfter.memory_pct) <= 82
          && Number(metricsAfter.db_response_ms) <= 500
          && Number(metricsAfter.availability_pct) >= 90
          && Number(metricsAfter.login_failures) < 60
          && Number(metricsAfter.submission_failures) < 60;
        const healthy = pendingSubmissions === 0 && (isSimulation || (rows.length > 0 && withinThresholds));
        return { healthy, pendingSubmissions, metrics: metricsAfter, detail: healthy ? "Infrastructure indicators are within recovery thresholds and the queue is clear" : "Health could not be verified; queued work or elevated telemetry remains" };
      },
    });
    const remediation = await engine.run({ examId: req.params.examId, cause, confidence, evidence, metricsBefore: metricsBefore ?? {}, simulation });
    return res.json({ remediation });
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
    const { source, signalType, value, unit, severity = "INFO", riskScore, observedAt, metadata, sessionId } = req.body ?? {};
    if (typeof source !== "string" || typeof signalType !== "string") {
      return res.status(400).json({ error: "source and signalType are required" });
    }
    if (riskScore !== undefined && (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100)) {
      return res.status(400).json({ error: "riskScore must be between 0 and 100" });
    }
    if (sessionId !== undefined && (!mongoose.isValidObjectId(sessionId) || !await StudentSession.exists({ _id: sessionId, examId: req.params.examId }))) return res.status(400).json({ error: "sessionId must identify a session belonging to this exam" });
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
        examId: req.params.examId, sessionId, source, signalType, value, unit, severity, riskScore,
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
        payload: { telemetryId: telemetry.id, sessionId: sessionId ?? null, signalType, severity: telemetry.severity, riskScore: score },
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
      telemetryId: telemetry.id, sessionId: sessionId ?? null, signalType, severity: telemetry.severity, riskScore: exam.risk.score, observedAt: telemetry.observedAt,
    });
    emitExamEvent(req.app.locals.io, req.params.examId, REALTIME_EVENTS.TELEMETRY_RECORDED, {
      telemetryId: telemetry.id, sessionId: sessionId ?? null, signalType, value, unit, riskScore: exam.risk.score, observedAt: telemetry.observedAt,
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

apiRouter.get("/exams/:examId/sessions/:sessionId/telemetry", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    const { examId, sessionId } = req.params;
    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(sessionId)) return res.status(400).json({ error: "Invalid exam or session id" });
    if (!await StudentSession.exists({ _id: sessionId, examId })) return res.status(404).json({ error: "Session not found for this exam" });
    const telemetry = await Telemetry.find({ examId, sessionId }).sort({ observedAt: -1 }).limit(120).lean();
    return res.json({ sessionId, telemetry: telemetry.reverse() });
  } catch (error) { return next(error); }
});

apiRouter.get("/exams/:examId/sessions/:sessionId/analysis", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    const { examId, sessionId } = req.params;
    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(sessionId)) return res.status(400).json({ error: "Invalid exam or session id" });
    if (!await StudentSession.exists({ _id: sessionId, examId })) return res.status(404).json({ error: "Session not found for this exam" });
    const latest = await Telemetry.findOne({ examId, sessionId, "metadata.aiAnalysis": { $exists: true } }).sort({ observedAt: -1 }).lean();
    return res.json({ sessionId, analysis: latest?.metadata?.aiAnalysis ?? null, observedAt: latest?.observedAt ?? null });
  } catch (error) { return next(error); }
});

apiRouter.get("/exams/:examId/sessions/:sessionId/incidents", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    const { examId, sessionId } = req.params;
    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(sessionId)) return res.status(400).json({ error: "Invalid exam or session id" });
    if (!await StudentSession.exists({ _id: sessionId, examId })) return res.status(404).json({ error: "Session not found for this exam" });
    const incidents = await Incident.find({ examId, reasonCodes: { $in: [sessionId, `SESSION:${sessionId}`] } }).sort({ openedAt: -1 }).limit(50).lean();
    return res.json({ sessionId, incidents });
  } catch (error) { return next(error); }
});

apiRouter.get("/exams/:examId/sessions/:sessionId", requireRole("Admin", "Examiner", "Moderator"), requireDatabase, async (req, res, next) => {
  try {
    const { examId, sessionId } = req.params;
    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(sessionId)) return res.status(400).json({ error: "Invalid exam or session id" });
    const session = await StudentSession.findOne({ _id: sessionId, examId }).lean();
    if (!session) return res.status(404).json({ error: "Session not found for this exam" });
    const [telemetry, incidents, auditEvents, recoveryItems, liveCounts] = await Promise.all([
      Telemetry.find({ examId, sessionId }).sort({ observedAt: -1 }).limit(120).lean(),
      Incident.find({ examId, reasonCodes: { $in: [sessionId, `SESSION:${sessionId}`] } }).sort({ openedAt: -1 }).limit(50).lean(),
      AuditEvent.find({ $or: [{ entityType: "StudentSession", entityId: sessionId }, { entityType: "Exam", entityId: examId, "payload.sessionId": sessionId }] }).sort({ sequence: -1 }).limit(100).lean(),
      RecoveryItem.find({ examId, sessionId }).select("status").lean(),
      Promise.resolve(req.app.locals.continuity.queue.counts(examId, sessionId)),
    ]);
    const recovery = recoveryItems.reduce((counts, item) => { counts[item.status.toLowerCase()] = (counts[item.status.toLowerCase()] || 0) + 1; return counts; }, { pending: 0, processing: 0, recovered: 0, failed: 0 });
    recovery.pending += liveCounts.PENDING;
    recovery.processing += liveCounts.PROCESSING;
    recovery.recovered += liveCounts.COMPLETED;
    recovery.failed += liveCounts.FAILED;
    const events = [
      ...auditEvents.map((item) => ({ id: String(item._id), timestamp: item.occurredAt, type: item.eventType, message: item.eventType.replaceAll("_", " ") })),
      ...telemetry.map((item) => ({ id: String(item._id), timestamp: item.observedAt, type: "TELEMETRY_UPDATED", message: `${item.signalType}: ${item.value}${item.unit ? ` ${item.unit}` : ""}` })),
      ...incidents.map((item) => ({ id: String(item._id), timestamp: item.openedAt, type: "INCIDENT_UPDATED", message: item.summary || item.title })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return res.json({ session, telemetry: telemetry.reverse(), analysis: telemetry.find((item) => item.metadata?.aiAnalysis)?.metadata.aiAnalysis ?? null, incidents, recovery, events });
  } catch (error) { return next(error); }
});
