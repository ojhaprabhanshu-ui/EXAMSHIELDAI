/**
 * ExamShield AI - Central Mock Data Registry
 * Represents official JSON contracts for Exam State, Infrastructure Telemetry, 
 * Sessions, and Incident Timeline across the Disaster Simulation scenarios.
 */

export const EXAM_METADATA = {
  examId: 'EXAM001',
  title: 'Database Management Systems',
  code: 'CS-601',
  semester: 'Semester VI',
  totalRegistered: 1000,
  startTime: '10:00 AM',
  endTime: '01:00 PM',
  duration: '3 Hours',
};

// Initial Sessions Database
export const BASELINE_SESSIONS = [
  { id: 'A101', center: 'Bhopal Center', room: 'Lab 101', students: 120, status: 'NORMAL', riskScore: 12, latency: 42, packetLoss: 0.2, loginFailures: 1, submissionFailures: 0 },
  { id: 'A102', center: 'Bhopal Center', room: 'Lab 102', students: 110, status: 'NORMAL', riskScore: 18, latency: 45, packetLoss: 0.4, loginFailures: 0, submissionFailures: 0 },
  { id: 'A103', center: 'Bhopal Center', room: 'Lab 103', students: 125, status: 'NORMAL', riskScore: 24, latency: 50, packetLoss: 0.5, loginFailures: 2, submissionFailures: 1 },
  { id: 'A104', center: 'Indore Center', room: 'Block B-201', students: 130, status: 'NORMAL', riskScore: 15, latency: 40, packetLoss: 0.3, loginFailures: 1, submissionFailures: 0 },
  { id: 'A105', center: 'Indore Center', room: 'Block B-202', students: 115, status: 'NORMAL', riskScore: 20, latency: 48, packetLoss: 0.6, loginFailures: 0, submissionFailures: 0 },
  { id: 'A106', center: 'Gwalior Center', room: 'Main Hall A', students: 140, status: 'NORMAL', riskScore: 10, latency: 38, packetLoss: 0.1, loginFailures: 0, submissionFailures: 0 },
  { id: 'A107', center: 'Gwalior Center', room: 'Main Hall B', students: 120, status: 'NORMAL', riskScore: 22, latency: 52, packetLoss: 0.4, loginFailures: 1, submissionFailures: 0 },
  { id: 'A108', center: 'Jabalpur Center', room: 'CS Lab 3', students: 140, status: 'NORMAL', riskScore: 16, latency: 46, packetLoss: 0.3, loginFailures: 0, submissionFailures: 0 },
];

