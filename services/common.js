const db = require("../database/db");
function fail(status, message) {
  throw Object.assign(new Error(message), { status, publicMessage: message });
}
function string(value, max, field, optional = false) {
  if (optional && (value == null || value === "")) return "";
  if (typeof value !== "string" || (!optional && !value.trim()) || value.length > max)
    fail(400, "Check " + field + ".");
  return value.trim();
}
function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
function customer(req, res, next) {
  if (req.session.userId && !req.session.adminId) return next();
  return res.status(401).json({ error: "Please sign in to your customer account." });
}
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const userFields =
  "id,name,email,phone,created_at,updated_at,password_hash IS NOT NULL AS has_password, google_sub IS NOT NULL AS google_linked";
function profile(id) {
  return db.prepare("SELECT " + userFields + " FROM users WHERE id=?").get(id) || null;
}
function note(e, type, message) {
  if (e.user_id)
    db.prepare(
      "INSERT INTO notifications(user_id,enquiry_id,notification_type,message) VALUES(?,?,?,?)",
    ).run(e.user_id, e.id, type, message);
}
module.exports = { fail, string, tx, customer, today, profile, note };
