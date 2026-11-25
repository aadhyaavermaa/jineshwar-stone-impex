const router = require("express").Router(),
  crypto = require("node:crypto");
const db = require("../database/db"),
  { fail, string } = require("../services/common");
const { limit } = require("../middleware/auth");
router.use("/projects", require("./projects"));
router.use(require("./crm").user);
router.post("/enquiries/claim", limit(30), (req, res) => {
  const ref = string(req.body.reference_number, 100, "reference number").toUpperCase(),
    code = string(req.body.tracking_code, 100, "tracking code");
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  const row = db
    .prepare(
      "UPDATE enquiries SET user_id=?,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE reference_number=? AND tracking_token_hash=? AND user_id IS NULL RETURNING id",
    )
    .get(req.session.userId, ref, hash);
  if (!row) fail(404, "Unclaimed enquiry and credentials did not match.");
  res.json({ ok: true, id: row.id });
});
const wishlist =
  "SELECT p.* FROM wishlists w JOIN products p ON p.id=w.product_id WHERE w.user_id=? AND p.is_active=1 ORDER BY w.id DESC";
router.get("/wishlist", (req, res) => res.json(db.prepare(wishlist).all(req.session.userId)));
router.post("/wishlist", (req, res) => {
  const id = Number(req.body.product_id);
  if (
    !Number.isSafeInteger(id) ||
    !db.prepare("SELECT id FROM products WHERE id=? AND is_active=1").get(id)
  )
    fail(400, "Choose an active product.");
  db.prepare("INSERT OR IGNORE INTO wishlists(user_id,product_id) VALUES(?,?)").run(
    req.session.userId,
    id,
  );
  res.json({ ok: true });
});
router.delete("/wishlist/:id", (req, res) => {
  db.prepare("DELETE FROM wishlists WHERE user_id=? AND product_id=?").run(
    req.session.userId,
    req.params.id,
  );
  res.json({ ok: true });
});
router.get("/stats", (req, res) => {
  const id = req.session.userId;
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS total_requests,COUNT(CASE WHEN status NOT IN ('Completed','Declined') THEN 1 END) AS active_enquiries,COUNT(CASE WHEN status='Completed' THEN 1 END) AS completed_enquiries,COUNT(CASE WHEN enquiry_type='quotation' AND status IN ('Submitted','Under Review','Revision Requested','Quotation Prepared') THEN 1 END) AS pending_quotations,COUNT(CASE WHEN enquiry_type='consultancy' THEN 1 END) AS consultancy_requests,COUNT(CASE WHEN enquiry_type='sample_request' THEN 1 END) AS sample_requests FROM enquiries WHERE user_id=?`,
    )
    .get(id);
  res.json({
    ...stats,
    saved_products: db
      .prepare(
        "SELECT count(*) AS n FROM wishlists JOIN products ON products.id=wishlists.product_id WHERE user_id=? AND is_active=1",
      )
      .get(id).n,
    saved_projects: db.prepare("SELECT count(*) AS n FROM saved_projects WHERE user_id=?").get(id)
      .n,
    recent: db
      .prepare(
        "SELECT e.id,e.reference_number,e.enquiry_type,e.status,e.updated_at,e.created_at,p.name AS product_name FROM enquiries e LEFT JOIN products p ON p.id=e.product_id WHERE e.user_id=? ORDER BY e.updated_at DESC,e.id DESC LIMIT 8",
      )
      .all(id),
  });
});
router.get("/notifications", (req, res) =>
  res.json(
    db
      .prepare(
        "SELECT id,enquiry_id,notification_type,message,is_read,created_at FROM notifications WHERE user_id=? ORDER BY id DESC",
      )
      .all(req.session.userId),
  ),
);
router.patch("/notifications/read-all", (req, res) => {
  db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=?").run(req.session.userId);
  res.json({ ok: true });
});
router.patch("/notifications/:id/read", (req, res) => {
  if (
    !db
      .prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?")
      .run(req.params.id, req.session.userId).changes
  )
    fail(404, "Notification unavailable.");
  res.json({ ok: true });
});
module.exports = router;
