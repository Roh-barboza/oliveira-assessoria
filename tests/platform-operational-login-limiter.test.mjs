import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { OperationalLoginLimiter } from "../server/platform/operational-login-limiter.mjs";

test("database login limits survive instance restart and expire", async () => {
  const db = new PGlite();
  let now = 1000000;
  try {
    const first = new OperationalLoginLimiter(db, "strong-secret-with-more-than-thirty-two-bytes", { now: () => now });
    await first.setup();
    assert.notEqual(first.key("user", "person@example.com"), "person@example.com");
    for (let i = 0; i < 5; i++) {
      assert.equal((await first.checkLogin("person@example.com", "192.0.2.1")).allowed, true);
    }
    const second = new OperationalLoginLimiter(db, "strong-secret-with-more-than-thirty-two-bytes", { now: () => now });
    const blocked = await second.checkLogin("PERSON@EXAMPLE.COM", "192.0.2.1");
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);
    assert.equal((await second.checkLogin("other@example.com", "192.0.2.2")).allowed, true);
    now += 900001;
    assert.equal((await first.checkLogin("person@example.com", "192.0.2.1")).allowed, true);
  } finally {
    await db.close();
  }
});

test("network-wide limits block distributed accounts, without logging raw identity", async () => {
  const db = new PGlite();
  try {
    const limiter = new OperationalLoginLimiter(db, "another-long-secret-with-more-than-thirty-two-bytes");
    await limiter.setup();
    for (let i = 0; i < 25; i++)
      assert.equal((await limiter.checkLogin(`u${i}@example.com`, "203.0.113.1")).allowed, true);
    assert.equal((await limiter.checkLogin("u25@example.com", "203.0.113.1")).allowed, false);
    assert.equal((await limiter.checkLogin("u25@example.com", "203.0.113.2")).allowed, true);
    const rows = await db.query("SELECT bucket_key FROM oliveira_login_limits");
    assert.ok(rows.rows.every((r) => /^[a-f0-9]{64}$/.test(r.bucket_key)));
    assert.throws(() => new OperationalLoginLimiter(db, "short"));
    await assert.rejects(limiter.take("user", "someone", { maxAttempts: 0, windowMs: 10000 }));
  } finally {
    await db.close();
  }
});
