import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createBootstrapService, matchesBootstrapToken }
  from "../server/platform/operational-bootstrap.mjs";
import { firstAdminSetupAllowed }
  from "../api/operacional-bootstrap.mjs";
import { totpForCounter }
  from "../server/platform/totp.mjs";
import { OperationalAccounts } from "../server/platform/operational-accounts.mjs";
import { OperationalMfa } from "../server/platform/operational-mfa.mjs";

test("bootstrap token comparison rejects short, invalid and mismatched codes", () => {
  const token = "setup-code-high-entropy-" + "a".repeat(50);
  assert.equal(matchesBootstrapToken(token, token), true);
  assert.equal(matchesBootstrapToken("123456", token), false);
  assert.equal(matchesBootstrapToken(token + "wrong", token), false);
  assert.equal(matchesBootstrapToken(token, undefined), false);
});

test("first-admin bootstrap is blocked outside exact Preview or without setup key", () => {
  const ok = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "feature/plataforma-operacional-preview",
    VERCEL_PROJECT_ID: "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq",
    VERCEL_URL: "oliveira-test-2026.vercel.app",
    OLIVEIRA_OPS_ALLOWED_PROJECT_ID: "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq",
    OLIVEIRA_OPS_PREVIEW_ACK: "shared-project-preview-only",
    OLIVEIRA_OPS_ENABLED: "0",
    OLIVEIRA_OPS_SETUP_ENABLED: "1",
    OLIVEIRA_OPS_SETUP_TOKEN: "a".repeat(64),
    OLIVEIRA_OPS_STORE: "postgres",
    OLIVEIRA_OPS_DATABASE_SOURCE: "neon-vercel",
    DATABASE_URL: "postgres://example.invalid/db",
    NEON_PROJECT_ID: "neon-synthetic",
    OLIVEIRA_OPS_DATA_KEY: "a".repeat(64),
    OLIVEIRA_OPS_RATE_SECRET: "secret-with-more-than-32-characters-value",
  };
  assert.equal(firstAdminSetupAllowed(ok), true);
  assert.equal(firstAdminSetupAllowed({ ...ok, OLIVEIRA_OPS_ENABLED: "auto" }), true);
  assert.equal(firstAdminSetupAllowed({ ...ok, OLIVEIRA_OPS_ENABLED: "auto",
    OLIVEIRA_OPS_SETUP_ENABLED: "0" }), false);
  for (const changed of [
    { VERCEL_ENV: "production" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_PROJECT_ID: "prj_unknown" },
    { OLIVEIRA_OPS_ENABLED: "1" },
    { OLIVEIRA_OPS_SETUP_ENABLED: "0" },
    { OLIVEIRA_OPS_SETUP_TOKEN: "short" },
    { DATABASE_URL: "" },
    { OLIVEIRA_OPS_DATA_KEY: "" },
  ]) {
    assert.equal(firstAdminSetupAllowed({ ...ok, ...changed }), false);
  }
});

test("first admin can be enrolled exactly once, MFA confirmed and used to log in", async () => {
  const db = new PGlite();
  const encryptionKey = randomBytes(32).toString("hex");
  const rateSecret = randomBytes(32).toString("base64url");
  const email = "admin@example.test";
  const password = "unique-and-very-long-administrator-password";
  try {
    const bootstrap = createBootstrapService({
      database: db, encryptionKey, rateSecret,
    });
    assert.deepEqual(await bootstrap.readiness(), { available: true, stage: "new" });
    const started = await bootstrap.start({
      email, name: "Admin sintético", password,
    });
    assert.equal(started.email, email);
    assert.deepEqual(await bootstrap.readiness(), { available: false, pending: true });
    assert.match(started.secret, /^[A-Z2-7]{20,}$/);

    const tables = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'oliveira_%'"
    );
    assert.equal(tables.rows.length, 5);
    await assert.rejects(
      bootstrap.start({ email: "other@example.test", name: "Other", password }),
      { status: 409 }
    );
    await assert.rejects(
      bootstrap.recover({ email, password: "completely-wrong-password" }),
      { status: 403 }
    );
    const recovered = await bootstrap.recover({ email, password });
    assert.match(recovered.secret, /^[A-Z2-7]{20,}$/);
    assert.notEqual(recovered.secret, started.secret);
    await assert.rejects(
      bootstrap.confirm({ email, code: "000000" }),
      { status: 422 }
    );
    const code = totpForCounter(recovered.secret, Math.floor(Date.now() / 30000));
    assert.deepEqual(await bootstrap.confirm({ email, code }), { activated: true });
    assert.deepEqual(await bootstrap.readiness(), { available: false, completed: true });

    const accounts = new OperationalAccounts(db);
    const active = await accounts.findByEmail(email);
    assert.equal(active.status, "active");
    const mfa = new OperationalMfa(accounts, encryptionKey);
    const nextWindowCode = totpForCounter(started.secret,
      Math.floor(Date.now() / 30000) + 1);
    await assert.rejects(
      bootstrap.confirm({ email, code: nextWindowCode }),
      { status: 409 }
    );
    const sessions = await db.query("SELECT count(*)::int AS n FROM oliveira_staff_sessions");
    assert.equal(sessions.rows[0].n, 0);
  } finally {
    await db.close();
  }
});
