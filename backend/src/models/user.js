import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 320 },
  displayName: { type: String, required: true, trim: true, maxlength: 160 },
  role: { type: String, enum: ["Admin", "Examiner", "Moderator"], required: true, index: true },
  active: { type: Boolean, default: true, index: true },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
