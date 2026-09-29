const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function allowedOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set([...LOCAL_ORIGINS, ...configured]);
}

export function isAllowedOrigin(origin) {
  return !origin || allowedOrigins().has(origin.replace(/\/$/, ""));
}

export function corsMiddleware(req, res, next) {
  const origin = req.get("origin");
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: "Origin is not allowed" });
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
}
