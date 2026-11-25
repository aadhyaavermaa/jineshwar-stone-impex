const router = require("express").Router();
const crypto = require("node:crypto");
const db = require("../database/db");
const { limit, csrf } = require("../middleware/auth");
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const services = [
  "Indian marble blocks & slabs",
  "Stone handicraft export",
  "Handicrafts for interiors & hospitality",
  "Stone sourcing consultancy",
  "One-of-one architectural pieces",
];
const types = ["quotation", "consultancy", "contact", "sample_request"];
const mail = require("../services/mail");
const customerId = (req) => req.session.adminId ? null : req.session.userId || null;
const statuses = ["Submitted", "Under Review", "Quotation Prepared", "Completed"];
function validate(body) {
  for (const [key, limit] of Object.entries({
    customer_name: 100,
    email: 254,
    phone: 30,
    project_type: 80,
    delivery_location: 200,
    budget: 100,
    preferred_material: 100,
    required_service: 100,
    message: 3000,
    preferred_date: 10,
    city: 100,
    postal_code: 16,
    application: 160,
  })) {
    if (body[key] != null && (typeof body[key] !== "string" || body[key].length > limit))
      return "Invalid length or format for " + key.replaceAll("_", " ") + ".";
  }
  if (
    !types.includes(body.enquiry_type) ||
    !body.customer_name?.trim() ||
    !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(body.email || "") ||
    !/^\+?[\d ()-]{7,30}$/.test(body.phone || "") ||
    (body.phone.match(/\d/g) || []).length < 7
  )
    return "Check your name, email and phone.";
  if (body.enquiry_type === "quotation") {
    if (
      !["string", "number"].includes(typeof body.quantity) ||
      !Number.isFinite(Number(body.quantity)) ||
      Number(body.quantity) <= 0 ||
      Number(body.quantity) > 1e9 ||
      !["sq ft", "sq m", "pieces"].includes(body.quantity_unit) ||
      !["Residential", "Commercial", "Other"].includes(body.project_type) ||
      !body.delivery_location?.trim()
    )
      return "Check quantity, unit, project type and delivery location.";
    if (
      !["string", "number"].includes(typeof body.product_id) ||
      !Number.isSafeInteger(Number(body.product_id)) ||
      !db.prepare("SELECT id FROM products WHERE is_active=1 AND id=?").get(Number(body.product_id))
    )
      return "Choose an active product.";
  }
  if (body.enquiry_type === "consultancy") {
    const day = body.preferred_date || "";
    const date = new Date(day + "T00:00:00Z");
    if (
      !["Residential", "Commercial"].includes(body.project_type) ||
      !services.includes(body.required_service) ||
      !body.preferred_material?.trim() ||
      !body.budget?.trim() ||
      !/^\d{4}-\d\d-\d\d$/.test(day) ||
      !Number.isFinite(+date) ||
      date.toISOString().slice(0, 10) !== day ||
      day < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    )
      return "Check the project details and select today or a future date.";
  }
  if (body.enquiry_type === "sample_request") {
    const product =
      ["number", "string"].includes(typeof body.product_id) &&
      Number.isSafeInteger(Number(body.product_id))
        ? db
            .prepare("SELECT category FROM products WHERE id=? AND is_active=1")
            .get(Number(body.product_id))
        : null;
    if (
      !product ||
      /handicraft|furniture/i.test(product.category) ||
      !body.delivery_location?.trim() ||
      !body.city?.trim() ||
      !body.postal_code?.trim() ||
      !body.application?.trim()
    )
      return "Choose a stone and enter delivery address, city, postal code and application.";
  }
  if (["consultancy", "contact"].includes(body.enquiry_type) && !body.message?.trim())
    return "Please describe your project or message.";
}
router.post(
  "/",
  limit(30),
  (req, res, next) => (customerId(req) ? csrf(req, res, next) : next()),
  (req, res) => {
    const b = req.body || {},
      error = validate(b);
    if (error) return res.status(400).json({ error });
    const ref = "JSI-" + crypto.randomUUID().toUpperCase(),
      owner = customerId(req),
      token = owner ? null : crypto.randomBytes(16).toString("hex");
    const quote = b.enquiry_type === "quotation",
      consult = b.enquiry_type === "consultancy";
    const sample = b.enquiry_type === "sample_request";
    db.prepare(
      `INSERT INTO enquiries(reference_number,tracking_token_hash,product_id,customer_name,email,phone,enquiry_type,quantity,quantity_unit,project_type,delivery_location,budget,preferred_date,required_service,preferred_material,message,user_id,city,postal_code,application) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      ref,
      token ? digest(token) : "account:" + crypto.randomBytes(32).toString("hex"),
      quote || sample ? Number(b.product_id) : null,
      b.customer_name.trim(),
      b.email.trim(),
      b.phone.trim(),
      b.enquiry_type,
      quote ? Number(b.quantity) : null,
      quote ? b.quantity_unit : null,
      quote || consult ? b.project_type : null,
      quote || sample ? b.delivery_location.trim() : null,
      consult ? b.budget : null,
      consult ? b.preferred_date : null,
      consult ? b.required_service : null,
      consult ? b.preferred_material : null,
      b.message?.trim() || "",
      owner,
      sample ? b.city.trim() : null,
      sample ? b.postal_code.trim() : null,
      sample ? b.application.trim() : null,
    );
    const receipt = { reference_number: ref, email: b.email };
    void mail.event(
      receipt,
      "We received your " +
        b.enquiry_type.replace("_", " ") +
        ". The studio will review your request.",
    );
    void mail.event(
      receipt,
      "A new " + b.enquiry_type.replace("_", " ") + " is available in the administrator dashboard.",
      true,
    );
    res.status(201).json({ reference_number: ref, ...(token ? { tracking_code: token } : {}), status: statuses[0] });
  },
);
router.post("/track", limit(50), (req, res) => {
  const { reference_number: ref, tracking_code: token } = req.body || {};
  const owner = customerId(req);
  if (typeof ref !== "string" || !ref.trim() || ref.length > 100)
    return res.status(400).json({ error: "Check the reference number." });
  const reference = ref.trim().toUpperCase();
  if (owner) {
    const record = db.prepare(
      "SELECT id, status, enquiry_type FROM enquiries WHERE reference_number=? AND user_id=?",
    ).get(reference, owner);
    if (!record) return res.status(404).json({ error: "No matching request in your account." });
    return res.json(record);
  }
  if (typeof token !== "string" || !token.trim() || token.length > 100)
    return res.status(400).json({ error: "Check the reference and tracking code." });
  const row = db
    .prepare(
      "SELECT status,enquiry_type FROM enquiries WHERE reference_number=? AND tracking_token_hash=?",
    )
    .get(reference, digest(token.trim()));
  if (!row) return res.status(404).json({ error: "No matching enquiry. Check both codes." });
  res.json(row.enquiry_type === "sample_request" ? row : { status: row.status });
});
module.exports = { router, statuses, types };
