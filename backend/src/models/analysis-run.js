import mongoose from "mongoose";

const analysisRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true, index: true },
  scenario: { type: String, required: true, maxlength: 60 },
  mode: { type: String, enum: ["SIMULATED"], default: "SIMULATED" },
  entityCount: { type: Number, required: true, min: 1 },
  riskScore: { type: Number, required: true, min: 0, max: 100 },
  status: { type: String, enum: ["NORMAL", "AT_RISK", "CRITICAL"], required: true },
  rootCause: { type: String, required: true, maxlength: 200 },
  affectedStudents: { type: Number, required: true, min: 0 },
  estimatedDowntimeMinutes: { type: Number, required: true, min: 0 },
  report: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

analysisRunSchema.index({ createdAt: -1 });

export const AnalysisRun = mongoose.models.AnalysisRun ?? mongoose.model("AnalysisRun", analysisRunSchema);
