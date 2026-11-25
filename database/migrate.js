require("dotenv").config({ quiet: true });
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const filename = process.env.DB_PATH || path.join(__dirname, "../data/catalogue.sqlite");
function backup(db, file) {
  const target =
    file +
    "." +
    new Date().toISOString().replace(/[:.]/g, "-") +
    "-" +
    crypto.randomBytes(3).toString("hex") +
    ".bak";
  db.prepare("VACUUM INTO ?").run(target);
  return target;
}
function initialize(db, file) {
  db.exec("PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version === 3) return;
  if (version !== 0 && version !== 2) throw Error("Unrecognized database version. Migration stopped.");
  const existing = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);
  if (version === 0 && existing.length) {
    if (
      existing.length !== 3 ||
      !["products", "enquiries", "admins"].every((k) => existing.includes(k))
    )
      throw Error("Database has a different schema. Original file left intact.");
    if (
      db.prepare("PRAGMA table_info(enquiries)").all().length !== 20 ||
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE tbl_name='enquiries' AND sql IS NOT NULL AND type IN ('index','trigger')",
        )
        .get()
    )
      throw Error("Custom enquiry schema detected. Review before migrating.");
  }
  if (existing.length) backup(db, file);
  db.exec("BEGIN IMMEDIATE");
  try {
    const lockedVersion = db.prepare("PRAGMA user_version").get().user_version;
    if (lockedVersion === 0) {
      db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
      const previous = db.prepare("SELECT COUNT(*) AS n FROM enquiries").get().n;
      db.exec(fs.readFileSync(path.join(__dirname, "upgrade.sql"), "utf8"));
      if (
        db.prepare("SELECT COUNT(*) AS n FROM enquiries").get().n !== previous ||
        db.prepare("PRAGMA foreign_key_check").get()
      )
        throw Error("Migration verification failed.");
    }
    if (lockedVersion < 3) {
      db.exec(fs.readFileSync(path.join(__dirname, "ist.sql"), "utf8"));
      db.exec("PRAGMA user_version=3");
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
if (require.main === module) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
    if (process.argv.includes("--backup")) console.log("Database backup:", backup(db, filename));
    else {
      initialize(db, filename);
      console.log("Database schema version 3 ready.");
    }
  } finally {
    db.close();
  }
}
module.exports = { filename, initialize };
