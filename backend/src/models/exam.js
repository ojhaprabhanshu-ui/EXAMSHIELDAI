import mongoose from "mongoose";

const riskSchema = new mongoose.Schema({
  score: { type: Number, min: 0, max: 100, default: 0 },
  threshold: { type: Number, min: 0, max: 100, default: 70 },
  reasons: { type: [String], default: [] },
  evaluatedAt: Date,
}, { _id: false });

const continuitySchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  activatedAt: Date,
  recoveredAt: Date,
  pendingCount: { type: Number, min: 0, default: 0 },
}, { _id: false });

const examSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  status: { type: String, enum: ["DRAFT", "SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"], default: "DRAFT", index: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  durationSeconds: { type: Number, required: true, min: 1 },
  state: { type: String, enum: ["NORMAL", "AT_RISK", "AFFECTED", "CONTINUITY_ACTIVE", "RECOVERING", "RECOVERED"], default: "NORMAL", index: true },
  stateVersion: { type: Number, default: 0, min: 0 },
  stateChangedAt: Date,
  stateReason: { type: String, maxlength: 500 },
  risk: { type: riskSchema, default: () => ({}) },
  continuity: { type: continuitySchema, default: () => ({}) },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, optimisticConcurrency: true });

examSchema.index({ status: 1, startsAt: 1 });

export const Exam = mongoose.models.Exam ?? mongoose.model("Exam", examSchema);
