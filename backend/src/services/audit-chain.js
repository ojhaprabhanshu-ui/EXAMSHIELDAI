import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { AuditEvent } from "../models/audit-event.js";
import { AuditHead } from "../models/audit-head.js";

export const GENESIS_HASH = "0".repeat(64);

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function hashAuditEvent(event) {
  const content = {
    stream: event.stream,
    sequence: event.sequence,
    occurredAt: event.occurredAt,
    actorId: event.actorId?.toString?.() ?? event.actorId ?? null,
    actorRole: event.actorRole ?? null,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: String(event.entityId),
    correlationId: event.correlationId ?? null,
    incidentId: event.incidentId?.toString?.() ?? event.incidentId ?? null,
    payload: event.payload ?? {},
    previousHash: event.previousHash,
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(content))).digest("hex");
}

export function verifyAuditEvents(events, { firstSequence = 1, previousHash = GENESIS_HASH } = {}) {
  let expectedSequence = firstSequence;
  let expectedHash = previousHash;
  for (const event of events) {
    if (event.sequence !== expectedSequence) {
      return { valid: false, verifiedThrough: expectedSequence - 1, brokenAt: event.sequence, reason: "SEQUENCE_GAP" };
    }
    if (event.previousHash !== expectedHash) {
      return { valid: false, verifiedThrough: expectedSequence - 1, brokenAt: event.sequence, reason: "PREVIOUS_HASH_MISMATCH" };
    }
    const computed = hashAuditEvent(event);
    if (computed !== event.eventHash) {
      return { valid: false, verifiedThrough: expectedSequence - 1, brokenAt: event.sequence, reason: "EVENT_HASH_MISMATCH" };
    }
    expectedHash = event.eventHash;
    expectedSequence += 1;
  }
  return { valid: true, verifiedThrough: expectedSequence - 1, headHash: expectedHash };
}

// Persistence adapters must provide an atomic append operation so concurrent
// writers cannot choose the same sequence or create two branches in the chain.
export async function appendAuditEvent(event, atomicAppend) {
  if (typeof atomicAppend !== "function") throw new TypeError("atomicAppend adapter is required");
  const occurredAt = event.occurredAt ?? new Date();
  return atomicAppend(async ({ sequence, previousHash }) => {
    const record = { ...event, sequence, occurredAt, previousHash: previousHash ?? GENESIS_HASH };
    record.eventHash = hashAuditEvent(record);
    return record;
  });
}

export async function appendAuditEventInSession(event, session) {
  if (!session) throw new TypeError("MongoDB transaction session is required");
  const stream = event.stream ?? "platform";
  let head = await AuditHead.findOne({ stream }).session(session);
  if (!head) {
    [head] = await AuditHead.create([{ stream, sequence: 0, headHash: GENESIS_HASH }], { session });
  }
  const record = {
    ...event,
    stream,
    sequence: head.sequence + 1,
    occurredAt: event.occurredAt ?? new Date(),
    previousHash: head.headHash,
  };
  record.eventHash = hashAuditEvent(record);
  const update = await AuditHead.updateOne(
    { _id: head._id, sequence: head.sequence, headHash: head.headHash },
    { $set: { sequence: record.sequence, headHash: record.eventHash } },
    { session },
  );
  if (update.matchedCount !== 1) {
    const error = new Error("Audit head changed during append");
    error.errorLabels = ["TransientTransactionError"];
    throw error;
  }
  const [saved] = await AuditEvent.create([record], { session });
  return saved.toObject();
}

export async function appendAuditEventAtomically(event) {
  const session = await mongoose.startSession();
  try {
    let saved;
    await session.withTransaction(async () => {
      saved = await appendAuditEventInSession(event, session);
    });
    return saved;
  } finally {
    await session.endSession();
  }
}
