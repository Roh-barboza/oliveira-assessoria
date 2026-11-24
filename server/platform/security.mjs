import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export function equalHex(value, expected) {
  return (
    typeof value === "string" &&
    typeof expected === "string" &&
    /^[a-f0-9]{64}$/.test(value) &&
    /^[a-f0-9]{64}$/.test(expected) &&
    timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(expected, "hex"))
  );
}

export async function passwordHash(password, salt) {
  return (
    await promisify(scrypt)(password, Buffer.from(salt, "hex"), 32)
  ).toString("hex");
}

export function validWebhook(raw, signature, secret) {
  return (
    typeof signature === "string" &&
    signature.startsWith("sha256=") &&
    equalHex(
      signature.slice(7),
      createHmac("sha256", secret).update(raw).digest("hex"),
    )
  );
}

export function encryption(key) {
  if (!/^[a-f0-9]{64}$/i.test(key ?? ""))
    throw new Error("CONTRACT_ENCRYPTION_KEY inválida");
  const bytes = Buffer.from(key, "hex");
  return {
    seal(value, context) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", bytes, nonce);
      cipher.setAAD(Buffer.from(context));
      const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
      return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]);
    },
    open(value, context) {
      const encrypted = Buffer.from(value);
      const decipher = createDecipheriv(
        "aes-256-gcm",
        bytes,
        encrypted.subarray(0, 12),
      );
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(encrypted.subarray(12, 28));
      return Buffer.concat([
        decipher.update(encrypted.subarray(28)),
        decipher.final(),
      ]);
    },
  };
}
