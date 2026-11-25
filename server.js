require("dotenv").config({ quiet: true });
const express = require("express");
const session = require("express-session");
const path = require("node:path");
const app = express();
const live = process.env.NODE_ENV === "production";
const onRender = process.env.RENDER === "true";
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32)
  throw Error("Set SESSION_SECRET to at least 32 random characters in .env.");
app.disable("x-powered-by");
const trustProxy = process.env.TRUST_PROXY ?? (onRender ? "1" : "0");
if (trustProxy === "1") app.set("trust proxy", 1);
app.use((req, res, next) => {
  res
    .set("X-Content-Type-Options", "nosniff")
    .set("Referrer-Policy", "strict-origin-when-cross-origin")
    .set("X-Frame-Options", "SAMEORIGIN");
  if (req.path.startsWith("/api/") || req.path.startsWith("/admin/"))
    res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "24kb" }));
app.use("/api", (req, res, next) => {
  if (Array.isArray(req.body)) return res.status(400).json({ error: "Expected a JSON object." });
  req.body ||= {};
  next();
});
app.use(
  session({
    name: "stone.sid",
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: live, maxAge: 4 * 3600000 },
  }),
);
app.use("/api/auth", require("./routes/auth").auth);
app.use(
  "/api/user",
  require("./services/common").customer,
  require("./middleware/auth").csrf,
  require("./routes/auth").settings,
  require("./routes/customer"),
);

app.use("/api/products", require("./routes/products"));
app.use("/api/enquiries", require("./routes/enquiries").router);
app.use("/api/admin", require("./routes/admin"));
app.use("/api", (req, res) => res.status(404).json({ error: "Endpoint not found." }));
app.use((req, res, next) => {
  const pathname = path.posix.normalize(decodeURIComponent(req.path));
  if (!pathname.startsWith("/admin/") || pathname === "/admin/login.html" || req.session.adminId)
    return next();
  res.redirect("/admin/login.html");
});
app.get("/vendor/chart.js", (req, res) =>
  res.sendFile(path.join(__dirname, "node_modules/chart.js/dist/chart.umd.js")),
);
app.use(express.static(path.join(__dirname, "public"), { dotfiles: "deny" }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "public/404.html")));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error:
      err.publicMessage ||
      (status === 413
        ? "Request too large."
        : status === 400
          ? "Invalid JSON."
          : "Unable to complete the request."),
  });
});
function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}
const port = Number(option("--port", process.env.PORT)) || 3000;
const host = option("--host", process.env.HOST || (onRender ? "0.0.0.0" : "127.0.0.1"));
if (require.main === module)
  app.listen(port, host, () =>
    console.log("Stone catalogue listening on port " + port),
  );
module.exports = app;
