import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { runOperationalNeonSmoke } from "../server/platform/operational-live-smoke.mjs";
import { smokeAllowed } from "../api/operacional-selftest.mjs";
import { operationalRuntimeAllowed } from "../api/operacional.mjs";

test("Neon smoke endpoint is unavailable outside the exact guarded Preview branch", () => {
  const ready = {
    VERCEL: "1", VERCEL_ENV: "preview",
    VERCEL_PROJECT_ID: "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq",
    VERCEL_GIT_COMMIT_REF: "feature/plataforma-operacional-preview",
    VERCEL_URL: "preview-synthetic.vercel.app",
    OLIVEIRA_OPS_ALLOWED_PROJECT_ID: "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq",
    OLIVEIRA_OPS_PREVIEW_ACK: "shared-project-preview-only",
    OLIVEIRA_OPS_ENABLED: "1",
    OLIVEIRA_OPS_STORE: "postgres",
    OLIVEIRA_OPS_DATABASE_SOURCE: "neon-vercel",
    DATABASE_URL: "postgresql://test.example.invalid/mock",
    NEON_PROJECT_ID: "synthetic",
    OLIVEIRA_OPS_DATA_KEY: "f".repeat(64),
    OLIVEIRA_OPS_RATE_SECRET: "minimum-length-rate-secret-123456789012",
    OLIVEIRA_OPS_SELFTEST_ENABLED: "1",
  };
  assert.equal(operationalRuntimeAllowed(ready), true);
  assert.equal(smokeAllowed(ready), true);
  for (const change of [
    { VERCEL_ENV: "production" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { OLIVEIRA_OPS_ENABLED: "0" },
    { OLIVEIRA_OPS_SELFTEST_ENABLED: "0" },
    { OLIVEIRA_OPS_DATA_KEY: "" },
  ]) assert.equal(smokeAllowed({ ...ready, ...change }), false);
});

test("Neon SQL and encrypted case smoke test leave no persistent rows", async () => {
  const db = new PGlite();
  const key = randomBytes(32).toString("hex");
  const staffId = randomUUID();
  const wrapper = { connect: async () => ({
    query: (...args) => db.query(...args),
    release: () => {},
  }) };
  try {
    await db.query(`CREATE TABLE oliveira_staff_accounts (
      id uuid PRIMARY KEY, email text NOT NULL, display_name text NOT NULL,
      role text NOT NULL, status text NOT NULL, secret_hash text NOT NULL,
      secret_salt text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      disabled_at timestamptz
    )`);
    await db.query(`CREATE TABLE oliveira_operational_cases (
      id uuid PRIMARY KEY, assigned_to uuid NOT NULL, reviewer_id uuid,
      status text NOT NULL, version bigint NOT NULL DEFAULT 1,
      encrypted_payload bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.query(`CREATE TABLE oliveira_staff_mfa(staff_id uuid)`);
    await db.query(`CREATE TABLE oliveira_staff_sessions(id uuid)`);
    await db.query(`CREATE TABLE oliveira_login_limits(bucket_key text)`);
    await db.query(`INSERT INTO oliveira_staff_accounts
      (id,email,display_name,role,status,secret_hash,secret_salt)
      VALUES($1,'real-ish-admin@example.invalid','Synthetic','admin','active','x','y')`, [staffId]);
    const before = await db.query("SELECT count(*)::int AS count FROM oliveira_operational_cases");
    const checks = await runOperationalNeonSmoke(wrapper, key);
    assert.equal(checks.isolatedCreate, "passed");
    assert.equal(checks.rollback, "passed");
    assert.equal(checks.persistentTestData, false);
    const after = await db.query("SELECT count(*)::int AS count FROM oliveira_operational_cases");
    assert.equal(after.rows[0].count, before.rows[0].count);
    const employees = await db.query("SELECT count(*)::int AS count FROM oliveira_staff_accounts");
    assert.equal(employees.rows[0].count, 1);
  } finally {
    await db.close();
  }
});
