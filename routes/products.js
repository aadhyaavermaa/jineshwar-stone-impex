const router = require("express").Router();
const db = require("../database/db");
router.get("/", (req, res) => {
  const where = req.query.featured === "true" ? " AND is_featured=1" : "";
  res.json(db.prepare("SELECT * FROM products WHERE is_active=1" + where + " ORDER BY id").all());
});
router.get("/:id", (req, res) => {
  const product = db
    .prepare("SELECT * FROM products WHERE is_active=1 AND id=?")
    .get(req.params.id);
  if (!product) return res.status(404).json({ error: "This material is unavailable." });
  res.json(product);
});
module.exports = router;
