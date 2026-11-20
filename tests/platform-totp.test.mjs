import test from "node:test";
import assert from "node:assert/strict";
import { generateTotpSecret, totpForCounter, verifyTotp } from "../server/platform/totp.mjs";

test("TOTP follows RFC 6238 SHA1 vector", () => {
  // Base32 for ASCII "12345678901234567890".
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpForCounter(secret, 1, 8), "94287082");
  assert.equal(totpForCounter(secret, 1), "287082");
  assert.equal(verifyTotp(secret, "287082", { now: 59000, window: 0 }), 1);
});
test("TOTP secrets and codes reject replay and malformed input", () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  const at = 120000;
  const code = totpForCounter(secret, 4);
  assert.equal(verifyTotp(secret, code, { now: at }), 4);
  assert.equal(verifyTotp(secret, code, { now: at, lastCounter: 4 }), null);
  assert.equal(verifyTotp(secret, code, { now: at + 60000 }), null);
  assert.equal(verifyTotp(secret, "123", { now: at }), null);
  assert.equal(verifyTotp(secret, 123456, { now: at }), null);
  assert.throws(() => totpForCounter("invalid", 1));
});
