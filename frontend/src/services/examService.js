import { SCENARIO_PRESETS, EXAM_METADATA } from '../data/mockExamData';
import { apiRequest, createExamSocket, setAccessToken } from './apiClient';

let currentScenarioKey = 'NORMAL';
let listeners = [];
let liveExamId = null;
let liveDashboard = null;
let socket = null;
let refreshTimer = null;

const metricAliases = {
  latency: ['latency', 'network_latency', 'latency_ms'],
  packetLoss: ['packet_loss', 'packetloss', 'packet_loss_percent'],
  cpu: ['cpu', 'cpu_usage', 'cpu_percent'],
  memory: ['memory', 'memory_usage', 'memory_percent'],
  concurrentUsers: ['concurrent_users', 'active_users', 'users'],
  loginFailures: ['login_failures', 'login_failure_count'],
  submissionFailures: ['submission_failures', 'submission_failure_count'],
};

function numericValue(value) {
  const raw = value && typeof value === 'object' ? (value.value ?? value.count ?? value.score) : value;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function metricKey(signalType = '') {
  const normalized = String(signalType).toLowerCase().replace(/[.\s-]+/g, '_');
  return Object.entries(metricAliases).find(([, aliases]) => aliases.some((alias) => normalized === alias || normalized.endsWith(`_${alias}`)))?.[0] ?? null;
}

function mapStatus(exam) {
  if (exam.status === 'COMPLETED' || exam.status === 'CANCELLED') return 'COMPLETED';
  if (exam.state === 'AT_RISK') return 'AT_RISK';
  if (['AFFECTED', 'CONTINUITY_ACTIVE'].includes(exam.state)) return 'CRITICAL';
  if (exam.state === 'RECOVERING') return 'RECOVERING';
  return exam.status === 'SCHEDULED' ? 'SCHEDULED' : 'LIVE';
}

function mapDashboard(dashboard) {
  const { exam, sessions = [], telemetry = [], incidents = [], auditEvents = [] } = dashboard;
  const riskScore = exam.risk?.score ?? 0;
  const affectedState = ['AFFECTED', 'CONTINUITY_ACTIVE'].includes(exam.state);
  const sessionStatus = exam.state === 'AT_RISK' ? 'AT_RISK' : affectedState ? 'AFFECTED' : 'NORMAL';
  const mappedSessions = sessions.map((session) => ({
    id: String(session._id).slice(-8).toUpperCase(),
    sessionId: String(session._id),
    center: 'Online',
    room: 'Exam session',
    students: 1,
    status: session.status === 'ACTIVE' ? sessionStatus : 'NORMAL',
    riskScore,
    latency: null,
    packetLoss: null,
    loginFailures: 0,
    submissionFailures: 0,
    diagnosis: exam.stateReason || 'Live student session from backend.',
    recommendation: exam.continuity?.enabled ? 'Continuity mode is active; queued submissions will flush after recovery.' : 'Session is connected to the live exam backend.',
  }));

  const infrastructure = Object.fromEntries(Object.keys(metricAliases).map((key) => [key, 0]));
  for (const item of telemetry) {
    const key = metricKey(item.signalType);
    const value = numericValue(item.value) ?? item.riskScore;
    if (key && value !== undefined && value !== null) infrastructure[key] = value;
  }
  const chartData = telemetry.map((item) => {
    const key = metricKey(item.signalType);
    const value = numericValue(item.value) ?? item.riskScore;
    return {
      time: new Date(item.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ...(key === 'latency' ? { latency: value } : {}),
      ...(key === 'packetLoss' ? { packetLoss: value } : {}),
      ...(key === 'cpu' ? { cpu: value } : {}),
      ...(key === 'concurrentUsers' ? { users: value } : {}),
      ...(key === 'loginFailures' ? { loginFailures: value } : {}),
      ...(key === 'submissionFailures' ? { submissionFailures: value } : {}),
    };
  });

  const eventTimeline = [
    ...incidents.map((incident) => ({
      id: String(incident._id),
      occurredAt: incident.openedAt,
      type: incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'danger' : 'warning',
      message: incident.title,
    })),
    ...auditEvents.map((event) => ({
      id: String(event._id),
      occurredAt: event.occurredAt,
      type: event.eventType.includes('RECOVER') ? 'success' : event.eventType.includes('STATE') ? 'warning' : 'info',
      message: `${event.eventType.replaceAll('_', ' ')} — ${event.entityType} ${event.entityId}`,
    })),
  ].sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

  const total = mappedSessions.length;
  const affected = mappedSessions.filter((item) => item.status === 'AFFECTED').length;
  const atRisk = mappedSessions.filter((item) => item.status === 'AT_RISK').length;
  const erScore = Math.max(0, 100 - riskScore);
  return {
    examId: String(exam._id),
    examName: exam.title,
    code: '—',
    semester: 'Live exam',
    examStatus: mapStatus(exam),
    riskScore,
    continuityMode: Boolean(exam.continuity?.enabled),
    affectedStudents: affected,
    erScore,
    students: { total, normal: Math.max(0, total - atRisk - affected), atRisk, affected },
    erBreakdown: {
      availability: erScore,
      networkStability: erScore,
      serverHealth: erScore,
      submissionHealth: exam.continuity?.enabled ? 60 : erScore,
      recoveryPerformance: exam.state === 'RECOVERED' ? 100 : erScore,
    },
    infrastructure,
    sessions: mappedSessions,
    timeline: eventTimeline.map((item) => ({
      id: item.id,
      type: item.type,
      message: item.message,
      time: new Date(item.occurredAt).toLocaleTimeString([], { hour12: false }),
    })),
    chartData,
    activeScenario: 'LIVE_BACKEND',
    scenarioBadge: exam.stateReason || `Live backend state: ${exam.state}`,
    continuityPendingCount: exam.continuity?.pendingCount ?? 0,
  };
}

function scheduleLiveRefresh() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(async () => {
    refreshTimer = null;
    try {
      await examService.refreshLive();
      examService.notifyListeners();
    } catch (error) {
      console.error('Live dashboard refresh failed:', error.message);
    }
  }, 150);
}

export const examService = {
  isLive() { return Boolean(liveExamId && liveDashboard); },

  async connectLive(token) {
    this.disconnectLive();
    setAccessToken(token);
    const { exams = [] } = await apiRequest('/exams');
    if (!exams.length) {
      const error = new Error('There are no scheduled or active exams in the database yet.');
      error.code = 'NO_EXAMS';
      throw error;
    }
    liveExamId = String(exams[0]._id);
    await this.refreshLive();
    socket = createExamSocket(token);
    socket.on('connect', () => socket.emit('exam:join', { examId: liveExamId }));
    ['exam:risk-updated', 'exam:state-changed', 'exam:continuity-updated', 'continuity:submission-recovered', 'continuity:submission-retry']
      .forEach((event) => socket.on(event, scheduleLiveRefresh));
    socket.on('connect_error', (error) => console.error('Command Center live stream:', error.message));
    this.notifyListeners();
    return mapDashboard(liveDashboard);
  },

  disconnectLive() {
    if (socket) socket.disconnect();
    socket = null;
    liveExamId = null;
    liveDashboard = null;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    setAccessToken(null);
  },

  async refreshLive() {
    if (!liveExamId) throw new Error('No live exam selected');
    liveDashboard = await apiRequest(`/exams/${liveExamId}/dashboard`);
    return mapDashboard(liveDashboard);
  },

  async getExamState() {
    if (this.isLive()) return this.refreshLive();
    const preset = SCENARIO_PRESETS[currentScenarioKey];
    return {
      examId: EXAM_METADATA.examId,
      examName: EXAM_METADATA.title,
      code: EXAM_METADATA.code,
      semester: EXAM_METADATA.semester,
      examStatus: preset.examStatus,
      riskScore: preset.riskScore,
      continuityMode: preset.continuityMode,
      affectedStudents: preset.affectedStudents,
      erScore: preset.erScore,
      students: preset.students,
      erBreakdown: preset.erBreakdown,
      infrastructure: preset.infrastructure,
      sessions: preset.sessions || [],
      timeline: preset.timeline || [],
      chartData: preset.chartData || [],
      activeScenario: preset.id,
      scenarioBadge: preset.badge,
    };
  },

  async getTelemetry() {
    if (this.isLive()) return { examId: liveExamId, timestamp: new Date().toISOString(), ...mapDashboard(liveDashboard).infrastructure };
    const preset = SCENARIO_PRESETS[currentScenarioKey];
    return { examId: EXAM_METADATA.examId, timestamp: new Date().toISOString(), ...preset.infrastructure };
  },

  async getSessions() {
    if (this.isLive()) return mapDashboard(liveDashboard).sessions;
    return SCENARIO_PRESETS[currentScenarioKey].sessions || [];
  },

  async getSessionById(sessionId) {
    const sessions = await this.getSessions();
    const found = sessions.find((session) => session.id === sessionId);
    if (!found) return null;
    return { ...found, diagnosis: found.diagnosis || 'Pending AI diagnosis', recommendation: found.recommendation || 'Pending resilience recommendation' };
  },

  async getIncidentTimeline() {
    return this.isLive() ? mapDashboard(liveDashboard).timeline : (SCENARIO_PRESETS[currentScenarioKey].timeline || []);
  },

  async getChartData() {
    return this.isLive() ? mapDashboard(liveDashboard).chartData : (SCENARIO_PRESETS[currentScenarioKey].chartData || []);
  },

  async setScenario(scenarioKey) {
    if (!SCENARIO_PRESETS[scenarioKey]) return;
    currentScenarioKey = scenarioKey;
    if (!this.isLive()) {
      this.notifyListeners();
      return;
    }
    const preset = SCENARIO_PRESETS[scenarioKey];
    const score = preset.riskScore;
    const severity = score >= 90 ? 'CRITICAL' : score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : score > 0 ? 'LOW' : 'INFO';
    await apiRequest(`/exams/${liveExamId}/telemetry`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'command-center-simulator',
        signalType: `scenario.${scenarioKey.toLowerCase()}`,
        severity,
        riskScore: score,
        value: score,
        unit: 'risk points',
        metadata: { scenarioKey },
      }),
    });
    await this.refreshLive();
    this.notifyListeners();
  },

  subscribe(callback) {
    listeners.push(callback);
    return () => { listeners = listeners.filter((listener) => listener !== callback); };
  },

  notifyListeners() {
    listeners.forEach((callback) => callback(currentScenarioKey));
  },
};
