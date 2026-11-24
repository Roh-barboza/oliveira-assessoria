import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { OperationalAccounts } from "../server/platform/operational-accounts.mjs";
import { OperationalMfa } from "../server/platform/operational-mfa.mjs";
import { OperationalLoginLimiter } from "../server/platform/operational-login-limiter.mjs";
import { OperationalCases } from "../server/platform/operational-cases.mjs";
import { prepareStaffAccount } from "../server/platform/operational-identity.mjs";
import { totpForCounter } from "../server/platform/totp.mjs";
import { composeOperationalApp } from "../server/platform/operational-runtime.mjs";
import { operationalRuntimeAllowed, operationalOrigin } from "../api/operacional.mjs";
import { operationalDatabaseUrl } from "../server/platform/operational-db-env.mjs";

test("single-project operational API stays Preview-only with explicit secrets and branch", () => {
  const ready = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "feature/plataforma-operacional-preview",
    VERCEL_PROJECT_ID: "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq",
    OLIVEIRA_OPS_ALLOWED_PROJECT_ID: "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq",
    OLIVEIRA_OPS_PREVIEW_ACK: "shared-project-preview-only",
    OLIVEIRA_OPS_ENABLED: "1",
    OLIVEIRA_OPS_ORIGIN: "https://oliveira-test-2026.vercel.app",
    OLIVEIRA_OPS_STORE: "postgres",
    OLIVEIRA_OPS_DATABASE_SOURCE: "neon-vercel",
    DATABASE_URL: "postgresql://example.invalid/db",
    NEON_PROJECT_ID: "neon-test-project",
    OLIVEIRA_OPS_DATA_KEY: "a".repeat(64),
    OLIVEIRA_OPS_RATE_SECRET: "secret-key-with-more-than-32-character-data",
  };
  assert.equal(operationalRuntimeAllowed(ready), true);
  const automatic = { ...ready, OLIVEIRA_OPS_ENABLED: "auto",
    OLIVEIRA_OPS_SETUP_ENABLED: "1", OLIVEIRA_OPS_SETUP_TOKEN: "b".repeat(64) };
  assert.equal(operationalRuntimeAllowed(automatic), true);
  assert.equal(operationalRuntimeAllowed({ ...automatic,
    OLIVEIRA_OPS_SETUP_ENABLED: "0" }), false);
  assert.equal(operationalRuntimeAllowed({ ...automatic,
    OLIVEIRA_OPS_SETUP_TOKEN: "" }), false);
  const autoOrigin = { ...ready, OLIVEIRA_OPS_ORIGIN: undefined,
    VERCEL_URL: "oliveira-test-2026.vercel.app" };
  assert.equal(operationalRuntimeAllowed(autoOrigin), true);
  assert.equal(operationalOrigin(autoOrigin), "https://oliveira-test-2026.vercel.app");
  assert.equal(operationalRuntimeAllowed({ ...autoOrigin, VERCEL_URL: "" }), false);
  assert.equal(operationalRuntimeAllowed({ ...autoOrigin,
    VERCEL_URL: "oliveira-assessoria.vercel.app" }), false);
  for (const changed of [
    { VERCEL_ENV: "production" },
    { VERCEL_PROJECT_ID: "prj_unrelated_other_project" },
    { OLIVEIRA_OPS_PREVIEW_ACK: "" },
    { OLIVEIRA_OPS_ORIGIN: "https://oliveira-assessoria.vercel.app" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { OLIVEIRA_OPS_ENABLED: "0" },
    { DATABASE_URL: "" },
    { NEON_PROJECT_ID: "" },
    { OLIVEIRA_OPS_DATABASE_SOURCE: "" },
    { OLIVEIRA_OPS_ORIGIN: "http://ops.example.test" },
    { OLIVEIRA_OPS_ORIGIN: "https://example.test" },
    { OLIVEIRA_OPS_ALLOWED_PROJECT_ID: "prj_other" },
  ]) {
    assert.equal(operationalRuntimeAllowed({ ...ready, ...changed }), false);
  }
});

