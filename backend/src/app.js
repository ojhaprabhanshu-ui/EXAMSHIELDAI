import express from "express";
import mongoose from "mongoose";
import { apiRouter } from "./routes/api.js";
import { authenticateJwt } from "./middleware/jwt-auth.js";
import { corsMiddleware } from "./middleware/cors.js";

export function createApp({ io, continuity } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(corsMiddleware);
  app.use(express.json({ limit: "256kb", strict: true }));
  app.locals.io = io;
  app.locals.continuity = continuity;
  let databaseInitialized = false;
  app.locals.setDatabaseReady = (ready) => { databaseInitialized = Boolean(ready); };
  app.locals.databaseReady = () => databaseInitialized && mongoose.connection.readyState === 1;
  app.use("/api", authenticateJwt);
  app.use("/api", apiRouter);
  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const transactionUnsupported = error?.code === 20
      || error?.codeName === "IllegalOperation"
      || /transaction numbers are only allowed on a replica set member|transactions? are not supported by this deployment/i.test(error?.message ?? "");
    if (transactionUnsupported) {
      console.error("MongoDB transaction support is required for this operation. Configure the database as a replica set or use a transaction-capable cluster.");
      return res.status(503).json({ error: "Database transaction support is not enabled. Configure MongoDB as a replica set, then restart the backend." });
    }
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error("Request failed", { message: error.message, path: req.path });
    return res.status(status).json({ error: status >= 500 ? "Internal server error" : error.message });
  });
  return app;
}
