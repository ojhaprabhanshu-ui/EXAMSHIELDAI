/**
 * ExamShield AI Service Layer
 * Supports both Live Backend API / Socket.IO connection and Interactive Disaster Simulation presets.
 */

import { SCENARIO_PRESETS, EXAM_METADATA } from '../data/mockExamData';
import { apiRequest, createExamSocket } from './apiClient';

let currentScenarioKey = 'NORMAL';
let listeners = [];
let activeSocket = null;
let liveConnected = false;
let activeExamId = null;
let refreshInFlight = false;

export const examService = {
  isLive() {
    return liveConnected;
  },

  async connectLive(token) {
    if (!token) return this.getExamState();
    try {
      if (activeSocket) activeSocket.disconnect();
      activeSocket = createExamSocket(token);

      const refresh = async () => {
        if (refreshInFlight) return;
        refreshInFlight = true;
        try {
          const data = await this.getExamState(token);
          if (data) this.notifyListeners(data);
        } finally { refreshInFlight = false; }
      };

      activeSocket.on('connect', async () => {
        liveConnected = true;
        this.notifyListeners();
        const state = await this.getExamState(token);
        if (state?.backendExamId) {
          activeExamId = state.backendExamId;
          activeSocket.emit('exam:join', { examId: activeExamId }, (result) => {
            if (!result?.ok) console.warn('Could not subscribe to exam updates:', result?.error);
          });
        }
      });

      activeSocket.on('disconnect', () => {
        liveConnected = false;
        this.notifyListeners();
      });

      ['exam:state-changed', 'exam:risk-updated', 'exam:telemetry-recorded',
        'continuity:updated', 'continuity:submission-recovered', 'remediation:updated',
        'continuity:submission-retry', 'incident:updated'].forEach((event) => activeSocket.on(event, refresh));
      activeSocket.on('connect_error', () => { liveConnected = false; this.notifyListeners(); });

      return await this.getExamState(token);
    } catch (err) {
      liveConnected = false;
      throw err;
    }
  },

  disconnectLive() {
    if (activeSocket) {
      activeSocket.disconnect();
      activeSocket = null;
    }
    liveConnected = false;
    activeExamId = null;
    this.notifyListeners();
  },

  /**
   * Get overall exam state matching contract
   */
  async getExamState(token = null) {
    if (token) {
      try {
        const exams = await apiRequest('/exams');
        if (Array.isArray(exams) && exams.length > 0) {
          const liveExam = exams[0];
          activeExamId = liveExam._id;
          const [dashboard, remediationState] = await Promise.all([
            apiRequest(`/exams/${liveExam._id}/dashboard`),
            apiRequest(`/exams/${liveExam._id}/remediation/latest`),
          ]);
          const latestTelemetry = dashboard.telemetry?.at(-1);
          const signals = Object.fromEntries((dashboard.telemetry || []).map((row) => [row.signalType, row.value]));
          const riskScore = dashboard.exam.risk?.score ?? 0;
          const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
          const erBreakdown = {
            availability: signals.availability_pct === undefined ? null : Math.max(0, 100 - Math.max(0, 99.9 - Number(signals.availability_pct)) * 10),
            networkStability: signals.latency_ms === undefined || signals.packet_loss_pct === undefined ? null : Math.max(0, 100 - Number(signals.packet_loss_pct) * 4 - Math.max(0, Number(signals.latency_ms) - 50) / 10),
            serverHealth: signals.cpu_pct === undefined || signals.memory_pct === undefined ? null : Math.max(0, 100 - Math.max(Number(signals.cpu_pct), Number(signals.memory_pct)) * .35),
            submissionHealth: signals.submission_failures === undefined ? null : Math.max(0, 100 - Number(signals.submission_failures) * 2),
            recoveryPerformance: null,
          };
          const erScore = average(Object.values(erBreakdown).filter(Number.isFinite));
          const continuityMode = Boolean(dashboard.exam.continuity?.enabled);
          const sessions = (dashboard.sessions || []).map((item) => {
            const sessionId = String(item._id);
            const rows = (dashboard.telemetry || []).filter((row) => String(row.sessionId || '') === sessionId);
            const sessionSignals = Object.fromEntries(rows.map((row) => [row.signalType, row.value]));
            const lastAnalysis = [...rows].reverse().find((row) => row.metadata?.aiAnalysis)?.metadata.aiAnalysis;
            const sessionRisk = rows.at(-1)?.riskScore;
            const sessionEvents = [
              ...rows.map((row) => ({ id: String(row._id), timestamp: row.observedAt, type: 'TELEMETRY_UPDATED', message: `${row.signalType}: ${row.value}${row.unit ? ` ${row.unit}` : ''}` })),
              ...(dashboard.auditEvents || []).filter((event) => String(event.payload?.sessionId || '') === sessionId).map((event) => ({ id: String(event._id), timestamp: event.occurredAt, type: event.eventType, message: event.eventType.replaceAll('_', ' ') })),
            ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            const recovery = dashboard.recoveryBySession?.[sessionId] || {};
            return {
              id: sessionId, center: item.center, room: item.room,
              students: item.studentCount ?? 1,
              status: item.continuity?.active ? 'CONTINUITY_ACTIVE' : Number.isFinite(sessionRisk) ? sessionRisk >= 75 ? 'AFFECTED' : sessionRisk >= 45 ? 'AT_RISK' : 'NORMAL' : item.status || 'UNKNOWN',
              continuity: item.continuity,
              riskScore: sessionRisk,
              latency: sessionSignals.latency_ms, packetLoss: sessionSignals.packet_loss_pct,
              loginFailures: sessionSignals.login_failures, submissionFailures: sessionSignals.submission_failures,
              cpu: sessionSignals.cpu_pct, memory: sessionSignals.memory_pct,
              dbResponseTime: sessionSignals.db_response_ms, concurrentUsers: sessionSignals.concurrent_users,
              analysis: lastAnalysis, timeline: sessionEvents, recovery, remediation: remediationState.remediation,
            };
          });
          liveConnected = true;
          return {
            backendExamId: liveExam._id,
            remediation: remediationState.remediation,
            pendingSubmissions: remediationState.pendingSubmissions,
            recoveredSubmissions: remediationState.recoveredSubmissions,
            examId: liveExam.code || EXAM_METADATA.examId,
            examName: liveExam.title || EXAM_METADATA.title,
            code: liveExam.code || EXAM_METADATA.code,
            semester: liveExam.semester || EXAM_METADATA.semester,
            examStatus: dashboard.exam.state || 'NORMAL',
            riskScore,
            continuityMode,
            affectedStudents: sessions.filter((item) => ['AFFECTED', 'CONTINUITY_ACTIVE', 'RECOVERING'].includes(item.status)).reduce((sum, item) => sum + item.students, 0),
            erScore,
            erBreakdown,
            students: { total: dashboard.exam.studentCount ?? sessions.reduce((sum, item) => sum + item.students, 0), normal: sessions.filter((item) => item.status === 'ACTIVE').length, atRisk: dashboard.exam.state === 'AT_RISK' ? sessions.length : 0, affected: sessions.filter((item) => ['AFFECTED', 'CONTINUITY_ACTIVE', 'RECOVERING'].includes(item.status)).length },
            infrastructure: { latency: signals.latency_ms, packetLoss: signals.packet_loss_pct, cpu: signals.cpu_pct, memory: signals.memory_pct, concurrentUsers: signals.concurrent_users, loginFailures: signals.login_failures, submissionFailures: signals.submission_failures, dbResponseTime: signals.db_response_ms, observedAt: latestTelemetry?.observedAt },
            sessions,
            timeline: [...(dashboard.auditEvents || []).map((event) => ({ id: event._id, time: new Date(event.createdAt).toLocaleTimeString(), type: 'warning', message: event.eventType })), ...(dashboard.incidents || []).map((incident) => ({ id: incident._id, time: new Date(incident.openedAt).toLocaleTimeString(), type: 'danger', message: incident.summary || incident.title }))],
            chartData: (dashboard.telemetry || []).map((row) => ({ time: new Date(row.observedAt).toLocaleTimeString(), [row.signalType]: row.value })),
            activeScenario: 'LIVE_BACKEND',
            scenarioBadge: 'Live Production Connection',
          };
        }
        throw new Error('NO_EXAMS: No scheduled or active exams are available.');
      } catch (err) {
        liveConnected = false;
        throw err;
      }
    }

    const preset = SCENARIO_PRESETS[currentScenarioKey] || SCENARIO_PRESETS.NORMAL;
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
      sessions: preset.sessions,
      timeline: preset.timeline,
      chartData: preset.chartData,
      activeScenario: preset.id,
      scenarioBadge: preset.badge,
    };
  },

  /**
   * Trigger disaster simulation scenario
   */
  async setScenario(scenarioKey) {
    if (SCENARIO_PRESETS[scenarioKey]) {
      currentScenarioKey = scenarioKey;
      this.notifyListeners();
    }
    return this.getExamState();
  },

  async simulateScenario(scenarioKey, sessionId) {
    if (!activeExamId) throw new Error('No active backend exam is selected.');
    const analysis = await apiRequest('/ai/simulate', { method: 'POST', body: JSON.stringify({ scenario: scenarioKey }) });
    const metrics = analysis.metrics;
    const score = scenarioKey === 'NORMAL' ? 0 : analysis.risk.score;
    const units = { latency_ms: 'ms', packet_loss_pct: '%', cpu_pct: '%', memory_pct: '%', db_response_ms: 'ms', availability_pct: '%', concurrent_users: 'students' };
    for (const [signalType, value] of Object.entries(metrics)) {
      if (signalType === 'registered_students' || signalType === 'active_students') continue;
      await apiRequest(`/exams/${activeExamId}/telemetry`, {
        method: 'POST',
        body: JSON.stringify({ source: 'examshield-scenario-simulator', signalType, value, unit: units[signalType],
          ...(sessionId ? { sessionId } : {}),
          severity: score >= 75 ? 'CRITICAL' : score >= 45 ? 'HIGH' : 'INFO', riskScore: score,
          metadata: { scenario: scenarioKey, rootCause: analysis.rootCause, recommendation: analysis.recommendations?.[0],
            aiAnalysis: { riskScore: analysis.risk.score, status: analysis.risk.status, anomalyDetected: analysis.anomaly.detected,
              rootCause: analysis.rootCause, evidence: analysis.rootCause.evidence, recommendedAction: analysis.prediction?.recommendedAction,
              explanation: analysis.explanation } } }),
      });
    }
    if (scenarioKey === 'NORMAL') return analysis;
    const remediationResult = await apiRequest(`/exams/${activeExamId}/remediation`, {
      method: 'POST',
      body: JSON.stringify({ cause: analysis.rootCause.classification,
        confidence: Math.max(0, Math.min(1, analysis.rootCause.confidence / 100)),
        evidence: analysis.rootCause.evidence, metricsBefore: metrics, simulationRunId: analysis.id }),
    });
    analysis.remediation = remediationResult.remediation;
    return analysis;
  },

  /**
   * Subscribe to state updates
   */
  subscribe(callback) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  },

  notifyListeners(state) {
    listeners.forEach((callback) => callback(currentScenarioKey, state));
  },
};
