/**
 * ExamShield AI Service Layer
 * Abstracts backend communication. In Day 1, this returns mock data based on simulation scenarios.
 * In production, these methods will connect to REST API endpoints and WebSocket channels (e.g. ws://api.examshield.ai/live).
 */

import { SCENARIO_PRESETS, EXAM_METADATA } from '../data/mockExamData';

let currentScenarioKey = 'NORMAL';
let listeners = [];

export const examService = {
  /**
   * Get overall exam state matching contract
   */
  async getExamState() {
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
      activeScenario: preset.id,
      scenarioBadge: preset.badge,
    };
  },

  /**
   * Get current telemetry metrics matching contract
   */
  async getTelemetry() {
    const preset = SCENARIO_PRESETS[currentScenarioKey];
    return {
      examId: EXAM_METADATA.examId,
      timestamp: new Date().toISOString(),
      ...preset.infrastructure,
    };
  },

  /**
   * Get sessions / exam rooms list
   */
  async getSessions() {
    const preset = SCENARIO_PRESETS[currentScenarioKey];
    return preset.sessions || [];
  },

  /**
   * Get specific session details for drill-down
   */
  async getSessionById(sessionId) {
    const sessions = await this.getSessions();
    const found = sessions.find((s) => s.id === sessionId);
    if (!found) return null;

    return {
      ...found,
      diagnosis: found.diagnosis || 'Pending AI diagnosis',
      recommendation: found.recommendation || 'Pending backend/AI integration',
    };
  },

  /**
   * Get incident log timeline
   */
  async getIncidentTimeline() {
    const preset = SCENARIO_PRESETS[currentScenarioKey];
    return preset.timeline || [];
  },

  /**
   * Get time-series chart data for Recharts
   */
  async getChartData() {
    const preset = SCENARIO_PRESETS[currentScenarioKey];
    return preset.chartData || [];
  },

  /**
   * Trigger disaster simulation scenario
   */
  setScenario(scenarioKey) {
    if (SCENARIO_PRESETS[scenarioKey]) {
      currentScenarioKey = scenarioKey;
      this.notifyListeners();
    }
  },

  /**
   * Subscribe to state updates (Prepares UI for WebSocket updates)
   */
  subscribe(callback) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((l) => l !== callback);
    };
  },

  notifyListeners() {
    listeners.forEach((callback) => callback(currentScenarioKey));
  },
};
