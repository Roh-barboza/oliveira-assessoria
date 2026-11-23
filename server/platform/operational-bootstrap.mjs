import { createHash, timingSafeEqual } from "node:crypto";
import { OperationalAccounts } from "./operational-accounts.mjs";
import { OperationalMfa } from "./operational-mfa.mjs";
import { OperationalCases } from "./operational-cases.mjs";
import { OperationalLoginLimiter } from "./operational-login-limiter.mjs";
import { prepareStaffAccount } from "./operational-identity.mjs";

const statusError = (status, message) =>
  Object.assign(new Error(message), { status });

/**
 * Compare high-entropy setup codes without logging or persisting them.
 * The plain code lives exclusively in Vercel's branch-scoped secret store
 * and the administrator's browser during activation.
 */
export function matchesBootstrapToken(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string" ||
      candidate.length < 48 || candidate.length > 256 ||
      expected.length < 48 || expected.length > 256) return false;
  const hash = (v) => createHash("sha256").update(v).digest();
  return timingSafeEqual(hash(candidate), hash(expected));
}

export function createBootstrapService({ database, encryptionKey, rateSecret }) {
  if (typeof database?.query !== "function" ||
      typeof encryptionKey !== "string" || !/^[0-9a-f]{64}$/.test(encryptionKey) ||
      typeof rateSecret !== "string" || Buffer.byteLength(rateSecret) < 32)
    throw new Error("Configuração de ativação inválida.");

  const accounts = new OperationalAccounts(database);
  const mfa = new OperationalMfa(accounts, encryptionKey);
  const limiter = new OperationalLoginLimiter(database, rateSecret);

  return {
    async readiness() {
      // Read-only Neon connectivity + first-admin status check.
      // No GET request may create schema or change credentials.
      await database.query("SELECT 1");
      const table = await database.query(
        "SELECT to_regclass('public.oliveira_staff_accounts') AS name"
      );
      if (!table.rows[0]?.name) return { available: true, stage: "new" };
      const existing = await database.query(
        "SELECT role,status FROM oliveira_staff_accounts ORDER BY created_at LIMIT 2"
      );
      if (!existing.rows.length) return { available: true, stage: "new" };
      if (existing.rows.some(row => row.role === "admin" && row.status === "active"))
        return { available: false, completed: true };
      return { available: false, pending: true };
    },
    async start({ email, name, password }) {
      // The first-user operation is serialized in Postgres across Vercel
      // function instances. No other accounts may already exist.
      if (typeof email !== "string" || typeof name !== "string" ||
          typeof password !== "string")
        throw statusError(422, "Dados inválidos.");
      const prepared = await prepareStaffAccount({ email, name, password, role: "admin" });
      const client = typeof database.connect === "function"
        ? await database.connect() : database;
      let inTransaction = false;
      try {
        await client.query("BEGIN");
        inTransaction = true;
        await client.query("SELECT pg_advisory_xact_lock(hashtext('oliveira-ops-first-admin'))");
        const txAccounts = new OperationalAccounts(client);
        await txAccounts.setup();
        const txMfa = new OperationalMfa(txAccounts, encryptionKey);
        await txMfa.setup();
        await new OperationalLoginLimiter(client, rateSecret).setup();
        await new OperationalCases(client, encryptionKey).setup();
        const { rows } = await client.query(
          "SELECT count(*)::int AS total FROM oliveira_staff_accounts"
        );
        if (Number(rows[0].total) !== 0)
          throw statusError(409, "O primeiro administrador já foi cadastrado.");
        await txAccounts.createPrepared(prepared);
        const { secret } = await txMfa.startEnrollment(prepared.id);
        await client.query("COMMIT");
        inTransaction = false;
        return { secret, email: prepared.email };
      } catch (error) {
        if (inTransaction) await client.query("ROLLBACK");
        throw error;
      } finally {
        if (client !== database) client.release();
      }
    },
    async confirm({ email, code }) {
      if (typeof email !== "string" || email.length > 254 ||
          typeof code !== "string" || !/^\d{6}$/.test(code))
        throw statusError(422, "Dados inválidos.");
      // The secret setup code was already verified at the HTTP boundary.
      // Rate limit TOTP guesses even when the administrator is pending.
      const allowed = await limiter.checkLogin(email, "first-admin-activation");
      if (!allowed.allowed)
        throw statusError(429, "Muitas tentativas. Tente mais tarde.");
      const account = await accounts.findByEmail(email);
      if (!account || account.role !== "admin" || account.status !== "pending-mfa")
        throw statusError(409, "Ativação não disponível.");
      if (!(await mfa.confirmEnrollment(account.id, code)))
        throw statusError(422, "Código inválido.");
      return { activated: true };
    },
  };
}
