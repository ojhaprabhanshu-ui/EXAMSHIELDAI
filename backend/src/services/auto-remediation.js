import { randomUUID } from "node:crypto";

// This registry is the only set of operations remediation may invoke. It never
// accepts commands, executable names, URLs, or action names from an LLM.
export const REMEDIATION_PLAYBOOKS = Object.freeze({
  NETWORK_CONGESTION: Object.freeze([
    "ACTIVATE_CONTINUITY", "QUEUE_SUBMISSIONS", "ENABLE_RETRY",
    "MONITOR_NETWORK", "VERIFY_HEALTH", "RESTORE_NORMAL",
  ]),
  SERVER_OVERLOAD: Object.freeze([
    "PRIORITIZE_EXAM_TRAFFIC", "THROTTLE_NON_CRITICAL_OPERATIONS",
    "ACTIVATE_CONTINUITY", "MONITOR_SERVER", "VERIFY_HEALTH", "RESTORE_NORMAL",
  ]),
  DATABASE_SLOWDOWN: Object.freeze([
    "QUEUE_SUBMISSIONS", "PAUSE_NON_CRITICAL_WRITES", "RUN_RECOVERY_WORKER",
    "MONITOR_DATABASE", "VERIFY_HEALTH", "RESTORE_NORMAL",
  ]),
  AUTHENTICATION_FAILURE: Object.freeze([
    "RETRY_AUTH_VALIDATION", "PROTECT_ACTIVE_SESSIONS", "MONITOR_AUTH_SERVICE",
    "VERIFY_HEALTH", "RESTORE_NORMAL", "ESCALATE_IF_UNRESOLVED",
  ]),
  POWER_FAILURE: Object.freeze([
    "ACTIVATE_CONTINUITY", "QUEUE_SUBMISSIONS", "ENABLE_RETRY",
    "MONITOR_NETWORK", "VERIFY_HEALTH", "RESTORE_NORMAL",
  ]),
});

const CAUSE_ALIASES = Object.freeze({
  "NETWORK DEGRADATION": "NETWORK_CONGESTION",
  "NETWORK CONGESTION": "NETWORK_CONGESTION",
  "SERVER OVERLOAD": "SERVER_OVERLOAD",
  "DATABASE SLOWDOWN": "DATABASE_SLOWDOWN",
  "AUTHENTICATION SURGE": "AUTHENTICATION_FAILURE",
  "AUTHENTICATION FAILURE": "AUTHENTICATION_FAILURE",
  "POWER LOSS AT AN EXAM CENTER": "POWER_FAILURE",
  "POWER FAILURE": "POWER_FAILURE",
});

export function normalizeRemediationCause(cause) {
  const key = String(cause ?? "").trim().toUpperCase().replaceAll("_", " ");
  return CAUSE_ALIASES[key] ?? null;
}

const ACTION_EVENTS = Object.freeze({
  ACTIVATE_CONTINUITY: "CONTINUITY_ACTIVATED",
  QUEUE_SUBMISSIONS: "REMEDIATION_ACTION_EXECUTED",
  ENABLE_RETRY: "REMEDIATION_ACTION_EXECUTED",
  PRIORITIZE_EXAM_TRAFFIC: "REMEDIATION_ACTION_EXECUTED",
  THROTTLE_NON_CRITICAL_OPERATIONS: "REMEDIATION_ACTION_EXECUTED",
  PAUSE_NON_CRITICAL_WRITES: "REMEDIATION_ACTION_EXECUTED",
  RUN_RECOVERY_WORKER: "REMEDIATION_ACTION_EXECUTED",
  RETRY_AUTH_VALIDATION: "REMEDIATION_ACTION_EXECUTED",
  PROTECT_ACTIVE_SESSIONS: "REMEDIATION_ACTION_EXECUTED",
  MONITOR_NETWORK: "REMEDIATION_ACTION_EXECUTED",
  MONITOR_SERVER: "REMEDIATION_ACTION_EXECUTED",
  MONITOR_DATABASE: "REMEDIATION_ACTION_EXECUTED",
  MONITOR_AUTH_SERVICE: "REMEDIATION_ACTION_EXECUTED",
  RESTORE_NORMAL: "REMEDIATION_ACTION_EXECUTED",
});

export class AutoRemediationEngine {
  constructor({ persist, audit, executeAction, verifyHealth, rollback = async () => "No external infrastructure mutations were made", emit = () => {}, now = () => new Date() }) {
    if (![persist, audit, executeAction, verifyHealth, rollback].every((value) => typeof value === "function")) {
      throw new TypeError("persist, audit, executeAction, verifyHealth, and rollback adapters are required");
    }
    this.persist = persist;
    this.audit = audit;
    this.executeAction = executeAction;
    this.verifyHealth = verifyHealth;
    this.rollback = rollback;
    this.emit = emit;
    this.now = now;
  }

