import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  status: { type: String, enum: ["ACTIVE", "SUBMITTED", "EXPIRED", "INTERRUPTED"], default: "ACTIVE", index: true },
  startedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  answerRevision: { type: Number, default: 0, min: 0 },
  lastSubmission: {
    submissionId: String,
    revision: Number,
    acceptedAt: Date,
  },
  continuity: {
    active: { type: Boolean, default: false },
    activatedAt: Date,
  },
  clientState: { type: mongoose.Schema.Types.Mixed, default: undefined },
}, { timestamps: true, optimisticConcurrency: true });

sessionSchema.index({ examId: 1, studentId: 1 }, { unique: true });
sessionSchema.index({ examId: 1, status: 1 });
sessionSchema.index({ expiresAt: 1 });

export const StudentSession = mongoose.models.StudentSession ?? mongoose.model("StudentSession", sessionSchema);
