import mongoose from "mongoose";
import { config } from "../config.js";
import { AuditHead } from "../models/audit-head.js";
import { GENESIS_HASH } from "./audit-chain.js";

const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

function wait(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

export async function connectDatabase(uri = config.mongoUri, { signal, onConnected, onDisconnected } = {}) {
  if (!uri) {
    console.warn("MongoDB is not connected: MONGODB_URI is blank.");
    return false;
  }

  mongoose.set("strictQuery", true);
  mongoose.connection.on("error", () => console.error("MongoDB connection error."));

  let attempt = 0;
  while (!signal?.aborted) {
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          maxPoolSize: 20,
          minPoolSize: 0,
          autoIndex: false,
        });
        await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
        await AuditHead.updateOne(
          { stream: "platform" },
          { $setOnInsert: { stream: "platform", sequence: 0, headHash: GENESIS_HASH } },
          { upsert: true },
        );
        attempt = 0;
        console.info("MongoDB connected.");
        await onConnected?.();
      } catch (error) {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
        attempt += 1;
        const exponentialDelay = Math.min(BASE_RETRY_MS * 2 ** Math.min(attempt - 1, 10), MAX_RETRY_MS);
        const jitteredDelay = Math.round(exponentialDelay * (0.8 + Math.random() * 0.4));
        const failureType = error?.cause?.code ?? error?.code ?? error?.name ?? "UnknownError";
        console.error(`MongoDB connection attempt ${attempt} failed (${failureType}); retrying in ${jitteredDelay}ms.`);
        await wait(jitteredDelay, signal);
        continue;
      }
    }

    await new Promise((resolve) => {
      if (signal?.aborted) return resolve();
      const onDisconnectedEvent = () => finish();
      const onAbort = () => finish();
      const finish = () => {
        mongoose.connection.removeListener("disconnected", onDisconnectedEvent);
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      mongoose.connection.once("disconnected", onDisconnectedEvent);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    await onDisconnected?.();
  }
  return false;
}
