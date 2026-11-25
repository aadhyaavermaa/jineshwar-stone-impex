const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, quotationURL } = require("../public/js/stone-math");

const room = {
  source: "dimensions",
  length: 12,
  width: 10,
  unit: "feet",
  areaUnit: "sq ft",
  waste: 10,
  rate: 100,
};
test("surface estimates convert units before multiplying by a matching rate", () => {
  const result = calculate("surface", room);
  assert.equal(result.quantity, 132);
  assert.equal(result.cost, 13200);
  const metric = calculate("surface", {
    ...room,
    length: 100,
    width: 200,
    unit: "centimetres",
    areaUnit: "sq m",
    rate: 500,
  });
  assert.equal(metric.quantity, 2.2);
  assert.equal(metric.cost, 1100);
  const converted = calculate("surface", {
    ...room,
    length: 12,
    width: 12,
    unit: "inches",
    areaUnit: "sq m",
    waste: 0,
    rate: null,
  });
  assert.equal(converted.quantity, 0.092904);
  assert.equal(converted.cost, null);
  assert.equal(calculate("surface", { ...room, rate: 0 }).cost, 0);
});

test("piece estimates use whole units and preserve size and product in the RFQ", () => {
  const tile = calculate("tile", {
    ...room,
    pieceLength: 12,
    pieceWidth: 12,
    pieceUnit: "inches",
    rate: 50,
  });
  assert.equal(tile.quantity, 132);
  assert.equal(tile.cost, 6600);
  const slab = calculate("slab", {
    source: "area",
    area: 16,
    areaUnit: "sq m",
    pieceLength: 300,
    pieceWidth: 150,
    pieceUnit: "centimetres",
    waste: 10,
    rate: 4500,
  });
  assert.equal(slab.quantity, 4);
  assert.equal(slab.cost, 18000);
  assert.equal(slab.pieceArea, 4.5);
  const url = new URL(quotationURL("slab", slab, 3, "Stone & light"), "http://localhost");
  assert.equal(url.searchParams.get("quantity"), "4");
  assert.equal(url.searchParams.get("unit"), "pieces");
  assert.equal(url.searchParams.get("product"), "3");
  assert.ok(url.searchParams.get("message").includes("300 × 150 centimetres"));
});

test("reject invalid dimensions, units, rates, mode and unsafe totals", () => {
  for (const bad of [
    { width: 0 },
    { length: "Infinity" },
    { unit: "yards" },
    { waste: 101 },
    { rate: -5 },
    { width: [] },
    { source: "other" },
    { areaUnit: "unknown" },
  ])
    assert.throws(() => calculate("surface", { ...room, ...bad }));
  assert.throws(() => calculate("unknown", room));
  assert.throws(() =>
    calculate("tile", { ...room, pieceLength: 0.0001, pieceWidth: 0.0001, pieceUnit: "inches" }),
  );
});

test("projects router recalculates totals and scopes each operation to the server session", async (t) => {
  const { mkdtempSync, rmSync } = require("node:fs"),
    path = require("node:path"),
    os = require("node:os");
  const { once } = require("node:events");
  const dir = mkdtempSync(path.join(os.tmpdir(), "jsi-planner-"));
  process.env.DB_PATH = path.join(dir, "planner.sqlite");
  const db = require("../database/db"),
    express = require("express");
  const session = require("express-session");
  const { randomBytes } = require("node:crypto");
  const { csrf } = require("../middleware/auth");
  const product = db
    .prepare(
      `INSERT INTO products(product_code,name,category,description,colour,finish,origin,dimensions,applications,image_url,availability)
    VALUES('TEST-PLAN','Test material','Marble','Test','Ivory','Honed','Test','20 mm','Flooring','/images/marble.webp','Available')`,
    )
    .run();
  for (const name of ["first", "second"])
    db.prepare("INSERT INTO users(name,email,google_sub) VALUES(?,?,?)").run(
      name,
      name + "@example.invalid",
      "test-" + name,
    );
  const app = express();
  app.use(express.json());
  app.use(
    session({ secret: randomBytes(32).toString("hex"), resave: false, saveUninitialized: false }),
  );
  // Local fixture establishes two independent sessions; the authentication suite covers sign-in itself.
  app.post("/fixture/:name", (req, res) => {
    req.session.userId = db.prepare("SELECT id FROM users WHERE name=?").get(req.params.name).id;
    req.session.csrf = randomBytes(12).toString("hex");
    res.json({ csrf: req.session.csrf });
  });
  app.use(
    "/projects",
    (req, res, next) => (req.session.userId ? next() : res.sendStatus(401)),
    csrf,
    require("../routes/projects"),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  async function login(name) {
    const r = await fetch(base + "/fixture/" + name, { method: "POST" });
    return {
      Cookie: r.headers.get("set-cookie").split(";")[0],
      "X-CSRF-Token": (await r.json()).csrf,
      "Content-Type": "application/json",
    };
  }
  const first = await login("first"),
    second = await login("second");
  const call = (method, suffix, headers, body) =>
    fetch(base + "/projects" + suffix, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const proposal = {
    project_name: "Entry hall",
    calculation_type: "surface",
    product_id: Number(product.lastInsertRowid),
    inputs: room,
    estimated_quantity: 99,
    estimated_cost: 1,
    user_id: 777,
  };
  let r = await call("POST", "", first, proposal);
  assert.equal(r.status, 201);
  const project = await r.json();
  assert.equal(project.estimated_quantity, 132);
  assert.equal(project.estimated_cost, 13200);
  assert.equal(project.user_id, 1);
  assert.equal(project.product_name, "Test material");
  assert.equal(
    (await call("POST", "", first, { ...proposal, inputs: { ...room, rate: -1 } })).status,
    400,
  );
  assert.equal((await call("POST", "", first, { ...proposal, product_id: 999 })).status, 400);
  assert.equal((await call("GET", "", {})).status, 401);
  assert.equal(
    (await call("DELETE", "/" + project.id, { ...first, "X-CSRF-Token": "incorrect" })).status,
    403,
  );
  for (const [method, suffix, body] of [
    ["GET", "", undefined],
    ["PATCH", "", proposal],
    ["POST", "/duplicate", {}],
    ["DELETE", "", undefined],
  ])
    assert.equal((await call(method, "/" + project.id + suffix, second, body)).status, 404);
  assert.deepEqual(await (await call("GET", "", second)).json(), []);
  r = await call("PATCH", "/" + project.id, first, {
    ...proposal,
    project_name: "Entry floor",
    inputs: { ...room, rate: "" },
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).estimated_cost, null);
  r = await call("POST", "/" + project.id + "/duplicate", first, {});
  assert.equal(r.status, 201);
  assert.equal((await r.json()).project_name, "Entry floor (copy)");
  db.prepare("UPDATE products SET is_active=0 WHERE id=?").run(proposal.product_id);
  const archived = await (await call("GET", "/" + project.id, first)).json();
  assert.equal(new URL(archived.quotation_url, base).searchParams.has("product"), false);
  assert.equal((await call("DELETE", "/" + project.id, first)).status, 200);
  assert.equal((await (await call("GET", "", first)).json()).length, 1);
});
