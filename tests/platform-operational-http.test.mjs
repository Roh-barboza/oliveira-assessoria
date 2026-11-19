import test from "node:test";
import assert from "node:assert/strict";
import { createOperationalHttp } from "../server/platform/operational-http.mjs";

const origin = "https://ops.example.test";
const TOKEN = "A".repeat(43);
function harness() {
  let logins = 0, revoked = 0, sessions = 0;
  const api = createOperationalHttp({
    allowedOrigin: origin,
    networkIdentity: () => "192.0.2.15",
    authentication: { login: async () => {
      logins++;
      return { authenticated: true, session: { token: TOKEN } };
    } },
    accounts: {
      getSession: async (token) => {
        sessions++;
        return token === TOKEN ? { id: "staff1", name: "Operadora",
          email: "staff@example.test", role: "operator", status: "active" } : null;
      },
      revoke: async () => { revoked++; },
    },
  });
  const call = (op, { method = "GET", body, headers = {}, urlOrigin = origin } = {}) =>
    api(new Request(`${urlOrigin}/api/operacional?op=${op}`, {
      method,
      headers: { ...(method === "POST" ? { origin, "content-type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    }));
  return { call, counters: () => ({ logins, revoked, sessions }) };
}
test("real staff session requires MFA gateway and sets secure cookies", async () => {
  const { call, counters } = harness();
  const body = { email: "staff@example.test", password: "strong-passphrase",
    code: "123456" };
  const login = await call("login", { method: "POST", body });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /^__Host-oliveira-ops=/);
  assert.match(setCookie, /Secure; HttpOnly; Path=\/; SameSite=Strict/);
  const state = await call("session", { headers: { cookie: `__Host-oliveira-ops=${TOKEN}` } });
  assert.equal((await state.json()).user.email, "staff@example.test");
  assert.equal(counters().logins, 1);
  const logout = await call("logout", { method: "POST",
    headers: { cookie: `__Host-oliveira-ops=${TOKEN}` } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(counters().revoked, 1);
});
test("request restrictions refuse cross-site, unknown origin, malformed login and hidden data", async () => {
  const { call, counters } = harness();
  assert.equal((await (await call("session")).json()).authenticated, false);
  assert.equal((await call("login", {
    method: "POST", body: { email: "staff@example.test", password: "x", code: "123456" },
    headers: { origin: "https://attacker.example.test" },
  })).status, 403);
  assert.equal((await call("login", {
    method: "POST", body: { email: "staff@example.test", password: "x", code: "123456", isAdmin: true },
  })).status, 401);
  assert.equal((await call("session", { urlOrigin: "https://wrong.example.test" })).status, 403);
  assert.equal(counters().logins, 0);
});
test("untrusted network detection refuses login before credential authentication", async () => {
  let called = false;
  const api = createOperationalHttp({
    allowedOrigin: origin,
    networkIdentity: () => null,
    authentication: { login: async () => { called = true; return null; } },
    accounts: { getSession: async () => null, revoke: async () => {} },
  });
  const response = await api(new Request(origin + "/api/operacional?op=login", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ email: "staff@example.test", password: "pass", code: "123456" }),
  }));
  assert.equal(response.status, 503);
  assert.equal(called, false);
});