export const SCENARIO_PRESETS = {
  NORMAL: {
    id: 'NORMAL',
    name: 'Normal Exam',
    badge: 'Baseline Operational State',
    examStatus: 'LIVE',
    riskScore: 24,
    continuityMode: false,
    affectedStudents: 5,
    erScore: 95,
    students: {
      total: 1000,
      normal: 970,
      atRisk: 25,
      affected: 5,
    },
    erBreakdown: {
      availability: 98,
      networkStability: 94,
      serverHealth: 91,
      submissionHealth: 97,
      recoveryPerformance: 95,
    },
    infrastructure: {
      latency: 48, // ms
      packetLoss: 0.5, // %
      cpu: 54, // %
      memory: 42, // %
      concurrentUsers: 992,
      loginFailures: 2,
      submissionFailures: 1,
      dbResponseTime: 18, // ms
    },
    sessions: BASELINE_SESSIONS,
    timeline: [
      { id: 'e1', time: '10:00:00', type: 'info', message: 'Exam started successfully across all 4 regional centers.' },
      { id: 'e2', time: '10:15:22', type: 'info', message: 'Biometric authorization check completed for 1,000 candidates.' },
      { id: 'e3', time: '10:28:40', type: 'success', message: 'All telemetry channels synchronized. System operating within normal thresholds.' },
    ],
    chartData: [
      { time: '10:00', latency: 42, packetLoss: 0.2, cpu: 45, users: 950, loginFailures: 12, submissionFailures: 0 },
      { time: '10:05', latency: 44, packetLoss: 0.3, cpu: 48, users: 980, loginFailures: 5, submissionFailures: 1 },
      { time: '10:10', latency: 46, packetLoss: 0.4, cpu: 52, users: 990, loginFailures: 2, submissionFailures: 0 },
      { time: '10:15', latency: 45, packetLoss: 0.3, cpu: 55, users: 995, loginFailures: 1, submissionFailures: 1 },
      { time: '10:20', latency: 48, packetLoss: 0.5, cpu: 54, users: 992, loginFailures: 2, submissionFailures: 1 },
      { time: '10:25', latency: 47, packetLoss: 0.4, cpu: 53, users: 990, loginFailures: 1, submissionFailures: 0 },
      { time: '10:30', latency: 48, packetLoss: 0.5, cpu: 54, users: 992, loginFailures: 2, submissionFailures: 1 },
    ],
  },

  NETWORK_DEGRADATION: {
    id: 'NETWORK_DEGRADATION',
    name: 'Network Degradation',
    badge: 'RegionalISP Packet Loss & Latency Spike',
    // Dynamic stages used by hook:
    stages: [
      {
        stage: 1,
        examStatus: 'LIVE',
        riskScore: 24,
        erScore: 95,
        students: { total: 1000, normal: 970, atRisk: 25, affected: 5 },
        infrastructure: { latency: 48, packetLoss: 0.5, cpu: 54, memory: 45, concurrentUsers: 990, loginFailures: 2, submissionFailures: 1, dbResponseTime: 20 },
      },
      {
        stage: 2,
        examStatus: 'AT_RISK',
        riskScore: 45,
        erScore: 91,
        students: { total: 1000, normal: 890, atRisk: 95, affected: 15 },
        infrastructure: { latency: 120, packetLoss: 2.8, cpu: 58, memory: 52, concurrentUsers: 985, loginFailures: 14, submissionFailures: 6, dbResponseTime: 35 },
      },
      {
        stage: 3,
        examStatus: 'AT_RISK',
        riskScore: 68,
        erScore: 85,
        students: { total: 1000, normal: 810, atRisk: 145, affected: 45 },
        infrastructure: { latency: 185, packetLoss: 5.5, cpu: 60, memory: 58, concurrentUsers: 982, loginFailures: 22, submissionFailures: 12, dbResponseTime: 55 },
      },
      {
        stage: 4,
        examStatus: 'CRITICAL',
        riskScore: 82,
        erScore: 74,
        students: { total: 1000, normal: 760, atRisk: 190, affected: 50 },
        infrastructure: { latency: 245, packetLoss: 8.2, cpu: 61, memory: 67, concurrentUsers: 980, loginFailures: 31, submissionFailures: 18, dbResponseTime: 85 },
      },
    ],
    // Final state target:
    examStatus: 'CRITICAL',
    riskScore: 82,
    continuityMode: false,
    affectedStudents: 74,
    erScore: 74,
    students: {
      total: 1000,
      normal: 760,
      atRisk: 190,
      affected: 50,
    },
    erBreakdown: {
      availability: 96,
      networkStability: 62,
      serverHealth: 88,
      submissionHealth: 72,
      recoveryPerformance: 85,
    },
    infrastructure: {
      latency: 245,
      packetLoss: 8.2,
      cpu: 61,
      memory: 67,
      concurrentUsers: 980,
      loginFailures: 31,
      submissionFailures: 18,
      dbResponseTime: 85,
    },
    sessions: [
      { id: 'A101', center: 'Bhopal Center', room: 'Lab 101', students: 120, status: 'NORMAL', riskScore: 18, latency: 65, packetLoss: 0.8, loginFailures: 2, submissionFailures: 0 },
      { id: 'A102', center: 'Bhopal Center', room: 'Lab 102', students: 110, status: 'NORMAL', riskScore: 25, latency: 78, packetLoss: 1.2, loginFailures: 3, submissionFailures: 1 },
      { id: 'A103', center: 'Bhopal Center', room: 'Lab 103', students: 125, status: 'AT_RISK', riskScore: 78, latency: 218, packetLoss: 5.2, loginFailures: 12, submissionFailures: 7, diagnosis: 'Severe packet jitter detected on Bhopal regional Gateway router #4.', recommendation: 'Redirect exam telemetry to secondary backup route & activate local sync cache.' },
      { id: 'A104', center: 'Indore Center', room: 'Block B-201', students: 130, status: 'AFFECTED', riskScore: 89, latency: 285, packetLoss: 9.4, loginFailures: 18, submissionFailures: 11, diagnosis: 'Upstream optical fiber line drop at Indore exchange.', recommendation: 'Engage offline local browser storage resilience fallback for ongoing submissions.' },
      { id: 'A105', center: 'Indore Center', room: 'Block B-202', students: 115, status: 'NORMAL', riskScore: 32, latency: 85, packetLoss: 1.5, loginFailures: 1, submissionFailures: 0 },
      { id: 'A106', center: 'Gwalior Center', room: 'Main Hall A', students: 140, status: 'NORMAL', riskScore: 14, latency: 45, packetLoss: 0.3, loginFailures: 0, submissionFailures: 0 },
      { id: 'A107', center: 'Gwalior Center', room: 'Main Hall B', students: 120, status: 'NORMAL', riskScore: 28, latency: 68, packetLoss: 0.9, loginFailures: 1, submissionFailures: 0 },
      { id: 'A108', center: 'Jabalpur Center', room: 'CS Lab 3', students: 140, status: 'AT_RISK', riskScore: 72, latency: 195, packetLoss: 4.8, loginFailures: 9, submissionFailures: 5, diagnosis: 'Packet retry count exceeding SLA thresholds.', recommendation: 'Throttle non-essential background telemetry streams.' },
      { id: 'A112', center: 'Bhopal Center', room: 'Lab 108', students: 100, status: 'AT_RISK', riskScore: 69, latency: 188, packetLoss: 4.1, loginFailures: 7, submissionFailures: 4, diagnosis: 'High connection handshake drop rate.', recommendation: 'Keep connection persistent via HTTP keep-alive.' },
    ],
    timeline: [
      { id: 'e1', time: '10:31:05', type: 'info', message: 'Exam underway in normal state.' },
      { id: 'e2', time: '10:32:21', type: 'warning', message: 'Network latency increased from 48 ms to 120 ms in Bhopal sub-region.' },
      { id: 'e3', time: '10:32:30', type: 'warning', message: 'Packet loss anomaly detected (5.5%). Heartbeat retries spiking.' },
      { id: 'e4', time: '10:32:38', type: 'danger', message: 'Risk score increased from 24 to 82 (CRITICAL threshold crossed).' },
      { id: 'e5', time: '10:32:42', type: 'danger', message: 'Affected sessions detected: A103, A104, A108, A112. 74 candidates experiencing submission delays.' },
    ],
    chartData: [
      { time: '10:00', latency: 45, packetLoss: 0.4, cpu: 52, users: 990, loginFailures: 2, submissionFailures: 0 },
      { time: '10:10', latency: 48, packetLoss: 0.5, cpu: 54, users: 992, loginFailures: 2, submissionFailures: 1 },
      { time: '10:20', latency: 52, packetLoss: 0.6, cpu: 55, users: 990, loginFailures: 3, submissionFailures: 1 },
      { time: '10:25', latency: 85, packetLoss: 1.8, cpu: 56, users: 988, loginFailures: 8, submissionFailures: 3 },
      { time: '10:28', latency: 140, packetLoss: 3.9, cpu: 58, users: 985, loginFailures: 16, submissionFailures: 7 },
      { time: '10:30', latency: 190, packetLoss: 6.2, cpu: 60, users: 982, loginFailures: 25, submissionFailures: 12 },
      { time: '10:32', latency: 245, packetLoss: 8.2, cpu: 61, users: 980, loginFailures: 31, submissionFailures: 18 },
    ],
  },

  LOGIN_SPIKE: {
    id: 'LOGIN_SPIKE',
    name: 'Login Spike',
    badge: 'Mass Concurrent Authentication Event',
    examStatus: 'AT_RISK',
    riskScore: 64,
    continuityMode: false,
    affectedStudents: 42,
    erScore: 82,
    students: {
      total: 1000,
      normal: 830,
      atRisk: 125,
      affected: 45,
    },
    erBreakdown: {
      availability: 88,
      networkStability: 92,
      serverHealth: 76,
      submissionHealth: 90,
      recoveryPerformance: 91,
    },
    infrastructure: {
      latency: 110,
      packetLoss: 1.2,
      cpu: 78,
      memory: 64,
      concurrentUsers: 2450, // Massive authentication surge
      loginFailures: 84,
      submissionFailures: 5,
      dbResponseTime: 42,
    },
    sessions: BASELINE_SESSIONS.map((s, idx) => {
      if (idx < 3) {
        return { ...s, status: 'AT_RISK', riskScore: 68, loginFailures: 28, latency: 115 };
      }
      return s;
    }),
    timeline: [
      { id: 'e1', time: '10:30:00', type: 'info', message: '2nd batch of late registrants initiated parallel login.' },
      { id: 'e2', time: '10:31:12', type: 'warning', message: 'Auth rate bottleneck: 2,450 concurrent auth tokens requested within 30 seconds.' },
      { id: 'e3', time: '10:31:45', type: 'danger', message: 'Login failures surged to 84 attempts/min. Risk score escalated to 64.' },
    ],
    chartData: [
      { time: '10:00', latency: 42, packetLoss: 0.3, cpu: 45, users: 950, loginFailures: 2, submissionFailures: 0 },
      { time: '10:15', latency: 45, packetLoss: 0.4, cpu: 52, users: 1050, loginFailures: 8, submissionFailures: 1 },
      { time: '10:25', latency: 68, packetLoss: 0.8, cpu: 65, users: 1800, loginFailures: 42, submissionFailures: 2 },
      { time: '10:30', latency: 110, packetLoss: 1.2, cpu: 78, users: 2450, loginFailures: 84, submissionFailures: 5 },
    ],
  },

  SERVER_OVERLOAD: {
    id: 'SERVER_OVERLOAD',
    name: 'Server Overload',
    badge: 'Compute & Memory Saturation',
    examStatus: 'CRITICAL',
    riskScore: 88,
    continuityMode: false,
    affectedStudents: 96,
    erScore: 68,
    students: {
      total: 1000,
      normal: 680,
      atRisk: 220,
      affected: 100,
    },
    erBreakdown: {
      availability: 82,
      networkStability: 89,
      serverHealth: 42,
      submissionHealth: 65,
      recoveryPerformance: 75,
    },
    infrastructure: {
      latency: 310,
      packetLoss: 2.1,
      cpu: 94, // Severe CPU throttling
      memory: 89, // Memory limit alert
      concurrentUsers: 985,
      loginFailures: 14,
      submissionFailures: 46, // Submissions dropping
      dbResponseTime: 120,
    },
    sessions: BASELINE_SESSIONS.map((s, idx) => {
      if (idx === 4 || idx === 5) {
        return { ...s, status: 'AFFECTED', riskScore: 92, submissionFailures: 16, latency: 310 };
      }
      if (idx === 2 || idx === 3) {
        return { ...s, status: 'AT_RISK', riskScore: 74, submissionFailures: 8, latency: 180 };
      }
      return s;
    }),
    timeline: [
      { id: 'e1', time: '10:35:10', type: 'warning', message: 'Main Application Cluster Node-2 CPU utilization crossed 85%.' },
      { id: 'e2', time: '10:36:00', type: 'danger', message: 'Garbage Collection freeze detected. Node CPU saturated at 94%.' },
      { id: 'e3', time: '10:36:30', type: 'danger', message: 'Submission failures spike to 46 requests. Risk score reached 88 (CRITICAL).' },
    ],
    chartData: [
      { time: '10:00', latency: 45, packetLoss: 0.3, cpu: 50, users: 990, loginFailures: 1, submissionFailures: 0 },
      { time: '10:20', latency: 55, packetLoss: 0.5, cpu: 68, users: 992, loginFailures: 3, submissionFailures: 2 },
      { time: '10:30', latency: 140, packetLoss: 1.1, cpu: 84, users: 988, loginFailures: 8, submissionFailures: 18 },
      { time: '10:36', latency: 310, packetLoss: 2.1, cpu: 94, users: 985, loginFailures: 14, submissionFailures: 46 },
    ],
  },

  DATABASE_SLOWDOWN: {
    id: 'DATABASE_SLOWDOWN',
    name: 'Database Slowdown',
    badge: 'I/O Disk Latency & Query Deadlock',
    examStatus: 'AT_RISK',
    riskScore: 76,
    continuityMode: false,
    affectedStudents: 62,
    erScore: 79,
    students: {
      total: 1000,
      normal: 780,
      atRisk: 160,
      affected: 60,
    },
    erBreakdown: {
      availability: 94,
      networkStability: 91,
      serverHealth: 80,
      submissionHealth: 61,
      recoveryPerformance: 82,
    },
    infrastructure: {
      latency: 185,
      packetLoss: 0.9,
      cpu: 68,
      memory: 74,
      concurrentUsers: 988,
      loginFailures: 8,
      submissionFailures: 62, // DB lock causing submission queue buildup
      dbResponseTime: 1450, // ms slow queries!
    },
    sessions: BASELINE_SESSIONS.map((s, idx) => {
      if (idx === 2 || idx === 3) {
        return { ...s, status: 'AFFECTED', riskScore: 84, submissionFailures: 22, latency: 190 };
      }
      if (idx === 6 || idx === 7) {
        return { ...s, status: 'AT_RISK', riskScore: 71, submissionFailures: 12, latency: 160 };
      }
      return s;
    }),
    timeline: [
      { id: 'e1', time: '10:40:05', type: 'warning', message: 'PostgreSQL connection pool utilization reached 98%.' },
      { id: 'e2', time: '10:40:45', type: 'danger', message: 'DB query latency spiked to 1,450 ms due to answer blob write locks.' },
      { id: 'e3', time: '10:41:20', type: 'danger', message: '62 submission requests timed out waiting for DB commit ACK.' },
    ],
    chartData: [
      { time: '10:00', latency: 40, packetLoss: 0.3, cpu: 48, users: 990, loginFailures: 1, submissionFailures: 0 },
      { time: '10:25', latency: 50, packetLoss: 0.4, cpu: 56, users: 992, loginFailures: 2, submissionFailures: 3 },
      { time: '10:35', latency: 95, packetLoss: 0.6, cpu: 62, users: 990, loginFailures: 4, submissionFailures: 25 },
      { time: '10:41', latency: 185, packetLoss: 0.9, cpu: 68, users: 988, loginFailures: 8, submissionFailures: 62 },
    ],
  },

  POWER_OUTAGE: {
    id: 'POWER_OUTAGE',
    name: 'Regional Power Outage',
    badge: 'Center power and network availability loss',
    examStatus: 'CRITICAL',
    riskScore: 91,
    continuityMode: true,
    affectedStudents: 340,
    erScore: 62,
    students: { total: 1000, normal: 590, atRisk: 70, affected: 340 },
    erBreakdown: { availability: 48, networkStability: 58, serverHealth: 91, submissionHealth: 54, recoveryPerformance: 68 },
    infrastructure: { latency: 520, packetLoss: 16, cpu: 52, memory: 57, concurrentUsers: 710, loginFailures: 190, submissionFailures: 260, dbResponseTime: 290 },
    sessions: BASELINE_SESSIONS.map((session, index) => index === 1 || index === 4 || index === 6
      ? { ...session, status: 'AFFECTED', riskScore: 94, latency: 520, packetLoss: 16, submissionFailures: 32 }
      : index === 2 || index === 5
        ? { ...session, status: 'AT_RISK', riskScore: 72, latency: 190, packetLoss: 5.5, submissionFailures: 12 }
        : session),
    timeline: [
      { id: 'p1', time: '10:42:00', type: 'warning', message: 'Power telemetry and site heartbeat dropped at three regional centers.' },
      { id: 'p2', time: '10:42:30', type: 'danger', message: 'Connectivity loss and delayed submissions detected for affected sessions.' },
      { id: 'p3', time: '10:43:00', type: 'danger', message: 'Continuity response recommended while center power is restored.' },
    ],
    chartData: [
      { time: '10:30', latency: 48, packetLoss: 0.5, cpu: 54, users: 992, loginFailures: 2, submissionFailures: 1 },
      { time: '10:35', latency: 120, packetLoss: 3.0, cpu: 53, users: 900, loginFailures: 45, submissionFailures: 58 },
      { time: '10:40', latency: 320, packetLoss: 9.0, cpu: 52, users: 790, loginFailures: 120, submissionFailures: 180 },
      { time: '10:43', latency: 520, packetLoss: 16, cpu: 52, users: 710, loginFailures: 190, submissionFailures: 260 },
    ],
  },
};
