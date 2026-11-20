import { Pool } from "pg";
import { operationalDatabaseUrl } from "../server/platform/operational-db-env.mjs";
import { OperationalAccounts } from "../server/platform/operational-accounts.mjs";
import { OperationalMfa } from "../server/platform/operational-mfa.mjs";
import { OperationalLoginLimiter } from "../server/platform/operational-login-limiter.mjs";
import { OperationalCases } from "../server/platform/operational-cases.mjs";
import { prepareStaffAccount } from "../server/platform/operational-identity.mjs";

// Controlled one-time preparation for a separately provisioned PostgreSQL.
// Never send credentials, database URLs or authenticator secrets via chat.
const [command] = process.argv.slice(2);
const env = process.env;
if (!["migrate", "admin", "confirm"].includes(command)) {
  console.error("Uso: node scripts/operations-setup.mjs migrate|admin|confirm");
  process.exit(2);
}
if (env.OLIVEIRA_OPS_SETUP_ACK !== "dedicated-postgres-reviewed") {
  console.error("Confirme que o banco PostgreSQL é exclusivo deste sistema.");
  process.exit(2);
}
if (!operationalDatabaseUrl(env) ||
    !/^[a-f0-9]{64}$/.test(env.OLIVEIRA_OPS_DATA_KEY || "") ||
    (env.OLIVEIRA_OPS_RATE_SECRET || "").length < 32) {
  console.error("Configure conexão e segredos do sistema operacional fora do Git.");
  process.exit(2);
}
const pool = new Pool({
  connectionString: operationalDatabaseUrl(env),
  max: 2, connectionTimeoutMillis: 8000,
});
try {
  const client = await pool.connect();
  try {
    const accounts = new OperationalAccounts(client);
    const mfa = new OperationalMfa(accounts, env.OLIVEIRA_OPS_DATA_KEY);
    const limiter = new OperationalLoginLimiter(client, env.OLIVEIRA_OPS_RATE_SECRET);
    const cases = new OperationalCases(client, env.OLIVEIRA_OPS_DATA_KEY);
    if (command === "migrate") {
      await accounts.setup();
      await mfa.setup();
      await limiter.setup();
      await cases.setup();
      console.log("Migrações operacionais aplicadas ao banco dedicado.");
    } else if (command === "admin") {
      const email = env.OLIVEIRA_OPS_ADMIN_EMAIL;
      const name = env.OLIVEIRA_OPS_ADMIN_NAME;
      const password = env.OLIVEIRA_OPS_ADMIN_PASSWORD;
      const prepared = await prepareStaffAccount({ email, name, password, role: "admin" });
      await client.query("BEGIN");
      let enrollment;
      try {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('oliveira-ops-bootstrap'))");
        const { rows } = await client.query("SELECT count(*)::int AS total FROM oliveira_staff_accounts");
        if (rows[0].total !== 0)
          throw new Error("Bootstrap permitido somente com banco sem contas.");
        await accounts.createPrepared(prepared);
        enrollment = await mfa.startEnrollment(prepared.id);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      // Private local console only. Never paste this output into a chat or log.
      console.log("Administrador pendente de ativação.");
      console.log("Cadastre este segredo no seu aplicativo autenticador e NÃO compartilhe:");
      console.log(enrollment.secret);
      console.log("Execute 'confirm' com o código TOTP em outro momento.");
    } else {
      const email = env.OLIVEIRA_OPS_ADMIN_EMAIL;
      const code = env.OLIVEIRA_OPS_ADMIN_CODE;
      const account = await accounts.findByEmail(email);
      if (!account || account.role !== "admin" || account.status !== "pending-mfa")
        throw new Error("Cadastro administrador pendente não encontrado.");
      if (!/^\d{6}$/.test(code || "") ||
          !(await mfa.confirmEnrollment(account.id, code)))
        throw new Error("Código inválido ou já utilizado.");
      console.log("Administrador ativado com MFA.");
    }
  } finally { client.release(); }
} catch (error) {
  console.error("Preparação operacional falhou:", error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
