const nodemailer = require("nodemailer");
function configured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}
// Called only after commit. An SMTP error cannot reverse a saved enquiry.
async function send(to, subject, text) {
  if (!configured() || !to) return { state: "disabled" };
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      connectionTimeout: 5000,
      socketTimeout: 7000,
      greetingTimeout: 5000,
    });
    await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
    return { state: "submitted_to_smtp" };
  } catch {
    console.warn("An optional notification could not be submitted to SMTP.");
    return { state: "failed" };
  }
}
function event(row, text, admin = false) {
  return send(
    admin ? process.env.ADMIN_NOTIFY_EMAIL : row.email,
    "Jineshwar Stone Impex · " + row.reference_number,
    text + "\n\nReference: " + row.reference_number + "\nJineshwar Stone Impex",
  );
}
module.exports = { send, event, configured };
