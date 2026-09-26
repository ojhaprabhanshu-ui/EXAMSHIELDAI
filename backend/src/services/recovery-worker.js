export class RecoveryWorker {
  constructor({ queue, submit, emit = () => {}, afterComplete = async () => {}, batchSize = 50, intervalMs = 1000 }) {
    if (!queue || typeof submit !== "function") throw new TypeError("queue and submit adapter are required");
    this.queue = queue;
    this.submit = submit;
    this.emit = emit;
    this.afterComplete = afterComplete;
    this.batchSize = batchSize;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.timer) return;
    this.queue.requeueProcessing();
    this.timer = setInterval(() => void this.drain(), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      for (const item of this.queue.due(new Date(), this.batchSize)) {
        this.queue.markProcessing(item.id);
        try {
          await this.submit(item);
          const completed = this.queue.markCompleted(item.id);
          this.emit("continuity:submission-recovered", completed);
          try { await this.afterComplete(completed); }
          catch (error) { console.error("Recovery finalization will retry after reconnection.", error.message); }
        } catch (error) {
          const retried = this.queue.markFailed(item.id, error);
          this.emit("continuity:submission-retry", retried);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
