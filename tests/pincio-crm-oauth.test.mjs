import test from "node:test";
import assert from "node:assert/strict";
import { handleCrm } from "../server/crm/http.mjs";
import { seal } from "../server/crm/auth.mjs";

const origin = "https://crm.example.invalid";
const email = "admin@example.invalid";
const stateCookie = "__Host-pincio-oauth";
const sessionCookie = "__Host-pincio-crm";
const sessionKey = "test-session".repeat(4);

test("Google OAuth requires state, verified allowlisted identity and active Sheets membership", async t => {
  const env = {
    PINCIO_CRM_ENABLED: "1",
    PINCIO_CRM_ORIGIN: origin,
    PINCIO_GOOGLE_CLIENT_ID: "synthetic-client",
    PINCIO_GOOGLE_CLIENT_SECRET: "synthetic-secret",
    PINCIO_CRM_SESSION_SECRET: sessionKey,
    PINCIO_CRM_SHARED_SECRET: "test-shared".repeat(4),
    PINCIO_CRM_SCRIPT_URL: "https://script.google.com/macros/s/example/exec",
    PINCIO_CRM_ALLOWED_EMAILS: email,
  };
  let profile = { email: "other@example.invalid", email_verified: true };
  let active = true;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url === "https://oauth2.googleapis.com/token") {
      assert.equal(options.body.get("redirect_uri"), origin + "/api/crm?op=callback");
      assert.ok(options.body.get("code_verifier"));
      return Response.json({ access_token: "synthetic-token" });
    }
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") return Response.json(profile);
    assert.equal(url, env.PINCIO_CRM_SCRIPT_URL);
    assert.equal(JSON.parse(JSON.parse(options.body).payload).actor, email);
    return Response.json(active ? { ok: true, data: {} } : { ok: false, status: 403 });
  });

  const call = (query, init) => handleCrm(new Request(origin + "/api/crm?" + query, init), env);
  assert.equal((await call("")).status, 401);
  const login = await call("op=login");
  assert.equal(login.status, 303);
  const oauth = new URL(login.headers.get("Location"));
  assert.equal(oauth.origin, "https://accounts.google.com");
  assert.equal(oauth.searchParams.get("code_challenge_method"), "S256");
  const cookie = login.headers.get("Set-Cookie").split(";")[0];
  assert.ok(cookie.startsWith(stateCookie + "="));
  assert.match(login.headers.get("Set-Cookie"), /HttpOnly; Secure; SameSite=Lax/);
  const callback = "op=callback&code=synthetic&state=" + oauth.searchParams.get("state");
  assert.equal((await call(callback)).headers.get("Location"), "/crm.html?erro=login");
  assert.equal((await call(callback, { headers: { cookie } })).headers.get("Location"), "/crm.html?erro=acesso");
  profile = { email, email_verified: false };
  assert.equal((await call(callback, { headers: { cookie } })).headers.get("Location"), "/crm.html?erro=acesso");
  profile.email_verified = true;
  const loggedIn = await call(callback, { headers: { cookie } });
  assert.equal(loggedIn.headers.get("Location"), "/crm.html");
  const session = loggedIn.headers.getSetCookie().find(value => value.startsWith(sessionCookie + "=")).split(";")[0];
  assert.equal((await call("", { headers: { cookie: session } })).status, 200);
  active = false;
  assert.equal((await call("", { headers: { cookie: session } })).status, 403);

  const expired = sessionCookie + "=" + seal({ type: "session", email, exp: 0 }, sessionKey);
  assert.equal((await call("", { headers: { cookie: expired } })).status, 401);
  assert.equal((await call("op=logout", { method: "POST", headers: { cookie: session } })).status, 403);
  const logout = await call("op=logout", { method: "POST", headers: { cookie: session, origin } });
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get("Set-Cookie"), /Max-Age=0/);
});
