import { BASELINE_SESSIONS, EXAM_METADATA } from '../data/mockExamData';

const TICK_MS = 1000;
const HISTORY_LIMIT = 60;
const SCENARIOS = new Set(['NORMAL', 'LOGIN_SPIKE', 'NETWORK_DEGRADATION', 'SERVER_OVERLOAD', 'DATABASE_SLOWDOWN', 'POWER_OUTAGE']);
const listeners = new Set();
let activeScenario = 'NORMAL';
let tick = 0;
let scenarioTick = 0;
let interval = null;
let currentState;
let recentRisk = [];
let events = [];
let remediationDiagnosis = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wave = (at, offset = 0, size = 1) => Math.sin((at + offset) * 0.73) * size;
const timeLabel = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function scenarioSeverity() {
  if (activeScenario === 'NORMAL') return 0;
  if (scenarioTick < 9) return clamp(scenarioTick / 7, 0, 1);
  return clamp(1 - (scenarioTick - 9) / 7, 0, 1);
}

function metricsFor(at, severity, index = 0) {
  const n = wave(at, index * 1.7);
  const net = activeScenario === 'NETWORK_DEGRADATION' || activeScenario === 'POWER_OUTAGE' ? severity : 0;
  const server = activeScenario === 'SERVER_OVERLOAD' ? severity : 0;
  const db = activeScenario === 'DATABASE_SLOWDOWN' ? severity : 0;
  const auth = activeScenario === 'LOGIN_SPIKE' ? severity : 0;
  const outage = activeScenario === 'POWER_OUTAGE' ? severity : 0;
  return {
    latency_ms: Math.round(clamp(48 + n * 5 + net * (260 + index * 8) + server * 18 + db * 28, 20, 520)),
    packet_loss_pct: Number(clamp(0.45 + n * 0.12 + net * (9.2 + index * 0.2), 0, 18).toFixed(1)),
    cpu_pct: Math.round(clamp(53 + wave(at, index) * 4 + server * 39 + db * 7, 15, 99)),
    memory_pct: Math.round(clamp(46 + wave(at, index + 2) * 3 + server * 33, 20, 98)),
    db_response_ms: Math.round(clamp(20 + wave(at, index + 3) * 4 + db * 620, 8, 900)),
    concurrent_users: Math.round(clamp(972 + wave(at, index) * 22 - outage * 125, 0, 1000)),
    login_failures: Math.max(0, Math.round(2 + Math.abs(wave(at, index)) * 2 + auth * (70 + index * 2))),
    submission_failures: Math.max(0, Math.round(1 + net * (25 + index) + db * 20 + server * 10 + outage * 16 + Math.abs(wave(at, index + 4)))),
    availability_pct: Number(clamp(99.8 - outage * 19 - net * 3, 70, 100).toFixed(1)),
    active_students: Math.round(clamp(1000 - outage * 125, 0, 1000)),
    registered_students: 1000,
    power_status: outage > 0.8 ? 'BACKUP' : 'STABLE',
  };
}

function diagnose(metrics, risk) {
  let classification = 'No significant anomaly';
  let action = 'MONITOR_HEALTH';
  const evidence = [];
  if (metrics.latency_ms >= 100 || metrics.packet_loss_pct >= 2) {
    classification = 'Network congestion'; action = 'ACTIVATE_CONTINUITY';
    evidence.push(`Network latency is ${metrics.latency_ms} ms`, `Packet loss is ${metrics.packet_loss_pct}%`);
  } else if (metrics.cpu_pct >= 80 || metrics.memory_pct >= 82) {
    classification = 'Server overload'; action = 'PRIORITIZE_EXAM_TRAFFIC';
    evidence.push(`CPU usage is ${metrics.cpu_pct}%`, `Memory usage is ${metrics.memory_pct}%`);
  } else if (metrics.db_response_ms >= 250) {
    classification = 'Database slowdown'; action = 'QUEUE_SUBMISSIONS';
    evidence.push(`Database response time is ${metrics.db_response_ms} ms`);
  } else if (metrics.login_failures >= 15) {
    classification = 'Authentication failure'; action = 'RETRY_AUTH_VALIDATION';
    evidence.push(`Login failures increased to ${metrics.login_failures}`);
  }
  if (metrics.submission_failures > 2) evidence.push(`Submission failures are ${metrics.submission_failures}`);
  const anomaly = risk >= 42;
  return {
    classification: anomaly ? classification : 'No significant anomaly',
    action: anomaly ? action : 'MONITOR_HEALTH',
    confidence: anomaly ? Math.round(clamp(66 + risk * 0.28, 68, 96)) : 0,
    evidence: anomaly ? evidence : ['Current telemetry is within demo operating thresholds.'],
    anomaly,
  };
}

