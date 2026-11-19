import { randomBytes, randomUUID, scrypt as callbackScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(callbackScrypt);
const STAFF_ROLES = new Set(["admin", "operator", "reviewer"]);
const HASH_BYTES = 32;
const MAX_PASSWORD_LENGTH = 1024;

const validEmail = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function validatePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 14 ||
    password.length > MAX_PASSWORD_LENGTH ||
    Buffer.byteLength(password, "utf8") > 4096
  ) throw new Error("Senha deve ter entre 14 e 1024 caracteres.");
}

async function derive(password, salt) {
  return Buffer.from(await scrypt(password, salt, HASH_BYTES, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  }));
}

/**
 * Provisioning primitive only. Account enrollment, MFA, sessions,
 * rate limiting and storage must be integrated before production use.
 */
export async function prepareStaffAccount({ email, name, role, password }) {
  if (!validEmail(email)) throw new Error("E-mail inválido.");
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    throw new Error("Nome inválido.");
  if (!STAFF_ROLES.has(role)) throw new Error("Perfil não permitido.");
  validatePassword(password);

  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return {
    id: randomUUID(),
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role,
    status: "pending-mfa",
    password: {
      algorithm: "scrypt-v1",
      salt: salt.toString("hex"),
      hash: hash.toString("hex"),
    },
    createdAt: new Date().toISOString(),
  };
}

export async function verifyStaffPassword(account, candidate) {
  // The password match must not alone authorize access: account status,
  // MFA, rate limits and session policy are separate mandatory checks.
  const fallbackSalt = Buffer.alloc(16);
  const salt = account?.password?.algorithm === "scrypt-v1" &&
    /^[a-f0-9]{32}$/.test(account.password.salt || "")
    ? Buffer.from(account.password.salt, "hex")
    : fallbackSalt;
  const expected = account?.password?.algorithm === "scrypt-v1" &&
    /^[a-f0-9]{64}$/.test(account.password.hash || "")
    ? Buffer.from(account.password.hash, "hex")
    : Buffer.alloc(HASH_BYTES);
  const safeCandidate = typeof candidate === "string" && candidate.length <= MAX_PASSWORD_LENGTH
    ? candidate : "";
  const actual = await derive(safeCandidate, salt);
  return account?.status !== "disabled" &&
    account?.password?.algorithm === "scrypt-v1" &&
    timingSafeEqual(actual, expected);
}

export function isStaffAuthorized(account, { mfaVerified = false } = {}) {
  return Boolean(
    account &&
    account.status === "active" &&
    STAFF_ROLES.has(account.role) &&
    mfaVerified === true
  );
}

export function disableStaffAccount(account) {
  return { ...account, status: "disabled", disabledAt: new Date().toISOString() };
}
