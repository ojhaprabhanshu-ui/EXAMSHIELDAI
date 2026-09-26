import mongoose from "mongoose";

const auditEventSchema = new mongoose.Schema({
  stream: { type: String, required: true, default: "platform" },
  sequence: { type: Number, required: true, min: 1 },
  occurredAt: { type: Date, required: true },
  actorId: mongoose.Schema.Types.ObjectId,
  actorRole: { type: String, enum: ["Admin", "Examiner", "Moderator", "SYSTEM"] },
  eventType: { type: String, required: true, maxlength: 120 },
  entityType: { type: String, required: true, maxlength: 80 },
  entityId: { type: String, required: true, maxlength: 128 },
  correlationId: { type: String, maxlength: 128 },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "Incident" },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  previousHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  eventHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
}, { timestamps: false, versionKey: false });

auditEventSchema.index({ stream: 1, sequence: 1 }, { unique: true });
auditEventSchema.index({ entityType: 1, entityId: 1, sequence: 1 });

export const AuditEvent = mongoose.models.AuditEvent ?? mongoose.model("AuditEvent", auditEventSchema);