function buildRemediation(diagnosis, metrics, severity, now) {
  if (diagnosis.anomaly) remediationDiagnosis = diagnosis;
  if (!remediationDiagnosis) return null;
  const playbookDiagnosis = remediationDiagnosis;
  const recovered = activeScenario !== 'NORMAL' && scenarioTick >= 16;
  const state = recovered ? 'RECOVERED' : scenarioTick < 2 ? 'DETECTED' : scenarioTick < 3 ? 'DIAGNOSING' : scenarioTick < 4 ? 'REMEDIATING' : 'VERIFYING';
  const names = playbookDiagnosis.classification === 'Network congestion'
    ? ['ACTIVATE_CONTINUITY', 'QUEUE_SUBMISSIONS', 'ENABLE_RETRY', 'MONITOR_NETWORK', 'VERIFY_HEALTH']
    : playbookDiagnosis.classification === 'Server overload'
      ? ['PRIORITIZE_EXAM_TRAFFIC', 'THROTTLE_NON_CRITICAL_OPERATIONS', 'ACTIVATE_CONTINUITY', 'MONITOR_SERVER', 'VERIFY_HEALTH']
      : playbookDiagnosis.classification === 'Database slowdown'
        ? ['QUEUE_SUBMISSIONS', 'PAUSE_NON_CRITICAL_WRITES', 'RUN_RECOVERY_WORKER', 'MONITOR_DATABASE', 'VERIFY_HEALTH']
        : ['RETRY_AUTH_VALIDATION', 'PROTECT_ACTIVE_SESSIONS', 'MONITOR_AUTH_SERVICE', 'VERIFY_HEALTH'];
  const completed = Math.max(0, Math.min(names.length, scenarioTick - 2));
  return {
    runId: `demo-remediation-${activeScenario}`,
    cause: playbookDiagnosis.classification.toUpperCase().replaceAll(' ', '_'),
    probableCause: playbookDiagnosis.classification,
    confidence: playbookDiagnosis.confidence / 100,
    evidence: playbookDiagnosis.evidence,
    state,
    status: recovered ? 'SUCCEEDED' : 'RUNNING',
    simulation: true,
    startedAt: new Date(now - scenarioTick * TICK_MS).toISOString(),
    actions: names.slice(0, Math.max(1, completed)).map((name, index) => ({ name, status: recovered || index < completed - 1 ? 'COMPLETED' : 'RUNNING', details: 'Deterministic local demo playbook action' })),
    metricsBefore: metricsFor(atTickAtIncident(), 1),
    metricsAfter: recovered ? metricsFor(tick, 0) : {},
    pendingSubmissions: recovered ? 0 : severity > 0.5 ? 7 : 0,
    failureReason: null,
  };
}

function atTickAtIncident() { return Math.max(0, tick - scenarioTick + 7); }

