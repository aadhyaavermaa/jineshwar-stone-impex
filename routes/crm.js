const express = require("express"),
  crypto = require("node:crypto");
const db = require("../database/db"),
  { fail, string, tx, note, today } = require("../services/common");
const mail = require("../services/mail"),
  { limit } = require("../middleware/auth");
const admin = express.Router(),
  user = express.Router();
const base =
  "SELECT e.*,p.name AS product_name,p.product_code FROM enquiries e LEFT JOIN products p ON p.id=e.product_id";
const quotes =
  "SELECT q.*,e.reference_number AS enquiry_reference FROM quotations q JOIN enquiries e ON e.id=q.enquiry_id";
function enquiry(id, owner) {
  const row =
    owner === undefined
      ? db.prepare(base + " WHERE e.id=?").get(id)
      : db.prepare(base + " WHERE e.id=? AND e.user_id=?").get(id, owner);
  if (!row) fail(404, "Enquiry unavailable.");
  delete row.tracking_token_hash;
  return row;
}
function details(row) {
  return {
    ...row,
    quotations: db.prepare(quotes + " WHERE q.enquiry_id=? ORDER BY version DESC").all(row.id),
  };
}
function list(owner) {
  const rows =
    owner === undefined
      ? db.prepare(base + " ORDER BY e.id DESC").all()
      : db.prepare(base + " WHERE e.user_id=? ORDER BY e.id DESC").all(owner);
  for (const row of rows) delete row.tracking_token_hash;
  return rows;
}
admin.get("/enquiries", (req, res) => res.json(list()));
admin.get("/enquiries/:id", (req, res) => res.json(details(enquiry(req.params.id))));
user.get("/enquiries", (req, res) => res.json(list(req.session.userId)));
user.get("/enquiries/:id", (req, res) =>
  res.json(details(enquiry(req.params.id, req.session.userId))),
);
admin.get("/customers", (req, res) =>
  res.json(
    db
      .prepare(
        "SELECT u.id,u.name,u.email,u.phone,u.created_at,COUNT(e.id) AS request_count FROM users u LEFT JOIN enquiries e ON e.user_id=u.id GROUP BY u.id ORDER BY u.id DESC",
      )
      .all(),
  ),
);
admin.get("/customers/:id/enquiries", (req, res) => res.json(list(req.params.id)));
const sampleSteps = [
  "Submitted",
  "Under Review",
  "Approved",
  "Dispatched",
  "Completed",
  "Declined",
];
const normalSteps = ["Submitted", "Under Review", "Completed"];
admin.patch("/enquiries/:id", (req, res) => {
  const e = enquiry(req.params.id),
    b = req.body;
  const msg = string(b.admin_response ?? e.admin_response, 3000, "studio response", true),
    status = b.status ?? e.status;
  const latest = db
    .prepare("SELECT decision FROM quotations WHERE enquiry_id=? ORDER BY version DESC LIMIT 1")
    .get(e.id);
  if (status !== e.status) {
    const allowed = e.enquiry_type === "sample_request" ? sampleSteps : normalSteps;
    if (!allowed.includes(status))
      fail(400, "This status requires the appropriate enquiry or quotation action.");
    if (latest && (latest.decision !== "Accepted" || status !== "Completed"))
      fail(409, "Use the quotation workflow for this enquiry.");
  }
  tx(() => {
    db.prepare(
      "UPDATE enquiries SET status=?,admin_response=?,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?",
    ).run(status, msg, e.id);
    if (status !== e.status) note(e, "status", "Status updated to " + status + ".");
    if (msg !== e.admin_response) note(e, "response", "The studio updated its response.");
  });
  if (status !== e.status || msg !== e.admin_response)
    void mail.event(e, "Studio update: " + status + ". " + msg);
  res.json({ ok: true });
});
function thread(router, staff) {
  const owner = (req) => (staff ? undefined : req.session.userId);
  router.get("/enquiries/:id/messages", (req, res) => {
    const e = enquiry(req.params.id, owner(req));
    res.json(
      db
        .prepare(
          "SELECT id,enquiry_id,sender_type,message,created_at FROM enquiry_messages WHERE enquiry_id=? ORDER BY id",
        )
        .all(e.id),
    );
  });
  router.post("/enquiries/:id/messages", limit(60), (req, res) => {
    const e = enquiry(req.params.id, owner(req)),
      body = string(req.body.message, 3000, "message");
    if (!e.user_id)
      fail(409, "This guest request must be claimed before a private conversation can begin.");
    tx(() => {
      db.prepare(
        "INSERT INTO enquiry_messages(enquiry_id,sender_type,sender_id,message) VALUES(?,?,?,?)",
      ).run(
        e.id,
        staff ? "admin" : "customer",
        staff ? req.session.adminId : req.session.userId,
        body,
      );
      db.prepare("UPDATE enquiries SET updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?").run(e.id);
      if (staff) note(e, "message", "A new studio message is available.");
    });
    void mail.event(
      e,
      staff
        ? "The studio replied in your enquiry conversation."
        : "A customer sent a follow-up in the enquiry conversation.",
      !staff,
    );
    res.status(201).json({ ok: true });
  });
}
thread(admin, true);
thread(user, false);
function decimal(value, max, field) {
  if (
    !["number", "string"].includes(typeof value) ||
    !/^\d{1,10}(\.\d{1,2})?$/.test(String(value)) ||
    Number(value) > max
  )
    fail(400, "Enter a valid " + field + " with up to two decimal places.");
  return Math.round(Number(value) * 100);
}
admin.patch("/enquiries/:id/quotation", (req, res) => {
  const e = enquiry(req.params.id),
    b = req.body;
  if (e.enquiry_type !== "quotation" || e.status === "Completed")
    fail(409, "Choose an open quotation request.");
  const rate = decimal(b.rate, 1e8, "unit rate"),
    transport = decimal(b.transport ?? 0, 1e9, "transport charge"),
    extra = decimal(b.additional ?? 0, 1e9, "additional charge"),
    tax = decimal(b.tax_percent ?? 0, 100, "tax percentage");
  const subtotal = Math.round(e.quantity * rate),
    net = subtotal + transport + extra,
    vat = Math.round((net * tax) / 10000),
    total = net + vat;
  if (!Number.isSafeInteger(total) || total > 1e14)
    fail(400, "Quotation amount is outside the supported range.");
  const until = string(b.valid_until, 10, "validity date"),
    date = new Date(until + "T00:00:00Z");
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== until || until < today())
    fail(400, "Select a valid current or future date.");
  const terms = string(b.terms, 3000, "terms", true),
    response = string(b.admin_response, 3000, "response", true);
  const id = tx(() => {
    const previous = db
      .prepare(
        "SELECT decision,version FROM quotations WHERE enquiry_id=? ORDER BY version DESC LIMIT 1",
      )
      .get(e.id);
    if (previous?.decision === "Accepted") fail(409, "An accepted quotation is locked.");
    if (b.version !== (previous?.version || 0))
      fail(409, "Quotation changed. Refresh the enquiry before issuing another version.");
    const version = (previous?.version || 0) + 1;
    const ref =
      "Q-" + e.id + "-V" + version + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const r = db
      .prepare(
        "INSERT INTO quotations(enquiry_id,version,reference_number,product_name,customer_name,quantity,quantity_unit,rate,subtotal,transport,additional,tax_percent,tax_amount,total,valid_until,terms,admin_response) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        e.id,
        version,
        ref,
        e.product_name,
        e.customer_name,
        e.quantity,
        e.quantity_unit,
        rate / 100,
        subtotal / 100,
        transport / 100,
        extra / 100,
        tax / 100,
        vat / 100,
        total / 100,
        until,
        terms,
        response,
      );
    db.prepare(
      "UPDATE enquiries SET status='Quotation Prepared',admin_response=?,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?",
    ).run(response, e.id);
    note(e, "quotation", "Quotation version " + version + " is ready to review.");
    return Number(r.lastInsertRowid);
  });
  void mail.event(
    e,
    "Your quotation is ready. Reference " +
      e.reference_number +
      ". Contact the studio or open your customer dashboard to review it.",
  );
  res.json(db.prepare(quotes + " WHERE q.id=?").get(id));
});
user.get("/quotations", (req, res) =>
  res.json(db.prepare(quotes + " WHERE e.user_id=? ORDER BY q.id DESC").all(req.session.userId)),
);
function quoteFor(req) {
  const q = db
    .prepare(quotes + " WHERE q.id=? AND e.user_id=?")
    .get(req.params.id, req.session.userId);
  if (!q) fail(404, "Quotation unavailable.");
  return q;
}
user.get("/quotations/:id", (req, res) => res.json(quoteFor(req)));
for (const [action, decision] of Object.entries({
  accept: "Accepted",
  decline: "Declined",
  "request-revision": "Revision Requested",
})) {
  user.post("/quotations/:id/" + action, (req, res) => {
    const q = quoteFor(req),
      e = enquiry(q.enquiry_id, req.session.userId);
    const reason = string(req.body.reason, 2000, "revision reason", action !== "request-revision");
    tx(() => {
      const last = db
        .prepare("SELECT MAX(version) AS version FROM quotations WHERE enquiry_id=?")
        .get(e.id);
      if (
        q.version !== last.version ||
        q.decision !== "Pending" ||
        e.status !== "Quotation Prepared"
      )
        fail(409, "Only the latest pending quotation can receive a decision.");
      if (action === "accept" && q.valid_until < today())
        fail(409, "This quotation has expired. Request a revision.");
      db.prepare(
        "UPDATE quotations SET decision=?,revision_reason=?,decided_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?",
      ).run(decision, reason, q.id);
      db.prepare("UPDATE enquiries SET status=?,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?").run(
        decision,
        e.id,
      );
    });
    void mail.event(e, "Customer quotation decision: " + decision, true);
    res.json({ ok: true });
  });
}
module.exports = { admin, user };
