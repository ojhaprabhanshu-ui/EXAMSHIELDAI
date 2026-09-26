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

export const examService = {
  isLive() {
    return liveConnected;
  },

  async connectLive(token) {
    if (!token) return this.getExamState();
    try {
      if (activeSocket) activeSocket.disconnect();
      activeSocket = createExamSocket(token);

      activeSocket.on('connect', () => {
        liveConnected = true;
        this.notifyListeners();
      });

      activeSocket.on('disconnect', () => {
        liveConnected = false;
        this.notifyListeners();
      });

      activeSocket.on('telemetry', () => {
        this.notifyListeners();
      });

      activeSocket.on('incident', () => {
        this.notifyListeners();
      });

      return await this.getExamState(token);
    } catch (err) {
      liveConnected = false;
      return this.getExamState();
    }
  },

  disconnectLive() {
    if (activeSocket) {
      activeSocket.disconnect();
      activeSocket = null;
    }
    liveConnected = false;
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
          const dashboard = await apiRequest(`/exams/${liveExam._id}/dashboard`);
          liveConnected = true;
          return {
            examId: liveExam.code || EXAM_METADATA.examId,
            examName: liveExam.title || EXAM_METADATA.title,
            code: liveExam.code || EXAM_METADATA.code,
            semester: liveExam.semester || EXAM_METADATA.semester,
            examStatus: dashboard.examStatus || liveExam.state || 'LIVE',
            riskScore: dashboard.riskScore ?? 24,
            continuityMode: dashboard.continuityMode ?? false,
            affectedStudents: dashboard.affectedStudents ?? 0,
            erScore: dashboard.erScore ?? 95,
            students: dashboard.students || { total: 1000, normal: 970, atRisk: 25, affected: 5 },
            erBreakdown: dashboard.erBreakdown || { availability: 98, networkStability: 94, serverHealth: 91, submissionHealth: 97, recoveryPerformance: 95 },
            infrastructure: dashboard.infrastructure || { latency: 48, packetLoss: 0.5, cpu: 54, memory: 42, concurrentUsers: 992, loginFailures: 2, submissionFailures: 1 },
            sessions: dashboard.sessions || SCENARIO_PRESETS.NORMAL.sessions,
            timeline: dashboard.timeline || SCENARIO_PRESETS.NORMAL.timeline,
            chartData: dashboard.chartData || SCENARIO_PRESETS.NORMAL.chartData,
            activeScenario: 'LIVE_BACKEND',
            scenarioBadge: 'Live Production Connection',
          };
        }
      } catch (err) {
        liveConnected = false;
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

  /**
   * Subscribe to state updates
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
