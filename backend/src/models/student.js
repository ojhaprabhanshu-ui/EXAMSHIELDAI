import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  studentNumber: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, lowercase: true, trim: true, maxlength: 320 },
  displayName: { type: String, required: true, trim: true, maxlength: 160 },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

studentSchema.index({ studentNumber: 1 }, { unique: true });
studentSchema.index({ email: 1 }, { unique: true, sparse: true });

export const Student = mongoose.models.Student ?? mongoose.model("Student", studentSchema);