test("Neon integration URL is selected only with explicit source and project identity", () => {
  const integrated = {
    OLIVEIRA_OPS_DATABASE_SOURCE: "neon-vercel",
    NEON_PROJECT_ID: "neon-project",
    DATABASE_URL: "postgresql://example.invalid/neon",
  };
  assert.equal(operationalDatabaseUrl(integrated), integrated.DATABASE_URL);
  assert.equal(operationalDatabaseUrl({ ...integrated, NEON_PROJECT_ID: "" }), null);
  assert.equal(operationalDatabaseUrl({ ...integrated, OLIVEIRA_OPS_DATABASE_SOURCE: "" }), null);
  assert.equal(operationalDatabaseUrl({ ...integrated, DATABASE_URL: "http://example.invalid" }), null);
  const dedicated = {
    OLIVEIRA_OPS_DATABASE_SOURCE: "dedicated-url",
    OLIVEIRA_OPS_DATABASE_URL: "postgres://example.invalid/dedicated",
    DATABASE_URL: integrated.DATABASE_URL,
  };
  assert.equal(operationalDatabaseUrl(dedicated), dedicated.OLIVEIRA_OPS_DATABASE_URL);
});

test("staff logs in with MFA and manages encrypted cases across a full HTTP journey", async () => {
  const db = new PGlite();
  const origin = "https://ops.example.test";
  const key = randomBytes(32).toString("hex");
  const password = "Long-random-passphrase-for-operational-integration";
  try {
    const accounts = new OperationalAccounts(db);
    await accounts.setup();
    const mfa = new OperationalMfa(accounts, key);
    await mfa.setup();
    await new OperationalLoginLimiter(db, "a-separate-rate-limit-secret-with-32-bytes").setup();
    await new OperationalCases(db, key).setup();
    const prepared = await prepareStaffAccount({
      email: "admin@example.test", name: "Administrador sintético",
      role: "admin", password,
    });
    await accounts.createPrepared(prepared);
    const { secret } = await mfa.startEnrollment(prepared.id);
    // Enrollment verification has separate tests; use a provisioned fake
    // authenticator here to avoid waiting for a second TOTP time window.
    await db.query("UPDATE oliveira_staff_mfa SET confirmed=true WHERE staff_id=$1", [prepared.id]);
    await accounts.changeStatus(prepared.id,"active");
    const code = totpForCounter(secret, Math.floor(Date.now()/30000));
    const app = composeOperationalApp({
      database: db, encryptionKey: key,
      rateLimitSecret: "a-separate-rate-limit-secret-with-32-bytes",
      allowedOrigin: origin, networkIdentity: () => "192.0.2.15",
    });
    const call = (op, { method="GET", body, cookie, id } = {}) =>
      app(new Request(origin + "/api/operacional?op=" + op + (id ? "&id=" + id : ""), {
        method,
        headers: { ...(method === "POST" ? { origin, "content-type":"application/json" } : {}),
          ...(cookie ? { cookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }));
    assert.equal((await (await call("session")).json()).authenticated, false);
    const wrong = await call("login",{ method:"POST",
      body:{ email:"admin@example.test", password:"not-right",code } });
    assert.equal(wrong.status,401);
    const login = await call("login",{ method:"POST",
      body:{ email:"admin@example.test", password,code } });
    assert.equal(login.status,200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const session = await (await call("session",{cookie})).json();
    assert.equal(session.user.role,"admin");
    const created = await call("case-create",{method:"POST",cookie,
      body:{title:"Caso de integração sintética",service:"Documentação",notes:"Apenas para teste"}});
    assert.equal(created.status,201);
    const item = (await created.json()).case;
    assert.equal(item.version,1);
    const list = await (await call("case-list",{cookie})).json();
    assert.equal(list.cases.length,1);
    const change = await call("case-status",{method:"POST",cookie,
      body:{id:item.id,nextStatus:"conferencia",expectedVersion:item.version}});
    assert.equal(change.status,200);
    assert.equal((await change.json()).case.version,2);
    const rejected = await call("case-status",{method:"POST",cookie,
      body:{id:item.id,nextStatus:"preparado",expectedVersion:1}});
    assert.equal(rejected.status,409);
    const stored = await db.query("SELECT encrypted_payload FROM oliveira_operational_cases");
    assert.equal(Buffer.from(stored.rows[0].encrypted_payload).includes(
      Buffer.from("Caso de integração sintética")),false);
    await call("logout",{method:"POST",cookie});
    assert.equal((await (await call("session",{cookie})).json()).authenticated,false);
  } finally {
    await db.close();
  }
});
