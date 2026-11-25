const fs = require("node:fs"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { filename, initialize } = require("./migrate");
fs.mkdirSync(path.dirname(filename), { recursive: true });
const db = new DatabaseSync(filename);
initialize(db, filename);
module.exports = db;
