// Runs in a temporary directory with generated credentials. Never opens the demo database.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const { once } = require("node:events");
const { createServer } = require("node:net");
test("catalogue, enquiry lifecycle, protected CRUD and restart persistence", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "stone-test-"));
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const env = {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    NODE_ENV: "production",
    RENDER: "true",
    SMTP_HOST: "",
    SMTP_FROM: "",
    DB_PATH: path.join(dir, "test.sqlite"),
    SESSION_SECRET: randomBytes(32).toString("hex"),
    ADMIN_USERNAME: "integration",
    ADMIN_PASSWORD: randomBytes(18).toString("hex"),
  };
  delete env.TRUST_PROXY;
  let child,
    cookie = "",
    csrf = "";
  async function start() {
    child = spawn(process.execPath, ["server.js"], { env, stdio: ["ignore", "pipe", "inherit"] });
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error("Server failed to start");
      }),
    ]);
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const ended = once(child, "exit");
      child.kill();
      await ended;
    }
    child = null;
  }
  t.after(async () => {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  });
  execFileSync(process.execPath, ["database/seed.js"], { env });
  await start();
  const base = "http://127.0.0.1:" + port;
  async function req(route, method = "GET", body, token = csrf) {
    const response = await fetch(base + "/api/" + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-Proto": "https",
        Cookie: cookie,
        "X-CSRF-Token": token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const session = await fetch(base + "/api/auth/session", {
    headers: { "X-Forwarded-Proto": "https" },
  });
  assert.match(session.headers.get("set-cookie") || "", /; Secure(?:;|$)/);
  const products = (await req("products")).data;
  assert.ok(products.length >= 10);
  assert.ok((await req("products?featured=true")).data.every((p) => p.is_featured));
  assert.equal((await req("products/999999")).status, 404);
  assert.equal((await req("admin/products")).status, 401);
  const p = (await req("products/" + products[0].id)).data;
  const customer = {
    customer_name: "Test customer",
    email: "test@example.invalid",
    phone: "+91 9876500000",
  };
  const quote = {
    ...customer,
    enquiry_type: "quotation",
    product_id: p.id,
    quantity: 110,
    quantity_unit: "sq ft",
    project_type: "Residential",
    delivery_location: "Demo city",
    message: "Integration test",
  };
  assert.equal((await req("enquiries", "POST", { ...quote, quantity: -1 })).status, 400);
  const receipt = await req("enquiries", "POST", quote);
  assert.equal(receipt.status, 201);
  const codes = receipt.data;
  assert.deepEqual((await req("enquiries/track", "POST", codes)).data, { status: "Submitted" });
  assert.equal(
    (await req("enquiries/track", "POST", { ...codes, tracking_code: "wrong" })).status,
    404,
  );
  assert.equal(
    (
      await req("enquiries", "POST", {
        ...customer,
        enquiry_type: "contact",
        message: "Test message",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req("enquiries", "POST", {
        ...customer,
        enquiry_type: "consultancy",
        budget: "Undecided",
        required_service: "Stone sourcing consultancy",
        preferred_material: "Marble",
        preferred_date: "2099-01-01",
        project_type: "Commercial",
        message: "Material guidance",
      })
    ).status,
    201,
  );
  const login = await req("admin/login", "POST", {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });
  assert.equal(login.status, 200);
  cookie = login.cookie;
  csrf = login.data.csrf;
  const rows = (await req("admin/enquiries")).data;
  const row = rows.find((r) => r.reference_number === codes.reference_number);
  assert.equal((await req("admin/enquiries/" + row.id)).data.product_name, p.name);
  assert.equal(
    (await req("admin/enquiries/" + row.id, "PATCH", { status: "Completed" }, "invalid")).status,
    403,
  );
  assert.equal(
    (await req("admin/enquiries/" + row.id, "PATCH", { status: "Completed" })).status,
    200,
  );
  assert.deepEqual((await req("enquiries/track", "POST", codes)).data, { status: "Completed" });
  const stats = (await req("admin/stats")).data;
  assert.equal(stats.total_enquiries, 3);
  assert.equal(stats.pending_enquiries, 2);
  assert.equal(stats.consultancy_requests, 1);
  const form = {
    ...p,
    product_code: "TEST-CUSTOM",
    name: "New material",
    is_active: true,
    is_featured: false,
  };
  const added = await req("admin/products", "POST", form);
  assert.equal(added.status, 201);
  assert.equal(
    (await req("admin/products/" + added.data.id, "PUT", { ...form, name: "Edited material" }))
      .status,
    200,
  );
  assert.equal((await req("products/" + added.data.id)).data.name, "Edited material");
  assert.equal((await req("admin/products/" + p.id, "DELETE", {})).status, 200);
  assert.equal((await req("products/" + p.id)).status, 404);
  assert.equal((await req("admin/enquiries/" + row.id)).data.product_name, p.name);
  assert.equal((await req("admin/logout", "POST", {})).status, 200);
  assert.equal((await req("admin/enquiries")).status, 401);
  await stop();
  cookie = "";
  await start();
  assert.deepEqual((await req("enquiries/track", "POST", codes)).data, { status: "Completed" });
  assert.equal((await req("products/" + added.data.id)).data.name, "Edited material");
  for (const route of ["/.env", "/database/schema.sql", "/data/catalogue.sqlite"])
    assert.equal((await fetch(base + route)).status, 404);
});
