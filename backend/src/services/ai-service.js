import { config } from "../config.js";
import { SCENARIO_PRESETS, BASELINE_SESSIONS } from "../../../frontend/src/data/mockExamData.js";

const fallbackHistory = new Map();
const CAUSES = {
  NORMAL: "No significant incident",
  NETWORK_DEGRADATION: "Network degradation",
  LOGIN_SPIKE: "Authentication surge",
  SERVER_OVERLOAD: "Server overload",
  DATABASE_SLOWDOWN: "Database slowdown",
  POWER_OUTAGE: "Power loss at an exam center",
};
const ACTIONS = {
  "No significant incident": ["Continue monitoring network and submission health."],
  "Network degradation": ["Route affected centers through a secondary ISP path.", "Buffer and retry submissions with idempotency keys."],
  "Authentication surge": ["Rate-limit retries and spread login traffic with admission control.", "Scale authentication workers and inspect identity-provider latency."],
  "Server overload": ["Scale application workers and shed non-essential telemetry load.", "Check CPU throttling and memory pressure."],
  "Database slowdown": ["Inspect connection-pool saturation, slow queries, and write locks.", "Keep submissions queued until database writes recover."],
  "Power loss at an exam center": ["Switch the center to UPS or generator power and confirm its power telemetry.", "Keep encrypted local submission buffers and synchronize when connectivity returns."],
};

function fallbackAnalysis(scenario) {
  const preset = SCENARIO_PRESETS[scenario] || SCENARIO_PRESETS.NORMAL;
  const source = preset.infrastructure;
  const powerOutage = scenario === "POWER_OUTAGE";
  const metrics = {
    latency_ms: powerOutage ? 520 : source.latency,
    packet_loss_pct: powerOutage ? 16 : source.packetLoss,
    login_failures: powerOutage ? 190 : source.loginFailures,
    submission_failures: powerOutage ? 260 : source.submissionFailures,
    cpu_pct: source.cpu, memory_pct: source.memory,
    db_response_ms: powerOutage ? 290 : source.dbResponseTime,
    concurrent_users: powerOutage ? 710 : source.concurrentUsers,
    availability_pct: powerOutage ? 76 : Math.max(76, 100 - (preset.riskScore || 0) / 5),
    registered_students: 1000, active_students: powerOutage ? 710 : 1000,
    power_status: powerOutage ? "OUTAGE" : "STABLE",
  };
  const previous = fallbackHistory.get(scenario) || [];
  const score = preset.riskScore ?? 24;
  const riskHistory = [...previous, score].slice(-6);
  fallbackHistory.set(scenario, riskHistory);
  const status = score >= 75 ? "CRITICAL" : score >= 45 ? "AT_RISK" : "NORMAL";
  const rootCause = CAUSES[scenario] || "No significant incident";
  const causeEvidence = scenario === "NETWORK_DEGRADATION" ? [`Latency is ${metrics.latency_ms} ms`, `Packet loss is ${metrics.packet_loss_pct}%`]
    : scenario === "POWER_OUTAGE" ? [`Availability is ${metrics.availability_pct}%`, "Power state: OUTAGE"]
      : scenario === "SERVER_OVERLOAD" ? [`CPU is ${metrics.cpu_pct}%`, `Memory is ${metrics.memory_pct}%`]
        : scenario === "DATABASE_SLOWDOWN" ? [`Database response is ${metrics.db_response_ms} ms`, `Submission failures: ${metrics.submission_failures}`]
          : scenario === "LOGIN_SPIKE" ? [`Login failures: ${metrics.login_failures}`, `Concurrent users: ${metrics.concurrent_users}`]
            : ["Signals remain inside the configured baseline envelope."];
  const affected = powerOutage ? 340 : (preset.affectedStudents || 0);
  const recommendations = ACTIONS[rootCause];
  const recommendedAction = rootCause === "No significant incident" ? "MONITOR"
    : rootCause === "Authentication surge" ? "AUTH_RECOVERY" : "ACTIVATE_CONTINUITY";
  const centers = (preset.sessions || BASELINE_SESSIONS).slice(0, 8).map((session, index) => ({
    name: String(session.center || BASELINE_SESSIONS[index]?.center || `Center ${index + 1}`).replace(/ Center$/, ""),
    students: session.students || 125,
    affected: Math.round((session.students || 125) * (session.status === "AFFECTED" ? .55 : session.status === "AT_RISK" ? .16 : affected / 1000)),
    status: session.status || "NORMAL", latency_ms: session.latency || metrics.latency_ms,
  }));
  const generatedAt = new Date().toISOString();
  const explanation = `${rootCause} is the strongest match for the ${scenario.replaceAll("_", " ").toLowerCase()} scenario. Risk is ${score}/100 (${status.toLowerCase()}); ${affected} of 1,000 simulated students are estimated affected. Evidence: ${causeEvidence.join("; ")}.`;
  return {
    id: `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, generatedAt,
    mode: "SIMULATED · NODE FALLBACK", scenario, entityCount: 1000, metrics,
    anomaly: { detected: score >= 45, status, signals: {}, movingAverage: Math.round(riskHistory.reduce((sum, n) => sum + n, 0) / riskHistory.length), trend: "STABLE" },
    risk: { score, currentScore: score, status, trajectory: riskHistory.map((risk, index) => ({ sample: index + 1, risk })) },
    rootCause: { classification: rootCause, confidence: scenario === "NORMAL" ? 0 : 84, evidence: causeEvidence },
    prediction: { riskScore: score, status, rootCause, confidence: scenario === "NORMAL" ? 0 : 0.84, evidence: causeEvidence, recommendedAction },
    explanation, recommendations, centers,
    forensics: { affectedStudents: affected, totalStudents: 1000, estimatedDowntimeMinutes: affected ? (powerOutage ? 22 : scenario === "NETWORK_DEGRADATION" ? 11 : scenario === "SERVER_OVERLOAD" ? 16 : scenario === "DATABASE_SLOWDOWN" ? 8 : 3) : 0,
      estimatedRecoveryMinutes: affected ? (powerOutage ? 38 : 18) : 0, successfulRecoveries: affected, recoveryRatePct: 100,
      rootCause, recommendations, note: "Impact and timings are synthetic scenario estimates, not measured production records." },
  };
}

export async function analyzeScenario(scenario) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${config.aiServiceUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ scenario }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `AI service returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    // Let the demo remain usable when Python is not installed locally. The
    // Python microservice remains the primary analysis engine when available.
    console.warn("AI service unavailable; using bundled synthetic fallback:", error.message);
    return fallbackAnalysis(scenario);
  } finally {
    clearTimeout(timeout);
  }
}