  async run({ examId, incidentId = null, cause, confidence = 0, evidence = [], metricsBefore = {}, simulation = false }) {
    const playbookKey = normalizeRemediationCause(cause);
    if (!playbookKey) throw Object.assign(new Error("No approved remediation playbook exists for this diagnosis"), { status: 422 });
    const id = randomUUID();
    const run = {
      runId: id, examId: String(examId), incidentId, cause: playbookKey,
      probableCause: cause, confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
      evidence: Array.isArray(evidence) ? evidence.slice(0, 8).map(String) : [],
      state: "DETECTED", status: "RUNNING", actions: [], metricsBefore,
      metricsAfter: {}, pendingSubmissions: 0, simulation,
      startedAt: this.now(), updatedAt: this.now(),
    };
    await this.persist(run);
    await this.#record(run, "REMEDIATION_STARTED", { playbook: playbookKey });

    try {
      run.state = "DIAGNOSING";
      await this.#save(run);
      run.state = "REMEDIATING";
      await this.#save(run);

      for (const action of REMEDIATION_PLAYBOOKS[playbookKey]) {
        if (action === "VERIFY_HEALTH") {
          run.state = "VERIFYING";
          await this.#save(run);
          await this.#record(run, "HEALTH_CHECK_STARTED", { action });
          const check = await this.verifyHealth({ run, simulation });
          run.metricsAfter = check.metrics ?? {};
          run.pendingSubmissions = check.pendingSubmissions ?? 0;
          run.healthCheck = { healthy: Boolean(check.healthy), checkedAt: this.now(), detail: check.detail ?? null };
          run.actions.push({ name: action, status: check.healthy ? "COMPLETED" : "FAILED", completedAt: this.now(), details: check.detail ?? "Health verification completed" });
          if (!check.healthy) throw new Error(check.detail || "Health verification did not pass");
          await this.#record(run, "REMEDIATION_ACTION_EXECUTED", { action, result: run.healthCheck });
          continue;
        }
        if (action === "ESCALATE_IF_UNRESOLVED") continue;
        const entry = { name: action, status: "RUNNING", startedAt: this.now() };
        run.actions.push(entry);
        await this.#record(run, "REMEDIATION_ACTION_STARTED", { action });
        try {
          const result = await this.executeAction(action, { run, examId: run.examId, simulation });
          entry.status = "COMPLETED";
          entry.completedAt = this.now();
          entry.details = result?.details ?? "Approved backend action completed";
          if (result?.pendingSubmissions !== undefined) run.pendingSubmissions = result.pendingSubmissions;
          await this.#record(run, ACTION_EVENTS[action] ?? "REMEDIATION_ACTION_EXECUTED", { action, details: entry.details });
        } catch (error) {
          entry.status = "FAILED";
          entry.completedAt = this.now();
          entry.details = error.message;
          await this.#record(run, "REMEDIATION_ACTION_EXECUTED", { action, failed: true, error: error.message });
          throw error;
        }
        await this.#save(run);
      }

      run.state = "RECOVERED";
      run.status = "SUCCEEDED";
      run.completedAt = this.now();
      await this.#record(run, "REMEDIATION_SUCCESS", { healthCheck: run.healthCheck, pendingSubmissions: run.pendingSubmissions });
      await this.#save(run);
    } catch (error) {
      run.state = "ESCALATED";
      run.status = "FAILED";
      run.failureReason = error.message;
      run.completedAt = this.now();
      let rollbackResult;
      try { rollbackResult = await this.rollback({ run, error }); }
      catch (rollbackError) { rollbackResult = `Rollback cleanup failed: ${rollbackError.message}`; }
      await this.#record(run, "REMEDIATION_ROLLED_BACK", { details: rollbackResult, continuityRemainsActive: true });
      await this.#record(run, "REMEDIATION_FAILED", { error: error.message });
      await this.#record(run, "ADMIN_ESCALATION", { reason: error.message, rollback: rollbackResult });
      await this.#save(run);
    }
    this.emit(run);
    return run;
  }

  async #save(run) { run.updatedAt = this.now(); await this.persist(run); this.emit(run); }
  async #record(run, eventType, payload) {
    await this.audit({ eventType, examId: run.examId, incidentId: run.incidentId, remediationId: run.runId, payload });
    await this.#save(run);
  }
}
