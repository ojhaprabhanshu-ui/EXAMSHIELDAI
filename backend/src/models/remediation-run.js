import mongoose from "mongoose";

const actionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ["RUNNING", "COMPLETED", "FAILED"], required: true },
  startedAt: Date,
  completedAt: Date,
  details: String,
}, { _id: false });

const remediationRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true, index: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "Incident", default: null },
  cause: { type: String, required: true },
  probableCause: { type: String, required: true },
  confidence: { type: Number, min: 0, max: 1, required: true },
  evidence: { type: [String], default: [] },
  state: { type: String, enum: ["DETECTED", "DIAGNOSING", "REMEDIATING", "VERIFYING", "RECOVERED", "ESCALATED"], required: true, index: true },
  status: { type: String, enum: ["RUNNING", "SUCCEEDED", "FAILED"], required: true },
  actions: { type: [actionSchema], default: [] },
  metricsBefore: { type: mongoose.Schema.Types.Mixed, default: {} },
  metricsAfter: { type: mongoose.Schema.Types.Mixed, default: {} },
  healthCheck: { type: mongoose.Schema.Types.Mixed },
  pendingSubmissions: { type: Number, min: 0, default: 0 },
  failureReason: String,
  simulation: { type: Boolean, default: false },
  startedAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  completedAt: Date,
}, { versionKey: false });

remediationRunSchema.index({ examId: 1, startedAt: -1 });

export const RemediationRun = mongoose.models.RemediationRun ?? mongoose.model("RemediationRun", remediationRunSchema);