function buildState({ appendPoint = false } = {}) {
  const now = Date.now();
  const severity = scenarioSeverity();
  const global = metricsFor(tick, severity);
  const baseRisk = 14
    + Math.max(0, global.latency_ms - 48) * 0.12
    + global.packet_loss_pct * 2.6
    + Math.max(0, global.cpu_pct - 53) * 0.42
    + global.submission_failures * 0.72
    + Math.max(0, global.db_response_ms - 20) * 0.08
    + global.login_failures * 0.5;
  const risk = Math.round(clamp(baseRisk, 8, 98));
  const diagnosis = diagnose(global, risk);
  const continuityMode = severity >= 0.56 && diagnosis.anomaly;
  const recovering = activeScenario !== 'NORMAL' && scenarioTick >= 10 && severity > 0.05;
  const fullyRecovered = activeScenario !== 'NORMAL' && scenarioTick >= 16;
  const status = fullyRecovered ? 'RECOVERED' : recovering ? 'RECOVERING' : continuityMode ? 'CONTINUITY_ACTIVE' : risk >= 75 ? 'CRITICAL' : risk >= 42 ? 'AT_RISK' : 'NORMAL';
  const sessions = BASELINE_SESSIONS.map((base, index) => {
    const metrics = metricsFor(tick, severity, index + 1);
    const sessionRisk = Math.round(clamp(risk + wave(tick, index * 2, 4), 5, 99));
    const sessionStatus = fullyRecovered && index < 4 ? 'RECOVERED' : recovering && index < 4 ? 'RECOVERING' : continuityMode && index < 4 ? 'CONTINUITY_ACTIVE' : sessionRisk >= 75 ? 'AFFECTED' : sessionRisk >= 42 ? 'AT_RISK' : 'NORMAL';
    const sessionDiagnosis = diagnose(metrics, sessionRisk);
    return {
      ...base,
      status: sessionStatus,
      riskScore: sessionRisk,
      latency: metrics.latency_ms,
      packetLoss: metrics.packet_loss_pct,
      loginFailures: metrics.login_failures,
      submissionFailures: metrics.submission_failures,
      cpu: metrics.cpu_pct,
      memory: metrics.memory_pct,
      dbResponseTime: metrics.db_response_ms,
      concurrentUsers: Math.round(metrics.concurrent_users / BASELINE_SESSIONS.length),
      continuity: { active: sessionStatus === 'CONTINUITY_ACTIVE' || sessionStatus === 'RECOVERING' },
      recovery: { pending: sessionStatus === 'CONTINUITY_ACTIVE' ? 2 : recovering ? 1 : 0, processing: recovering ? 1 : 0, recovered: severity === 0 && scenarioTick >= 16 && index < 4 ? 2 : 0, failed: 0 },
      analysis: {
        riskScore: sessionRisk,
        status: sessionRisk >= 75 ? 'CRITICAL' : sessionRisk >= 42 ? 'AT_RISK' : 'NORMAL',
        anomalyDetected: sessionDiagnosis.anomaly,
        rootCause: { classification: sessionDiagnosis.classification, confidence: sessionDiagnosis.confidence, evidence: sessionDiagnosis.evidence },
        confidence: sessionDiagnosis.confidence / 100,
        evidence: sessionDiagnosis.evidence,
        recommendedAction: sessionDiagnosis.action,
        explanation: sessionDiagnosis.anomaly ? `${sessionDiagnosis.classification} is indicated by the current session telemetry.` : 'Current session telemetry remains within demo operating thresholds.',
      },
      recommendation: sessionDiagnosis.action,
      recommendationReason: sessionDiagnosis.anomaly ? sessionDiagnosis.evidence.join('; ') : 'Monitor session telemetry for changes.',
      remediation: buildRemediation(sessionDiagnosis, metrics, severity, now),
      timeline: events.filter((event) => !event.sessionId || event.sessionId === base.id).slice(-30).map((event) => ({ ...event, time: timeLabel(new Date(event.timestamp)) })),
    };
  });
  const counts = sessions.reduce((out, item) => { out[item.status] = (out[item.status] || 0) + 1; return out; }, {});
  const erBreakdown = {
    availability: Math.round(global.availability_pct),
    networkStability: Math.round(clamp(100 - global.packet_loss_pct * 5 - Math.max(0, global.latency_ms - 50) * 0.08, 0, 100)),
    serverHealth: Math.round(clamp(100 - Math.max(global.cpu_pct, global.memory_pct) * 0.35, 0, 100)),
    submissionHealth: Math.round(clamp(100 - global.submission_failures * 2, 0, 100)),
    recoveryPerformance: recovering ? 78 : 95,
  };
  const erScore = Math.round(Object.values(erBreakdown).reduce((sum, value) => sum + value, 0) / 5);
  const riskPoint = { sample: tick, risk };
  recentRisk = [...recentRisk, riskPoint].slice(-24);
  const analysis = {
    id: `demo-analysis-${tick}`,
    mode: 'LOCAL DEMO',
    scenario: activeScenario,
    entityCount: 1000,
    generatedAt: new Date(now).toISOString(),
    metrics: global,
    anomaly: { detected: diagnosis.anomaly, status: diagnosis.anomaly ? 'ANOMALY_DETECTED' : 'NORMAL', movingAverage: risk, trend: recovering ? 'IMPROVING' : severity > 0 ? 'WORSENING' : 'STABLE' },
    risk: { score: risk, status: risk >= 75 ? 'CRITICAL' : risk >= 42 ? 'AT_RISK' : 'NORMAL', trajectory: recentRisk },
    rootCause: { classification: diagnosis.classification, confidence: diagnosis.confidence, evidence: diagnosis.evidence },
    prediction: { recommendedAction: diagnosis.action },
    explanation: diagnosis.anomaly ? `${diagnosis.classification} is the strongest match for the latest telemetry: ${diagnosis.evidence.join('; ')}.` : 'Live demo telemetry is within normal operating thresholds.',
    recommendations: [diagnosis.action.replaceAll('_', ' ')],
    forensics: { affectedStudents: sessions.filter((item) => ['AFFECTED', 'CONTINUITY_ACTIVE', 'RECOVERING'].includes(item.status)).reduce((sum, item) => sum + item.students, 0), totalStudents: 1000, estimatedDowntimeMinutes: recovering ? 1 : 0, successfulRecoveries: severity === 0 && scenarioTick >= 16 ? 7 : 0, recoveryRatePct: severity === 0 && scenarioTick >= 16 ? 100 : 0, estimatedRecoveryMinutes: 7, recommendations: [diagnosis.action.replaceAll('_', ' ')], note: 'Local deterministic demo analysis; no external AI or backend connection is used.' },
  };
  const chartPoint = { time: timeLabel(new Date(now)), latency: global.latency_ms, packetLoss: global.packet_loss_pct, cpu: global.cpu_pct, users: global.concurrent_users, loginFailures: global.login_failures, submissionFailures: global.submission_failures };
  const chartData = appendPoint && currentState ? [...currentState.chartData, chartPoint].slice(-HISTORY_LIMIT) : [chartPoint];
  const timeline = [...events].slice(-40).map((event) => ({ id: event.id, time: timeLabel(new Date(event.timestamp)), type: event.type, message: event.message }));
  const remediation = buildRemediation(diagnosis, global, severity, now);
  return {
    examId: 'DEMO-EXAM-001', examName: EXAM_METADATA.title, code: 'DEMO-EXAM-001', semester: EXAM_METADATA.semester,
    examStatus: status, riskScore: risk, continuityMode, affectedStudents: analysis.forensics.affectedStudents,
    erScore, erBreakdown,
    students: { total: 1000, normal: sessions.filter((item) => item.status === 'NORMAL').reduce((sum, item) => sum + item.students, 0), atRisk: sessions.filter((item) => item.status === 'AT_RISK').reduce((sum, item) => sum + item.students, 0), affected: analysis.forensics.affectedStudents },
    infrastructure: { latency: global.latency_ms, packetLoss: global.packet_loss_pct, cpu: global.cpu_pct, memory: global.memory_pct, concurrentUsers: global.concurrent_users, loginFailures: global.login_failures, submissionFailures: global.submission_failures, dbResponseTime: global.db_response_ms, observedAt: now },
    sessions, timeline, chartData, activeScenario, scenarioBadge: 'Local deterministic demo · updates every second',
    analysis, remediation, pendingSubmissions: remediation?.pendingSubmissions ?? 0, recoveredSubmissions: severity === 0 && scenarioTick >= 16 ? 7 : 0,
    demoMode: true, demoTick: tick,
  };
}

