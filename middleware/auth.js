const crypto = require("node:crypto");
function authenticated(req, res, next) {
  if (req.session.adminId) return next();
  res.status(401).json({ error: "Please sign in." });
}
function csrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("X-CSRF-Token") && req.get("X-CSRF-Token") === req.session.csrf) return next();
  res.status(403).json({
    code: "CSRF_MISMATCH",
    error: "Session verification failed. Refresh and try again.",
  });
}
// A bounded, process-local counter is sufficient for a single local classroom server.
function limit(max) {
  const hits = new Map();
  const timer = setInterval(() => {
    for (const [key, row] of hits) if (row.end <= Date.now()) hits.delete(key);
  }, 60000);
  timer.unref();
  return (req, res, next) => {
    const key = req.ip,
      now = Date.now();
    let row = hits.get(key);
    if (!row || row.end <= now) {
      row = { count: 0, end: now + 600000 };
      hits.set(key, row);
    }
    if (++row.count > max)
      return res
        .status(429)
        .set("Retry-After", String(Math.ceil((row.end - now) / 1000)))
        .json({ error: "Too many attempts. Try again later." });
    next();
  };
}
module.exports = {
  authenticated,
  csrf,
  limit,
  newToken: () => crypto.randomBytes(24).toString("hex"),
};
