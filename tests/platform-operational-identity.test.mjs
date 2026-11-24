import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareStaffAccount,
  verifyStaffPassword,
  isStaffAuthorized,
  disableStaffAccount,
} from "../server/platform/operational-identity.mjs";

test("staff passwords are salted and not stored in cleartext", async () => {
  const password = "A-very-long-passphrase-with-unique-contents-2026";
  const input = { email: "Team@Example.com", name: " Operadora ", role: "operator", password };
  const first = await prepareStaffAccount(input);
  const second = await prepareStaffAccount(input);
  assert.equal(first.email, "team@example.com");
  assert.equal(first.name, "Operadora");
  assert.equal(first.status, "pending-mfa");
  assert.notEqual(first.password.salt, second.password.salt);
  assert.notEqual(first.password.hash, second.password.hash);
  assert.equal(JSON.stringify(first).includes(password), false);
  assert.equal(await verifyStaffPassword(first, password), true);
  assert.equal(await verifyStaffPassword(first, "wrong-password"), false);
  assert.equal(await verifyStaffPassword(null, password), false);
});

test("no staff access without activation and independent MFA verification", async () => {
  const account = await prepareStaffAccount({
    email: "admin@example.com", name: "Administradora",
    role: "admin", password: "Strong-admin-passphrase-with-unique-contents",
  });
  assert.equal(isStaffAuthorized(account, { mfaVerified: true }), false);
  const active = { ...account, status: "active" };
  assert.equal(isStaffAuthorized(active), false);
  assert.equal(isStaffAuthorized(active, { mfaVerified: true }), true);
  const disabled = disableStaffAccount(active);
  assert.equal(isStaffAuthorized(disabled, { mfaVerified: true }), false);
  assert.equal(await verifyStaffPassword(disabled, "Strong-admin-passphrase-with-unique-contents"), false);
});

test("staff enrollment refuses weak credentials and unknown roles", async () => {
  const base = { email: "person@example.com", name: "Pessoa", role: "operator", password: "A-long-passphrase-123456" };
  await assert.rejects(prepareStaffAccount({ ...base, password: "short" }));
  await assert.rejects(prepareStaffAccount({ ...base, role: "customer" }));
  await assert.rejects(prepareStaffAccount({ ...base, email: "invalid" }));
  await assert.rejects(prepareStaffAccount({ ...base, name: "" }));
});
