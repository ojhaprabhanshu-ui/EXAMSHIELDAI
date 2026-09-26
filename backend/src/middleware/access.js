const ROLES = new Set(["Admin", "Examiner", "Moderator", "Student"]);

// A JWT verifier is intentionally not installed here. Until one is approved and
// configured, protected endpoints fail closed unless trusted middleware has
// supplied req.user.
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !user.id || !ROLES.has(user.role)) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient role" });
    }
    return next();
  };
}

export function requireDatabase(req, res, next) {
  if (req.app.locals.databaseReady?.()) return next();
  return res.status(503).json({ error: "Database is not connected" });
}
