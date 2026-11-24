import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { prepareStaffAccount, verifyStaffPassword } from "../server/platform/operational-identity.mjs";
import { OperationalAccounts } from "../server/platform/operational-accounts.mjs";

test("Postgres staff accounts survive repository recreation and sessions revoke", async () => {
  const db = new PGlite();
  try {
    const first = new OperationalAccounts(db);
    await first.setup();
    const secret = "A-long-enough-test-password-that-is-random-for-this-test";
    const prepared = await prepareStaffAccount({
      email: "staff@example.com", name: "Atendimento", role: "operator", password: secret,
    });
    const inserted = await first.createPrepared(prepared);
    assert.equal(inserted.status, "pending-mfa");
    assert.equal(await first.findByEmail("unlisted@example.com"), null);
    assert.equal(await first.getSession("invalid"), null);
    await assert.rejects(first.createSession(prepared, { mfaVerified: true }));
    const active = await first.changeStatus(prepared.id, "active");
    assert.equal(active.status, "active");

    const second = new OperationalAccounts(db);
    const account = await second.findByEmail("STAFF@EXAMPLE.COM");
    assert.equal(await verifyStaffPassword(account, secret), true);
    await assert.rejects(second.createSession(account, { mfaVerified: false }));
    const session = await second.createSession(account, { mfaVerified: true });
    assert.equal((await first.getSession(session.token)).email, "staff@example.com");
    assert.equal(await second.getSession("bad-token"), null);
    await second.revoke(session.token);
    assert.equal(await first.getSession(session.token), null);

    const session2 = await second.createSession(account, { mfaVerified: true });
    await first.changeStatus(prepared.id, "disabled");
    assert.equal(await second.getSession(session2.token), null);
    assert.equal((await second.findByEmail(account.email)).status, "disabled");
    await assert.rejects(second.createSession(account, { mfaVerified: true }));
  } finally {
    await db.close();
  }
});

test("staff sessions expire and require real MFA verification", async () => {
  const db = new PGlite();
  try {
    let time = Date.now();
    const records = new OperationalAccounts(db, { now: () => time });
    await records.setup();
    const prepared = await prepareStaffAccount({
      email: "reviewer@example.com", name: "Revisora", role: "reviewer",
      password: "Long-passphrase-for-a-reviewer-account",
    });
    await records.createPrepared(prepared);
    await records.changeStatus(prepared.id, "active");
    const active = await records.findByEmail(prepared.email);
    await assert.rejects(records.createSession(active, { mfaVerified: false }));
    const session = await records.createSession(active, { mfaVerified: true, lifetimeMs: 60000 });
    time += 60001;
    assert.equal(await records.getSession(session.token), null);
  } finally {
    await db.close();
  }
});


test("only active admins can list staff or disable non-admins with session revocation", async () => {
  const db = new PGlite();
  try {
    const accounts = new OperationalAccounts(db);
    await accounts.setup();
    const admin = await prepareStaffAccount({
      email:"admin@example.test", name:"Admin",role:"admin",
      password:"A-long-admin-secret-for-test-only",
    });
    const worker = await prepareStaffAccount({
      email:"worker@example.test", name:"Worker",role:"operator",
      password:"A-long-worker-secret-for-test-only",
    });
    for (const account of [admin,worker]) {
      await accounts.createPrepared(account);
      await accounts.changeStatus(account.id,"active");
    }
    await assert.rejects(accounts.listStaff(worker.id),{status:403});
    const visible=await accounts.listStaff(admin.id);
    assert.equal(visible.length,2);
    assert.ok(visible.every(x=>!Object.hasOwn(x,"secret_hash") && !Object.hasOwn(x,"secret_salt")));
    const workerSession=await accounts.createSession(
      await accounts.findByEmail(worker.email),{mfaVerified:true});
    assert.equal((await accounts.getSession(workerSession.token)).role,"operator");
    await assert.rejects(accounts.disableStaff(admin.id,admin.id),{status:422});
    await assert.rejects(accounts.disableStaff(worker.id,admin.id),{status:404});
    await assert.rejects(accounts.disableStaff(worker.id,worker.id),{status:422});
    assert.deepEqual(await accounts.disableStaff(admin.id,worker.id),
      {id:worker.id,status:"disabled"});
    assert.equal(await accounts.getSession(workerSession.token),null);
    assert.equal((await accounts.findByEmail(worker.email)).status,"disabled");
    await assert.rejects(accounts.disableStaff(admin.id,worker.id),{status:404});
    assert.equal((await accounts.listStaff(admin.id)).length,2);
  } finally { await db.close(); }
});
