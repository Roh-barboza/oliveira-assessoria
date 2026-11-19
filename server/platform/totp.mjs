import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 6238 TOTP. This module validates possession of an authenticator.
// Enrollment and one-time replay prevention must be enforced by the database.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function generateTotpSecret() {
  const bytes = randomBytes(20);
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}
function decodeBase32(secret) {
  if (typeof secret !== "string" || !/^[A-Z2-7]{32}$/.test(secret))
    throw new Error("Segredo TOTP inválido.");
  const bytes = [];
  let bits = 0, value = 0;
  for (const char of secret) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}
export function totpForCounter(secret, counter, digits = 6) {
  if (!Number.isSafeInteger(counter) || counter < 0 || ![6, 8].includes(digits))
    throw new Error("Parâmetros TOTP inválidos.");
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", decodeBase32(secret)).update(msg).digest();
  const offset = hash.at(-1) & 15;
  const code = (hash.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits);
  return String(code).padStart(digits, "0");
}
export function verifyTotp(secret, code, { now = Date.now(), lastCounter = -1, window = 1 } = {}) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code) ||
      !Number.isFinite(now) || !Number.isInteger(window) || window < 0 || window > 1 ||
      !Number.isSafeInteger(lastCounter)) return null;
  const counter = Math.floor(now / 30000);
  for (let shift = -window; shift <= window; shift++) {
    const candidate = counter + shift;
    if (candidate < 0 || candidate <= lastCounter) continue;
    const actual = totpForCounter(secret, candidate);
    if (timingSafeEqual(Buffer.from(code), Buffer.from(actual))) return candidate;
  }
  return null;
}
