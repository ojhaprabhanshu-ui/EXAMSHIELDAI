import mongoose from "mongoose";

const telemetrySchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentSession", index: true },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "Incident" },
  observedAt: { type: Date, required: true, index: true },
  receivedAt: { type: Date, default: Date.now },
  source: { type: String, required: true, maxlength: 100 },
  signalType: { type: String, required: true, maxlength: 100, index: true },
  value: mongoose.Schema.Types.Mixed,
  unit: { type: String, maxlength: 40 },
  severity: { type: String, enum: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "INFO" },
  riskScore: { type: Number, min: 0, max: 100 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
}, { timestamps: false, versionKey: false });

telemetrySchema.index({ examId: 1, observedAt: -1 });
telemetrySchema.index({ signalType: 1, observedAt: -1 });

export const Telemetry = mongoose.models.Telemetry ?? mongoose.model("Telemetry", telemetrySchema);
