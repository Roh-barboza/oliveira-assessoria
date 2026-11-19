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
