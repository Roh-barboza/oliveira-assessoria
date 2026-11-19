import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { OperationalLoginLimiter } from "../server/platform/operational-login-limiter.mjs";
import { OperationalAuthenticationService } from "../server/platform/operational-authentication.mjs";

test("authentication gateway blocks repeated attempts before MFA", async () => {
  const db = new PGlite();
  try {
    const limiter = new OperationalLoginLimiter(db, "unique-service-secret-with-more-than-32-characters");
    await limiter.setup();
    let calls = 0;
    const service = new OperationalAuthenticationService({
      limiter, mfa: { authenticate: async () => { calls++; return null; } },
    });
    const input = {
      email: "person@example.com", password: "incorrect", code: "123456",
      trustedNetworkAddress: "198.51.100.2",
    };
    for (let i = 0; i < 5; i++)
      assert.equal((await service.login(input)).authenticated, false);
    const blocked = await service.login(input);
    assert.equal(blocked.authenticated, false);
    assert.ok(blocked.retryAfterSeconds > 0);
    assert.equal(calls, 5);
    assert.equal((await service.login({ ...input, trustedNetworkAddress: "" })).authenticated, false);
  } finally {
    await db.close();
  }
});

test("authentication gateway returns session only from successful MFA service", async () => {
  const db = new PGlite();
  try {
    const limiter = new OperationalLoginLimiter(db, "unique-service-secret-with-more-than-32-characters");
    await limiter.setup();
    const expected = { token: "opaque-token", expiresAt: new Date().toISOString() };
    const service = new OperationalAuthenticationService({
      limiter, mfa: { authenticate: async () => expected },
    });
    const result = await service.login({
      email: "person@example.com", password: "placeholder", code: "123456",
      trustedNetworkAddress: "198.51.100.3",
    });
    assert.equal(result.authenticated, true);
    assert.deepEqual(result.session, expected);
  } finally {
    await db.close();
  }
});
