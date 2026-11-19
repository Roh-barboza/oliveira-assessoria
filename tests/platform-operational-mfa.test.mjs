import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { prepareStaffAccount } from "../server/platform/operational-identity.mjs";
import { OperationalAccounts } from "../server/platform/operational-accounts.mjs";
import { OperationalMfa } from "../server/platform/operational-mfa.mjs";
import { totpForCounter } from "../server/platform/totp.mjs";

test("MFA enrollment is encrypted; login needs password, TOTP and rejects replay", async () => {
  const db = new PGlite();
  const key = randomBytes(32).toString("hex");
  let now = 120000;
  try {
    const accounts = new OperationalAccounts(db, { now: () => now });
    await accounts.setup();
    const mfa = new OperationalMfa(accounts, key, { now: () => now });
    await mfa.setup();
    const password = "A-unique-long-password-for-the-operational-account";
    const account = await prepareStaffAccount({
      email: "operator@example.com", name: "Operador", role: "operator", password,
    });
    await accounts.createPrepared(account);
    assert.equal(await mfa.authenticate(account.email, password, "123456"), null);
    const { secret } = await mfa.startEnrollment(account.id);
    const stored = await db.query("SELECT secret FROM oliveira_staff_mfa WHERE staff_id=$1", [account.id]);
    assert.equal(Buffer.from(stored.rows[0].secret).includes(Buffer.from(secret)), false);
    const code = totpForCounter(secret, 4);
    assert.equal(await mfa.confirmEnrollment(account.id, code), true);
    assert.equal(await mfa.confirmEnrollment(account.id, code), false);
    assert.equal(await mfa.authenticate(account.email, password, code), null);
    now = 150000;
    const nextCode = totpForCounter(secret, 5);
    assert.equal(await mfa.authenticate(account.email, "bad-password", nextCode), null);
    const session = await mfa.authenticate(account.email, password, nextCode);
    assert.equal(typeof session.token, "string");
    assert.equal((await accounts.getSession(session.token)).email, account.email);
    assert.equal(await mfa.authenticate(account.email, password, nextCode), null);
    await accounts.changeStatus(account.id, "disabled");
    assert.equal(await accounts.getSession(session.token), null);
  } finally {
    await db.close();
  }
});

test("MFA rejects incorrect encryption key without issuing a session", async () => {
  const db = new PGlite();
  try {
    const accounts = new OperationalAccounts(db, { now: () => 120000 });
    await accounts.setup();
    const first = new OperationalMfa(accounts, randomBytes(32).toString("hex"), { now: () => 120000 });
    await first.setup();
    const account = await prepareStaffAccount({
      email: "another@example.com", name: "Pessoa", role: "reviewer",
      password: "Another-long-password-for-the-operational-account",
    });
    await accounts.createPrepared(account);
    const { secret } = await first.startEnrollment(account.id);
    const second = new OperationalMfa(accounts, randomBytes(32).toString("hex"), { now: () => 120000 });
    assert.equal(await second.confirmEnrollment(account.id, totpForCounter(secret, 4)), false);
  } finally {
    await db.close();
  }
});
