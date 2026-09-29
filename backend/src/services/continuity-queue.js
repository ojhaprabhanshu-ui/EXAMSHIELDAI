import { randomUUID } from "node:crypto";

export class ContinuityQueue {
  #items = new Map();

  constructor({ maxItems = 10_000 } = {}) {
    this.maxItems = maxItems;
  }

  enqueue({ examId, sessionId, submissionId, revision, payload }) {
    if (!examId || !sessionId || !submissionId || !Number.isInteger(revision) || revision < 0) {
      throw new TypeError("examId, sessionId, submissionId, and a non-negative integer revision are required");
    }
    const key = `${sessionId}:${submissionId}`;
    const existing = this.#items.get(key);
    if (existing) return { item: structuredClone(existing), duplicate: true };
    if (this.#items.size >= this.maxItems) {
      for (const [completedKey, item] of this.#items) {
        if (item.status === "COMPLETED") this.#items.delete(completedKey);
        if (this.#items.size < this.maxItems) break;
      }
    }
    if (this.#items.size >= this.maxItems) {
      const error = new Error("Continuity queue is at capacity");
      error.status = 503;
      throw error;
    }
    const item = {
      id: randomUUID(), examId: String(examId), sessionId: String(sessionId), submissionId,
      revision, payload: structuredClone(payload), status: "PENDING", attempts: 0,
      nextAttemptAt: new Date(), createdAt: new Date(),
    };
    this.#items.set(key, item);
    return { item: structuredClone(item), duplicate: false };
  }

  get(sessionId, submissionId) {
    const item = this.#items.get(`${sessionId}:${submissionId}`);
    return item ? structuredClone(item) : null;
  }

  due(now = new Date(), limit = 100) {
    return [...this.#items.values()]
      .filter((item) => item.status === "PENDING" && item.nextAttemptAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((item) => structuredClone(item));
  }

  markProcessing(id) { return this.#update(id, (item) => { item.status = "PROCESSING"; }); }
  markCompleted(id) { return this.#update(id, (item) => { item.status = "COMPLETED"; item.completedAt = new Date(); }); }

  markFailed(id, error, { maxAttempts = Number.POSITIVE_INFINITY, baseDelayMs = 1000, maxDelayMs = 60_000 } = {}) {
    return this.#update(id, (item) => {
      item.attempts += 1;
      item.lastError = String(error?.message ?? error).slice(0, 1000);
      item.status = item.attempts >= maxAttempts ? "FAILED" : "PENDING";
      item.nextAttemptAt = new Date(Date.now() + Math.min(baseDelayMs * 2 ** (item.attempts - 1), maxDelayMs));
    });
  }

  requeueProcessing() {
    for (const item of this.#items.values()) {
      if (item.status === "PROCESSING") item.status = "PENDING";
    }
  }

  counts(examId, sessionId) {
    const items = [...this.#items.values()].filter((item) =>
      (examId === undefined || item.examId === String(examId))
      && (sessionId === undefined || item.sessionId === String(sessionId)));
    return items.reduce((result, item) => {
      result[item.status] = (result[item.status] ?? 0) + 1;
      return result;
    }, { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 });
  }

  #update(id, mutate) {
    const item = [...this.#items.values()].find((candidate) => candidate.id === id);
    if (!item) return null;
    mutate(item);
    return structuredClone(item);
  }
}
