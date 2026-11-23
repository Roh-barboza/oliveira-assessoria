import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { runOperationalNeonSmoke } from "../server/platform/operational-live-smoke.mjs";

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
