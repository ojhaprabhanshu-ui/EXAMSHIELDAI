import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", index: true },
  status: { type: String, enum: ["OPEN", "MITIGATING", "RESOLVED"], default: "OPEN", index: true },
  severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
  title: { type: String, required: true, maxlength: 200 },
  summary: { type: String, maxlength: 2000 },
  reasonCodes: { type: [String], default: [] },
  openedAt: { type: Date, default: Date.now },
  resolvedAt: Date,
}, { timestamps: true });

incidentSchema.index({ status: 1, openedAt: -1 });

export const Incident = mongoose.models.Incident ?? mongoose.model("Incident", incidentSchema);
