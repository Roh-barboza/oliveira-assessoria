import { randomUUID } from "node:crypto";
import { OperationalCases } from "./operational-cases.mjs";

/**
 * Live Neon smoke check without persistent test data.
 * Runs solely inside a single DB connection and rolls back a transaction.
 * Two temporary shadow tables intercept unqualified operational queries;
 * production staff and cases are never modified.
 */
export async function runOperationalNeonSmoke(database, encryptionKey) {
  if (typeof database?.connect !== "function" ||
      !/^[a-f0-9]{64}$/.test(encryptionKey || ""))
    throw new Error("Teste operacional não configurado.");
  const client = await database.connect();
  let transaction = false;
  try {
    await client.query("BEGIN");
    transaction = true;
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    for (const table of [
      "oliveira_staff_accounts",
      "oliveira_staff_mfa",
      "oliveira_staff_sessions",
      "oliveira_login_limits",
      "oliveira_operational_cases",
    ]) {
      await client.query("SELECT 1 FROM public." + table + " LIMIT 0");
    }
    const active = await client.query(
      "SELECT EXISTS(SELECT 1 FROM public.oliveira_staff_accounts WHERE role='admin' AND status='active') AS ok"
    );
    if (active.rows[0]?.ok !== true)
      throw new Error("Administrador MFA não confirmado.");

    await client.query("CREATE TEMP TABLE oliveira_staff_accounts (LIKE public.oliveira_staff_accounts INCLUDING ALL)");
    await client.query("CREATE TEMP TABLE oliveira_operational_cases (LIKE public.oliveira_operational_cases INCLUDING ALL)");

    const operator = randomUUID();
    await client.query(
      `INSERT INTO pg_temp.oliveira_staff_accounts
        (id,email,display_name,role,status,secret_hash,secret_salt)
       VALUES ($1,'only-test@example.invalid','Teste temporário','admin','active','synthetic','synthetic')`,
      [operator]
    );
    const cases = new OperationalCases(client, encryptionKey);
    const created = await cases.create(operator, {
      title: "Verificação sintética sem persistência",
      service: "Teste interno",
      notes: "Sem dados pessoais; transação revertida",
    });
    if (!created || created.status !== "triagem" || created.version !== 1)
      throw new Error("Criação sintética falhou.");

    const updated = await cases.changeStatus(operator, created.id, {
      nextStatus: "conferencia", expectedVersion: 1,
    });
    if (updated.status !== "conferencia" || updated.version !== 2)
      throw new Error("Atualização sintética falhou.");
    const listed = await cases.list(operator, { limit: 2 });
    if (listed.length !== 1 || listed[0].id !== created.id)
      throw new Error("Listagem sintética falhou.");

    const publicRows = await client.query(
      "SELECT count(*)::int AS total FROM public.oliveira_operational_cases WHERE id = $1",
      [created.id]
    );
    if (publicRows.rows[0]?.total !== 0)
      throw new Error("Teste saiu das tabelas temporárias.");

    await client.query("ROLLBACK");
    transaction = false;
    return {
      database: "connected", schema: "verified", administratorMfa: "confirmed",
      isolatedCreate: "passed", isolatedUpdate: "passed",
      isolatedList: "passed", rollback: "passed",
      persistentTestData: false,
    };
  } finally {
    if (transaction) {
      try { await client.query("ROLLBACK"); } catch { /* connection discarded */ }
    }
    client.release();
  }
}
