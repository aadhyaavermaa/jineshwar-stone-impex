// Exercise the real Express application, SQLite and Google verifier with ephemeral test identities.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { once } = require("node:events");
test("upgrade preserves original IDs, credentials and tracking hashes, backs up once and is repeatable", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stone-migrate-")),
    file = path.join(dir, "legacy.sqlite");
  const db = new DatabaseSync(file),
    { initialize } = require("../database/migrate");
  try {
    db.exec(fs.readFileSync(path.join(__dirname, "../database/schema.sql"), "utf8"));
    db.exec(
      "INSERT INTO admins(id,username,password_hash) VALUES(4,'demo','existing-hash');INSERT INTO enquiries(id,reference_number,tracking_token_hash,customer_name,email,phone,enquiry_type,status) VALUES(27,'existing-ref','existing-digest','Demo','demo@example.invalid','0000000000','contact','Under Review')",
    );
    db.exec("UPDATE enquiries SET created_at='2026-11-30 18:30:00', preferred_date='2026-12-10'");
    initialize(db, file);
    initialize(db, file);
    assert.deepEqual(
      { ...db.prepare("SELECT created_at, preferred_date FROM enquiries WHERE id=27").get() },
      { created_at: "2026-12-01 00:00:00+05:30", preferred_date: "2026-12-10" },
    );
    db.exec("INSERT INTO admins(username,password_hash) VALUES('new-admin','test-hash')");
    assert.match(
      db.prepare("SELECT created_at FROM admins WHERE username='new-admin'").get().created_at,
      /\+05:30$/,
    );
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 3);
    assert.equal(
      db.prepare("SELECT password_hash FROM admins WHERE id=4").get().password_hash,
      "existing-hash",
    );
    assert.deepEqual(
      {
        ...db.prepare("SELECT tracking_token_hash,status,user_id FROM enquiries WHERE id=27").get(),
      },
      { tracking_token_hash: "existing-digest", status: "Under Review", user_id: null },
    );
    const backups = fs.readdirSync(dir).filter((f) => f.endsWith(".bak"));
    assert.equal(backups.length, 1);
    const copy = new DatabaseSync(path.join(dir, backups[0]), { readOnly: true });
    assert.equal(copy.prepare("PRAGMA user_version").get().user_version, 0);
    copy.close();
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("account, CRM and provider-enabled workflows", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stone-crm-"));
  Object.assign(process.env, {
    DB_PATH: path.join(dir, "app.sqlite"),
    SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
    ADMIN_USERNAME: "test-admin",
    ADMIN_PASSWORD: crypto.randomBytes(16).toString("hex"),
    GOOGLE_CLIENT_ID: "",
    SMTP_HOST: "",
    SMTP_FROM: "",
    NODE_ENV: "test",
  });
  // Invalidate the cached migration module's default path from the independent legacy test.
  delete require.cache[require.resolve("../database/migrate")];
  require("node:child_process").execFileSync(process.execPath, ["database/seed.js"], {
    cwd: path.join(__dirname, ".."),
    env: process.env,
  });
  const app = require("../server"),
    db = require("../database/db"),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const base = "http://127.0.0.1:" + server.address().port;
  function actor() {
    const state = { csrf: "", cookie: "" };
    return {
      async call(url, method = "GET", body, token = state.csrf) {
        const r = await fetch(base + "/api/" + url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Cookie: state.cookie,
            "X-CSRF-Token": token,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (r.headers.get("set-cookie")) state.cookie = r.headers.get("set-cookie").split(";")[0];
        const data = await r.json();
        if (data.csrf) state.csrf = data.csrf;
        return { status: r.status, data };
      },
    };
  }
  const guest = actor(),
    a = actor(),
    b = actor(),
    staff = actor();
  const pw = crypto.randomBytes(14).toString("hex"),
    profile = {
      name: "Demo Planner",
      phone: "0000000000",
      email: "planner@example.invalid",
      password: pw,
      wishlist: [1, 2, 1],
    };
  const product = db.prepare("SELECT id FROM products ORDER BY id").get().id;
  const quotation = {
    customer_name: "Planner",
    email: profile.email,
    phone: profile.phone,
    enquiry_type: "quotation",
    product_id: product,
    quantity: 3.5,
    quantity_unit: "sq m",
    project_type: "Residential",
    delivery_location: "Test city",
  };
  let enquiry, receipt, id, qid, secondId, sampleId;
  await t.test(
    "password accounts, CSRF, profile updates, merge, role isolation and duplicate emails",
    async () => {
      await a.call("auth/session");
      await b.call("auth/session");
      assert.equal((await a.call("auth/signup", "POST", profile, "wrong")).status, 403);
      assert.equal((await a.call("auth/signup", "POST", profile)).status, 201);
      assert.equal(
        (await b.call("auth/signup", "POST", { ...profile, email: profile.email.toUpperCase() }))
          .status,
        409,
      );
      assert.equal(
        (await b.call("auth/signup", "POST", { ...profile, email: "other@example.invalid" }))
          .status,
        201,
      );
      assert.equal((await a.call("admin/enquiries")).status, 401);
      assert.equal((await guest.call("user/enquiries")).status, 401);
      assert.equal(
        (
          await staff.call("admin/login", "POST", {
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
          })
        ).status,
        200,
      );
      assert.equal((await staff.call("user/projects")).status, 401);
      assert.equal((await a.call("user/wishlist")).data.length, 2);
      await a.call("user/wishlist/2", "DELETE");
      assert.equal((await a.call("user/wishlist")).data.length, 1);
      assert.equal(
        (await a.call("user/profile", "PATCH", { name: "Planner updated", phone: "1234567890" }))
          .data.name,
        "Planner updated",
      );
      const newPw = crypto.randomBytes(16).toString("hex");
      assert.equal(
        (await a.call("user/password", "PATCH", { current_password: pw, password: newPw })).status,
        200,
      );
      await a.call("auth/logout", "POST", {});
      assert.equal((await a.call("user/profile")).status, 401);
      await a.call("auth/session");
      assert.equal(
        (await a.call("auth/login", "POST", { email: profile.email, password: pw })).status,
        401,
      );
      assert.equal(
        (await a.call("auth/login", "POST", { email: profile.email, password: newPw })).status,
        200,
      );
    },
  );
  await t.test(
    "guest tracking, ownership proof, samples, notifications and conversations",
    async () => {
      receipt = (await guest.call("enquiries", "POST", quotation)).data;
      assert.equal((await a.call("user/enquiries")).data.length, 0);
      assert.match(receipt.tracking_code, /^[a-f0-9]{32}$/);
      const reference = { reference_number: receipt.reference_number };
      assert.equal((await guest.call("enquiries/track", "POST", reference)).status, 400);
      assert.equal((await guest.call("enquiries/track", "POST", { ...reference, tracking_code: "wrong" })).status, 404);
      assert.deepEqual((await guest.call("enquiries/track", "POST", receipt)).data, { status: "Submitted" });
      assert.equal((await a.call("enquiries/track", "POST", receipt)).status, 404);
      assert.equal(
        (await a.call("user/enquiries/claim", "POST", { ...receipt, tracking_code: "incorrect" }))
          .status,
        404,
      );
      const claim = await a.call("user/enquiries/claim", "POST", receipt);
      assert.equal(claim.status, 200);
      id = claim.data.id;
      assert.equal((await b.call("user/enquiries/claim", "POST", receipt)).status, 404);
      assert.equal((await b.call("user/enquiries/" + id)).status, 404);
      assert.deepEqual((await a.call("enquiries/track", "POST", reference)).data, {
        id, status: "Submitted", enquiry_type: "quotation",
      });
      assert.equal((await b.call("enquiries/track", "POST", receipt)).status, 404);
      assert.deepEqual((await guest.call("enquiries/track", "POST", receipt)).data, { status: "Submitted" });
      const sample = {
        ...quotation,
        enquiry_type: "sample_request",
        city: "Delhi",
        postal_code: "110074",
        application: "Flooring",
        user_id: 999,
      };
      assert.equal((await a.call("enquiries", "POST", sample)).status, 201);
      sampleId = (await a.call("user/enquiries")).data.find(
        (e) => e.enquiry_type === "sample_request",
      ).id;
      assert.equal(
        (
          await staff.call("admin/enquiries/" + sampleId, "PATCH", {
            status: "Dispatched",
            admin_response: "Demo dispatch update",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await a.call("user/enquiries/" + id + "/messages", "POST", {
            message: "Can you confirm the finish?",
            sender_type: "admin",
          })
        ).status,
        201,
      );
      assert.equal((await b.call("user/enquiries/" + id + "/messages")).status, 404);
      await staff.call("admin/enquiries/" + id + "/messages", "POST", { message: "Honed finish." });
      assert.deepEqual(
        (await a.call("user/enquiries/" + id + "/messages")).data.map((m) => m.sender_type),
        ["customer", "admin"],
      );
      const notes = (await a.call("user/notifications")).data;
      assert.ok(notes.length >= 3);
      assert.equal(
        (await b.call("user/notifications/" + notes[0].id + "/read", "PATCH", {})).status,
        404,
      );
      await a.call("user/notifications/read-all", "PATCH", {});
      assert.ok((await a.call("user/notifications")).data.every((n) => n.is_read === 1));
      enquiry = (await a.call("user/enquiries/" + id)).data;
      assert.ok(!("tracking_token_hash" in enquiry));
      assert.equal((await a.call("user/stats")).data.sample_requests, 1);
    },
  );
  await t.test("account submissions for every request type are reference-only and owner-scoped", async () => {
    const fixtures = [
      quotation,
      {
        ...quotation, enquiry_type: "consultancy", required_service: "Stone sourcing consultancy",
        preferred_material: "Marble", budget: "10000", preferred_date: "2099-12-01", message: "Design advice",
      },
      { ...quotation, enquiry_type: "sample_request", city: "Delhi", postal_code: "110074", application: "Flooring" },
      { ...quotation, enquiry_type: "contact", message: "Contact the studio" },
    ];
    for (const fixture of fixtures) {
      const submission = await a.call("enquiries", "POST", fixture);
      assert.equal(submission.status, 201);
      const { reference_number } = submission.data;
      assert.deepEqual(submission.data, { reference_number, status: "Submitted" });
      const lookup = { reference_number: " " + reference_number.toLowerCase() + " " };
      const track = await a.call("enquiries/track", "POST", lookup);
      assert.equal(track.status, 200);
      assert.equal(track.data.enquiry_type, fixture.enquiry_type);
      assert.equal((await b.call("enquiries/track", "POST", { ...lookup, user_id: 1 })).status, 404);
      assert.equal((await guest.call("enquiries/track", "POST", lookup)).status, 400);
      assert.equal((await guest.call("enquiries/track", "POST", { ...lookup, tracking_code: "wrong" })).status, 404);
      const history = await a.call("user/enquiries");
      assert.ok(history.data.some((row) => row.id === track.data.id && row.reference_number === reference_number));
      assert.equal((await a.call("user/enquiries/" + track.data.id)).data.reference_number, reference_number);
      assert.equal((await b.call("user/enquiries/" + track.data.id)).status, 404);
      assert.match(db.prepare("SELECT tracking_token_hash FROM enquiries WHERE id=?").get(track.data.id).tracking_token_hash, /^account:/);
    }
  });
  await t.test(
    "quotation arithmetic, immutable versions, ownership, revision, expiry and acceptance",
    async () => {
      const draft = {
        version: 0,
        rate: 100.25,
        transport: 15,
        additional: 10,
        tax_percent: 18,
        valid_until: "2099-01-01",
        terms: "Test terms",
        admin_response: "Estimate for review",
        total: 0,
      };
      const issue = await staff.call("admin/enquiries/" + id + "/quotation", "PATCH", draft);
      assert.equal(issue.status, 200);
      qid = issue.data.id;
      assert.equal(issue.data.subtotal, 350.88);
      assert.equal(issue.data.total, 443.54);
      assert.equal(
        (await staff.call("admin/enquiries/" + id + "/quotation", "PATCH", draft)).status,
        409,
      );
      assert.equal((await b.call("user/quotations/" + qid + "/accept", "POST", {})).status, 404);
      assert.equal(
        (
          await a.call("user/quotations/" + qid + "/request-revision", "POST", {
            reason: "Review delivery charges",
          })
        ).status,
        200,
      );
      const revised = await staff.call("admin/enquiries/" + id + "/quotation", "PATCH", {
        ...draft,
        version: 1,
        transport: 0,
      });
      assert.equal(revised.data.version, 2);
      assert.equal(revised.data.decision, "Pending");
      secondId = revised.data.id;
      assert.equal((await a.call("user/quotations/" + qid + "/accept", "POST", {})).status, 409);
      db.prepare("UPDATE quotations SET valid_until=? WHERE id=?").run("2000-01-01", secondId);
      assert.equal(
        (await a.call("user/quotations/" + secondId + "/accept", "POST", {})).status,
        409,
      );
      assert.equal(
        (await a.call("user/quotations/" + secondId + "/decline", "POST", {})).status,
        200,
      );
      const final = await staff.call("admin/enquiries/" + id + "/quotation", "PATCH", {
        ...draft,
        version: 2,
      });
      assert.equal(
        (await a.call("user/quotations/" + final.data.id + "/accept", "POST", {})).status,
        200,
      );
      assert.equal(
        (
          await staff.call("admin/enquiries/" + id + "/quotation", "PATCH", {
            ...draft,
            version: 3,
          })
        ).status,
        409,
      );
      assert.equal((await staff.call("admin/stats")).data.accepted_quotations, 1);
      assert.equal((await a.call("user/enquiries/" + id)).data.quotations.length, 3);
    },
  );
  await t.test("SMTP disabled and failed transport both preserve submitted records", async () => {
    const mail = require("../services/mail"),
      nm = require("nodemailer");
    assert.equal((await mail.send("nobody@example.invalid", "Test", "Test")).state, "disabled");
    const messages = [];
    t.mock.method(nm, "createTransport", () => ({
      sendMail: async (input) => {
        messages.push(input);
        return {};
      },
    }));
    Object.assign(process.env, {
      SMTP_HOST: "local-fixture",
      SMTP_FROM: "studio@example.invalid",
      ADMIN_NOTIFY_EMAIL: "admin@example.invalid",
    });
    const contact = { ...quotation, enquiry_type: "contact", message: "SMTP fixture test" };
    const response = await a.call("enquiries", "POST", contact);
    assert.equal(response.status, 201);
    assert.equal(messages.length, 2);
    nm.createTransport.mock.mockImplementation(() => ({
      sendMail: async () => {
        throw Error("test transport failure");
      },
    }));
    const afterFailure = await a.call("enquiries", "POST", contact);
    assert.equal(afterFailure.status, 201);
    assert.equal(
      (await a.call("enquiries/track", "POST", afterFailure.data)).data.status,
      "Submitted",
    );
    process.env.SMTP_HOST = "";
  });
  await t.test(
    "Google token verification and account lifecycle with test-only RSA keys",
    async () => {
      const c = actor();
      await c.call("auth/session");
      assert.equal(
        (await c.call("auth/google", "POST", { credential: "unconfigured" })).status,
        503,
      );
      process.env.GOOGLE_CLIENT_ID = "local-verifier-test";
      const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
      const { OAuth2Client } = require("google-auth-library");
      // Substitute only the public-key download. Google's signature and claim verifier still runs.
      t.mock.method(OAuth2Client.prototype, "getFederatedSignonCertsAsync", async () => ({
        certs: { fixture: publicKey.export({ format: "pem", type: "spki" }) },
      }));
      async function credential(client, overrides = {}) {
        const s = (await client.call("auth/session")).data,
          now = Math.floor(Date.now() / 1000);
        const claims = {
          iss: "https://accounts.google.com",
          aud: process.env.GOOGLE_CLIENT_ID,
          exp: now + 3600,
          iat: now,
          email_verified: true,
          email: "google-user@example.invalid",
          sub: "fixture-customer",
          nonce: s.nonce,
          name: "Google fixture",
          ...overrides,
        };
        const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
        const signed = encode({ alg: "RS256", kid: "fixture" }) + "." + encode(claims);
        return (
          signed +
          "." +
          crypto.sign("RSA-SHA256", Buffer.from(signed), privateKey).toString("base64url")
        );
      }
      for (const invalid of [
        { aud: "other-client" },
        { exp: Math.floor(Date.now() / 1000) - 600 },
        { nonce: "other-session" },
        { email_verified: false },
        { iss: "untrusted" },
      ]) {
        assert.equal(
          (await c.call("auth/google", "POST", { credential: await credential(c, invalid) }))
            .status,
          401,
        );
      }
      const first = await c.call("auth/google", "POST", {
        credential: await credential(c),
        wishlist: [1],
      });
      assert.equal(first.status, 200);
      assert.equal(first.data.user.phone, "");
      assert.equal((await c.call("admin/products")).status, 401);
      assert.equal((await c.call("user/auth/google/unlink", "POST", {})).status, 409);
      await c.call("auth/logout", "POST", {});
      const again = await c.call("auth/google", "POST", { credential: await credential(c) });
      assert.equal(again.data.user.id, first.data.user.id);
      assert.equal(
        (await c.call("user/reauth", "POST", { credential: await credential(c) })).status,
        200,
      );
      assert.equal((await c.call("user/auth/password/set", "POST", { password: pw })).status, 200);
      assert.equal((await c.call("user/auth/google/unlink", "POST", {})).status, 200);
      const otherClaims = { sub: "fixture-password-owner", email: "other@example.invalid" };
      const g = actor();
      assert.equal(
        (await g.call("auth/google", "POST", { credential: await credential(g, otherClaims) }))
          .status,
        409,
      );
      assert.equal((await b.call("user/reauth", "POST", { password: pw })).status, 200);
      assert.equal(
        (
          await b.call("user/auth/google/link", "POST", {
            confirm: false,
            credential: await credential(b, otherClaims),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await b.call("user/auth/google/link", "POST", {
            confirm: true,
            credential: await credential(b, otherClaims),
          })
        ).status,
        200,
      );
      const linked = await g.call("auth/google", "POST", {
        credential: await credential(g, otherClaims),
      });
      assert.equal(linked.data.user.email, "other@example.invalid");
      assert.equal((await g.call("admin/stats")).status, 401);
    },
  );
});
