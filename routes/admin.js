const router = require("express").Router();
const bcrypt = require("bcrypt");
const db = require("../database/db");
const { authenticated, csrf, limit, newToken } = require("../middleware/auth");
router.get("/session", (req, res) =>
  res.json({ authenticated: Boolean(req.session.adminId), csrf: req.session.csrf || null }),
);
router.post("/login", limit(10), async (req, res, next) => {
  const { username, password } = req.body || {};
  if (
    typeof username !== "string" ||
    username.length > 80 ||
    typeof password !== "string" ||
    Buffer.byteLength(password) > 72
  )
    return res.status(400).json({ error: "Invalid credentials format." });
  const account = db.prepare("SELECT * FROM admins WHERE username=?").get(username);
  if (!account || !(await bcrypt.compare(password, account.password_hash)))
    return res.status(401).json({ error: "Incorrect username or password." });
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.adminId = account.id;
    req.session.csrf = newToken();
    req.session.save((error) =>
      error ? next(error) : res.json({ authenticated: true, csrf: req.session.csrf }),
    );
  });
});
router.use(authenticated, csrf);
router.post("/logout", (req, res, next) =>
  req.session.destroy((e) => (e ? next(e) : res.clearCookie("stone.sid").json({ ok: true }))),
);
router.get("/products", (req, res) =>
  res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all()),
);
const fields = {
  product_code: 50,
  name: 120,
  category: 80,
  description: 2400,
  colour: 80,
  finish: 80,
  origin: 120,
  dimensions: 120,
  applications: 300,
  image_url: 1000,
  availability: 30,
};
function saveProduct(req, res) {
  const b = req.body || {};
  for (const [field, max] of Object.entries(fields)) {
    if (typeof b[field] !== "string" || !b[field].trim() || b[field].length > max)
      return res.status(400).json({ error: "Check " + field.replaceAll("_", " ") + "." });
  }
  if (!/^\/images\/[\w.-]+\.(?:webp|png|jpe?g)$/i.test(b.image_url)) {
    try {
      const u = new URL(b.image_url);
      if (u.protocol !== "https:" || u.username || u.password) throw Error();
    } catch {
      return res.status(400).json({ error: "Use a local /images/ file or an HTTPS image URL." });
    }
  }
  if (
    !["Available", "Made to order", "On request"].includes(b.availability) ||
    typeof b.is_featured !== "boolean" ||
    typeof b.is_active !== "boolean"
  )
    return res.status(400).json({ error: "Check availability and visibility." });
  const keys = [...Object.keys(fields), "is_featured", "is_active"];
  const values = [
    ...Object.keys(fields).map((k) => b[k].trim()),
    Number(b.is_featured),
    Number(b.is_active),
  ];
  try {
    if (req.method === "POST") {
      const row = db
        .prepare(
          "INSERT INTO products(" +
            keys.join(",") +
            ") VALUES(" +
            keys.map(() => "?").join(",") +
            ")",
        )
        .run(...values);
      return res.status(201).json({ id: Number(row.lastInsertRowid) });
    }
    const row = db
      .prepare(
        "UPDATE products SET " +
          keys.map((k) => k + "=?").join(",") +
          ", updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?",
      )
      .run(...values, req.params.id);
    if (!row.changes) return res.status(404).json({ error: "Product missing." });
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes("UNIQUE"))
      return res.status(409).json({ error: "Product code already in use." });
    throw e;
  }
}
router.post("/products", saveProduct);
router.put("/products/:id", saveProduct);
router.delete("/products/:id", (req, res) => {
  // Archiving keeps historical enquiry links readable and can be reversed.
  const row = db
    .prepare("UPDATE products SET is_active=0,updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=?")
    .run(req.params.id);
  if (!row.changes) return res.status(404).json({ error: "Product missing." });
  res.json({ ok: true });
});
const enquiryList =
  "SELECT e.id,e.user_id,e.reference_number,e.enquiry_type,e.customer_name,e.status,e.created_at,p.name AS product_name FROM enquiries e LEFT JOIN products p ON p.id=e.product_id ORDER BY e.id DESC";
router.use(require("./crm").admin);
router.get("/stats", (req, res) => {
  const products = db
    .prepare(
      "SELECT count(*) AS total_products,count(CASE WHEN availability='Available' THEN 1 END) AS available_products FROM products WHERE is_active=1",
    )
    .get();
  const requests = db
    .prepare(
      "SELECT count(*) AS total_enquiries, count(CASE WHEN status NOT IN ('Completed','Declined') THEN 1 END) AS pending_enquiries,count(CASE WHEN status='Completed' THEN 1 END) AS completed_enquiries,count(CASE WHEN enquiry_type='consultancy' THEN 1 END) AS consultancy_requests FROM enquiries",
    )
    .get();
  const monthly = db
    .prepare(
      "SELECT substr(created_at,1,7) AS month,count(*) AS count FROM enquiries WHERE created_at>=date('now','+330 minutes','start of month','-5 months') GROUP BY month ORDER BY month",
    )
    .all();
  const distribution = db
    .prepare("SELECT status,count(*) AS count FROM enquiries GROUP BY status")
    .all();
  res.json({
    ...products,
    ...requests,
    total_customers: db.prepare("SELECT count(*) AS n FROM users").get().n,
    sample_requests: db
      .prepare("SELECT count(*) AS n FROM enquiries WHERE enquiry_type='sample_request'")
      .get().n,
    accepted_quotations: db
      .prepare("SELECT count(*) AS n FROM quotations WHERE decision='Accepted'")
      .get().n,
    recent_activity: db
      .prepare(
        "SELECT e.id AS enquiry_id,e.customer_name,e.enquiry_type||' · '||e.status AS event,e.updated_at AS created_at FROM enquiries e UNION ALL SELECT e.id,e.customer_name,m.sender_type||' message',m.created_at FROM enquiry_messages m JOIN enquiries e ON e.id=m.enquiry_id ORDER BY created_at DESC LIMIT 12",
      )
      .all(),
    monthly,
    distribution,
    recent: db.prepare(enquiryList + " LIMIT 6").all(),
  });
});
module.exports = router;
