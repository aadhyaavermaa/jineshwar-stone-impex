const express = require("express"),
  bcrypt = require("bcrypt");
const db = require("../database/db");
const { csrf, limit, newToken } = require("../middleware/auth");
const { string, fail, profile, tx } = require("../services/common");
const google = require("../services/google");
const auth = express.Router(),
  settings = express.Router();
function passwordRules(p) {
  if (typeof p !== "string" || p.length < 10 || Buffer.byteLength(p) > 72)
    fail(400, "Choose a password of at least 10 characters and at most 72 UTF-8 bytes.");
  return p;
}
function phoneValue(value) {
  const phone = string(value, 30, "phone number");
  if (!/^\+?[\d ()-]+$/.test(phone) || phone.replace(/\D/g, "").length < 7)
    fail(400, "Enter a valid phone number.");
  return phone;
}
function recent(req, mode) {
  if (
    !req.session.reauthAt ||
    Date.now() - req.session.reauthAt > 300000 ||
    (mode && req.session.reauthMethod !== mode)
  )
    fail(403, "Verify your identity again in Account Settings.");
}
function verified(req, method) {
  req.session.reauthAt = Date.now();
  req.session.reauthMethod = method;
}
async function establish(req, res, userId, method) {
  const ids = req.body.wishlist;
  if (Array.isArray(ids))
    tx(() => {
      const insert = db.prepare(
        "INSERT OR IGNORE INTO wishlists(user_id,product_id) SELECT ?,id FROM products WHERE id=? AND is_active=1",
      );
      for (const id of new Set(ids.slice(0, 500)))
        if (Number.isSafeInteger(id)) insert.run(userId, id);
    });
  await new Promise((resolve, reject) =>
    req.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  Object.assign(req.session, { userId, csrf: newToken() });
  verified(req, method);
  res.json({ authenticated: true, user: profile(userId), csrf: req.session.csrf });
}
auth.get("/session", (req, res) => {
  req.session.csrf ||= newToken();
  if (!req.session.googleNonce || Date.now() - req.session.nonceMade > 600000) {
    req.session.googleNonce = newToken();
    req.session.nonceMade = Date.now();
  }
  res.json({
    authenticated: Boolean(req.session.userId),
    user: req.session.userId ? profile(req.session.userId) : null,
    csrf: req.session.csrf,
    nonce: req.session.googleNonce,
    google_client_id: process.env.GOOGLE_CLIENT_ID || "",
  });
});
async function googleIdentity(req) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(req.hostname);
  if (!req.secure && !local) fail(400, "Google sign-in requires HTTPS or localhost.");
  const nonce = req.session.googleNonce,
    made = req.session.nonceMade;
  delete req.session.googleNonce;
  if (!process.env.GOOGLE_CLIENT_ID) fail(503, "Google sign-in is not configured.");
  if (!nonce || !made || Date.now() - made > 600000)
    fail(401, "Refresh Google sign-in and try again.");
  return google.identity(req.body.credential, nonce);
}
auth.use(csrf);
auth.post("/signup", limit(15), async (req, res) => {
  const b = req.body || {},
    name = string(b.name, 100, "name"),
    email = string(b.email, 254, "email").toLowerCase(),
    phone = phoneValue(b.phone);
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, "Enter a valid email.");
  const password = passwordRules(b.password);
  if (b.confirm_password !== undefined && password !== b.confirm_password)
    fail(400, "Passwords must match.");
  const hash = await bcrypt.hash(password, 12);
  const result = db
    .prepare(
      "INSERT INTO users(name,email,phone,password_hash) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING",
    )
    .run(name, email, phone, hash);
  if (!result.changes) fail(409, "This email is already registered. Sign in to continue.");
  res.status(201);
  await establish(req, res, Number(result.lastInsertRowid), "password");
});
auth.post("/login", limit(20), async (req, res) => {
  const email = string(req.body.email, 254, "email"),
    p = req.body.password;
  const user = db.prepare("SELECT id,password_hash FROM users WHERE email=?").get(email);
  if (
    typeof p !== "string" ||
    Buffer.byteLength(p) > 72 ||
    !user?.password_hash ||
    !(await bcrypt.compare(p, user.password_hash))
  )
    fail(401, "Email or password is incorrect.");
  await establish(req, res, user.id, "password");
});
auth.post("/google", limit(30), async (req, res) => {
  const claims = await googleIdentity(req);
  let user = db.prepare("SELECT id FROM users WHERE google_sub=?").get(claims.sub);
  if (!user) {
    if (db.prepare("SELECT id FROM users WHERE email=?").get(claims.email))
      fail(409, "Sign in to the existing account and confirm the connection in Account Settings.");
    const r = db
      .prepare("INSERT INTO users(name,email,google_sub) VALUES(?,?,?)")
      .run(claims.name, claims.email, claims.sub);
    user = { id: Number(r.lastInsertRowid) };
  }
  await establish(req, res, user.id, "google");
});
auth.post("/logout", (req, res) => {
  if (!req.session.userId) fail(401, "Customer sign-in required.");
  req.session.destroy((e) =>
    e
      ? res.status(500).json({ error: "Unable to sign out." })
      : res.clearCookie("stone.sid").json({ ok: true }),
  );
});
settings.get("/profile", (req, res) => res.json(profile(req.session.userId)));
settings.patch("/profile", (req, res) => {
  db.prepare("UPDATE users SET name=?, phone=?,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?").run(
    string(req.body.name, 100, "name"),
    phoneValue(req.body.phone),
    req.session.userId,
  );
  res.json(profile(req.session.userId));
});
function account(req) {
  return db
    .prepare("SELECT id,email,password_hash,google_sub FROM users WHERE id=?")
    .get(req.session.userId);
}
async function checkPassword(req, current) {
  const user = account(req);
  if (
    typeof current !== "string" ||
    Buffer.byteLength(current) > 72 ||
    !user.password_hash ||
    !(await bcrypt.compare(current, user.password_hash))
  )
    fail(401, "Current password is incorrect.");
  return user.password_hash;
}
settings.post("/reauth", limit(20), async (req, res) => {
  if (req.body.credential) {
    const claims = await googleIdentity(req);
    if (claims.sub !== account(req).google_sub) fail(403, "Choose the connected Google account.");
    verified(req, "google");
  } else {
    await checkPassword(req, req.body.password);
    verified(req, "password");
  }
  res.json({ ok: true });
});
settings.patch("/password", limit(15), async (req, res) => {
  const old = await checkPassword(req, req.body.current_password),
    hash = await bcrypt.hash(passwordRules(req.body.password), 12);
  const r = db
    .prepare(
      "UPDATE users SET password_hash=?,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=? AND password_hash=?",
    )
    .run(hash, req.session.userId, old);
  if (!r.changes) fail(409, "Account changed. Try again.");
  verified(req, "password");
  res.json({ ok: true });
});
settings.post("/auth/google/link", limit(20), async (req, res) => {
  recent(req);
  if (req.body.confirm !== true) fail(400, "Confirm linking this Google account.");
  const claims = await googleIdentity(req),
    user = account(req);
  if (
    claims.email !== user.email.toLowerCase() ||
    (user.google_sub && user.google_sub !== claims.sub)
  )
    fail(409, "Choose the Google identity matching this account.");
  const other = db
    .prepare("SELECT id FROM users WHERE google_sub=? AND id!=?")
    .get(claims.sub, user.id);
  if (other) fail(409, "This Google identity is already connected.");
  db.prepare("UPDATE users SET google_sub=?,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?").run(
    claims.sub,
    user.id,
  );
  res.json({ ok: true });
});
settings.post("/auth/google/unlink", (req, res) => {
  recent(req);
  if (!account(req).password_hash) fail(409, "Set a local password before disconnecting Google.");
  db.prepare("UPDATE users SET google_sub=NULL,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?").run(
    req.session.userId,
  );
  res.json({ ok: true });
});
settings.post("/auth/password/set", limit(15), async (req, res) => {
  recent(req, "google");
  const hash = await bcrypt.hash(passwordRules(req.body.password), 12);
  const r = db
    .prepare(
      "UPDATE users SET password_hash=?,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=? AND password_hash IS NULL AND google_sub IS NOT NULL",
    )
    .run(hash, req.session.userId);
  if (!r.changes) fail(409, "Use change password for this account.");
  res.json({ ok: true });
});
module.exports = { auth, settings };
