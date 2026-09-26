import mongoose from "mongoose";

const recoveryItemSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentSession", required: true, index: true },
  submissionId: { type: String, required: true, maxlength: 128 },
  revision: { type: Number, required: true, min: 0 },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"], default: "PENDING", index: true },
  attempts: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastError: { type: String, maxlength: 1000 },
  completedAt: Date,
}, { timestamps: true, optimisticConcurrency: true });

recoveryItemSchema.index({ sessionId: 1, submissionId: 1 }, { unique: true });
recoveryItemSchema.index({ status: 1, nextAttemptAt: 1 });

export const RecoveryItem = mongoose.models.RecoveryItem ?? mongoose.model("RecoveryItem", recoveryItemSchema);
