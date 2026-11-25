const { OAuth2Client } = require("google-auth-library");
const { fail } = require("./common");
const client = new OAuth2Client();
async function identity(credential, nonce) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) fail(503, "Google sign-in is not configured.");
  if (typeof credential !== "string" || credential.length > 16000 || !nonce)
    fail(401, "Google sign-in expired. Try again.");
  let p;
  try {
    p = (await client.verifyIdToken({ idToken: credential, audience })).getPayload();
  } catch {
    fail(401, "Google could not verify this credential. Please try again.");
  }
  if (
    !p ||
    !["accounts.google.com", "https://accounts.google.com"].includes(p.iss) ||
    p.aud !== audience ||
    !Number.isFinite(p.exp) ||
    p.exp * 1000 <= Date.now() ||
    p.email_verified !== true ||
    !p.sub ||
    typeof p.email !== "string" ||
    p.email.length > 254 ||
    p.nonce !== nonce
  )
    fail(401, "Google identity verification failed.");
  return {
    sub: p.sub,
    email: p.email.toLowerCase(),
    name: String(p.name || p.email).slice(0, 100),
  };
}
module.exports = { identity };
