const router = require("express").Router();
const db = require("../database/db");
const { calculate, quotationURL } = require("../public/js/stone-math");

const selectProject = `SELECT s.*, p.name AS product_name, p.is_active AS product_active
                       FROM saved_projects s LEFT JOIN products p ON p.id = s.product_id`;
function readProject(req) {
  return db
    .prepare(selectProject + " WHERE s.id = ? AND s.user_id = ?")
    .get(req.params.id, req.session.userId);
}
function present(row) {
  const inputs = JSON.parse(row.inputs);
  const result = calculate(row.calculation_type, inputs);
  return {
    ...row,
    inputs,
    quantity_unit: result.quantityUnit,
    quotation_url: quotationURL(
      row.calculation_type,
      result,
      row.product_active ? row.product_id : null,
      row.project_name,
    ),
  };
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(selectProject + " WHERE s.user_id = ? ORDER BY s.updated_at DESC, s.id DESC")
    .all(req.session.userId);
  res.json(rows.map(present));
});
router.get("/:id", (req, res) => {
  const row = readProject(req);
  if (!row) return res.status(404).json({ error: "Project not found." });
  res.json(present(row));
});

function writeProject(req, res) {
  const updating = req.method === "PATCH";
  const old = updating ? readProject(req) : null;
  if (updating && !old) return res.status(404).json({ error: "Project not found." });
  const body = req.body || {};
  const name = typeof body.project_name === "string" ? body.project_name.trim() : "";
  if (!name || name.length > 100)
    return res.status(400).json({ error: "Enter a project name of up to 100 characters." });
  const type = body.calculation_type;
  let result;
  try {
    if (!body.inputs || typeof body.inputs !== "object" || Array.isArray(body.inputs))
      throw Error("Enter project dimensions.");
    result = calculate(type, body.inputs);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  let productId = null;
  if (body.product_id != null && body.product_id !== "") {
    productId = Number(body.product_id);
    if (
      !["number", "string"].includes(typeof body.product_id) ||
      !Number.isSafeInteger(productId) ||
      productId < 1
    )
      return res.status(400).json({ error: "Choose a valid product." });
    // Historical projects keep their material if the studio later archives it.
    if (
      old?.product_id !== productId &&
      !db.prepare("SELECT id FROM products WHERE id=? AND is_active=1").get(productId)
    )
      return res.status(400).json({ error: "Choose an active material or leave it undecided." });
  }
  const values = [
    productId,
    name,
    type,
    JSON.stringify(result.inputs),
    result.quantity,
    result.cost,
  ];
  let id;
  if (updating) {
    db.prepare(
      `UPDATE saved_projects SET product_id=?, project_name=?, calculation_type=?, inputs=?,
                estimated_quantity=?, estimated_cost=?, updated_at=(datetime('now','+330 minutes') || '+05:30') WHERE id=? AND user_id=?`,
    ).run(...values, old.id, req.session.userId);
    id = old.id;
  } else {
    id = Number(
      db
        .prepare(
          `INSERT INTO saved_projects(product_id,project_name,calculation_type,inputs,
                             estimated_quantity,estimated_cost,user_id) VALUES (?,?,?,?,?,?,?)`,
        )
        .run(...values, req.session.userId).lastInsertRowid,
    );
  }
  res
    .status(updating ? 200 : 201)
    .json(
      present(
        db.prepare(selectProject + " WHERE s.id=? AND s.user_id=?").get(id, req.session.userId),
      ),
    );
}
router.post("/", writeProject);
router.patch("/:id", writeProject);
router.post("/:id/duplicate", (req, res) => {
  const row = readProject(req);
  if (!row) return res.status(404).json({ error: "Project not found." });
  const id = db
    .prepare(
      `INSERT INTO saved_projects(user_id,product_id,project_name,calculation_type,inputs,estimated_quantity,estimated_cost)
                          SELECT user_id,product_id,?,calculation_type,inputs,estimated_quantity,estimated_cost FROM saved_projects WHERE id=? AND user_id=?`,
    )
    .run(row.project_name.slice(0, 93) + " (copy)", row.id, req.session.userId).lastInsertRowid;
  res
    .status(201)
    .json(
      present(
        db.prepare(selectProject + " WHERE s.id=? AND s.user_id=?").get(id, req.session.userId),
      ),
    );
});
router.delete("/:id", (req, res) => {
  const { changes } = db
    .prepare("DELETE FROM saved_projects WHERE id=? AND user_id=?")
    .run(req.params.id, req.session.userId);
  if (!changes) return res.status(404).json({ error: "Project not found." });
  res.json({ ok: true });
});
module.exports = router;
