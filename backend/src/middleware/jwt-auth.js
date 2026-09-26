import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../config.js";

const ALLOWED_ROLES = new Set(["Admin", "Examiner", "Moderator", "Student"]);

export function verifyAccessToken(token) {
  if (!config.jwtSecret) {
    const error = new Error("Authentication is not configured");
    error.code = "AUTH_NOT_CONFIGURED";
    throw error;
  }
  if (Buffer.byteLength(config.jwtSecret, "utf8") < 32) {
    const error = new Error("JWT_SECRET must be at least 32 bytes");
    error.code = "AUTH_NOT_CONFIGURED";
    throw error;
  }
  try {
    const claims = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: "examshield",
      audience: "examshield-api",
    });
    const role = claims.role;
    if (typeof claims.sub !== "string" || !mongoose.isValidObjectId(claims.sub) || !ALLOWED_ROLES.has(role)) {
      const error = new Error("Invalid token claims");
      error.code = "INVALID_TOKEN";
      throw error;
    }
    return { id: claims.sub, role };
  } catch (cause) {
    if (cause.code === "AUTH_NOT_CONFIGURED" || cause.code === "INVALID_TOKEN") throw cause;
    const error = new Error("Invalid or expired token");
    error.code = "INVALID_TOKEN";
    throw error;
  }
}

export function authenticateJwt(req, res, next) {
  if (req.path === "/health" && req.method === "GET") return next();
  if (req.path === "/auth/login" && req.method === "POST") return next();
  const match = /^Bearer\s+(.+)$/i.exec(req.get("authorization") ?? "");
  if (!match) return res.status(401).json({ error: "Bearer token required" });
  try {
    req.user = verifyAccessToken(match[1]);
    return next();
  } catch (error) {
    const status = error.code === "AUTH_NOT_CONFIGURED" ? 503 : 401;
    return res.status(status).json({ error: error.message });
  }
}
