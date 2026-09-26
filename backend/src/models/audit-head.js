import mongoose from "mongoose";

const auditHeadSchema = new mongoose.Schema({
  stream: { type: String, required: true, unique: true },
  sequence: { type: Number, required: true, min: 0 },
  headHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
}, { versionKey: false });

export const AuditHead = mongoose.models.AuditHead ?? mongoose.model("AuditHead", auditHeadSchema);