function emit() {
  currentState = buildState({ appendPoint: true });
  for (const listener of listeners) listener(currentState);
}

function ensureTimer() {
  if (!interval && listeners.size) interval = setInterval(() => {
    tick += 1;
    if (activeScenario !== 'NORMAL') {
      scenarioTick += 1;
      if (scenarioTick === 4) events = [...events, { id: `demo-continuity-${Date.now()}`, timestamp: Date.now(), type: 'warning', message: 'Continuity activated; active sessions and pending submissions are protected.' }].slice(-40);
      if (scenarioTick === 10) events = [...events, { id: `demo-recovery-${Date.now()}`, timestamp: Date.now(), type: 'info', message: 'Network health is improving; recovery verification started.' }].slice(-40);
      if (scenarioTick === 16) events = [...events, { id: `demo-recovered-${Date.now()}`, timestamp: Date.now(), type: 'success', message: 'Health checks passed and queued submissions were recovered.' }].slice(-40);
    }
    emit();
  }, TICK_MS);
}

export const demoTelemetryService = {
  getState() {
    if (!currentState) currentState = buildState();
    return currentState;
  },
  subscribe(listener) {
    listeners.add(listener);
    ensureTimer();
    return () => {
      listeners.delete(listener);
      if (!listeners.size && interval) { clearInterval(interval); interval = null; }
    };
  },
  setScenario(scenario) {
    if (!SCENARIOS.has(scenario)) return this.getState();
    remediationDiagnosis = null;
    activeScenario = scenario;
    scenarioTick = 0;
    if (scenario === 'NORMAL') {
      tick = 0;
      recentRisk = [];
      events = [];
      currentState = null;
      remediationDiagnosis = null;
    }
    events = [...events, { id: `demo-event-${Date.now()}`, timestamp: Date.now(), type: scenario === 'NORMAL' ? 'success' : 'warning', message: scenario === 'NORMAL' ? 'Demo exam returned to the healthy baseline.' : `${scenario.replaceAll('_', ' ')} scenario started in the local demo engine.` }].slice(-40);
    emit();
    return currentState;
  },
  reset() { return this.setScenario('NORMAL'); },
};
