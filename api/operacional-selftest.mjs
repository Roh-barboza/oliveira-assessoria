import { operationalRuntimeAllowed, operationalOrigin } from "./operacional.mjs";
import { operationalDatabaseUrl } from "../server/platform/operational-db-env.mjs";
import { runOperationalNeonSmoke } from "../server/platform/operational-live-smoke.mjs";

const headers = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};
const reply = (data, status = 200) =>
  Response.json(data, { status, headers });

export function smokeAllowed(env) {
  // Must be deliberately enabled on the protected Preview branch.
  return env?.OLIVEIRA_OPS_SELFTEST_ENABLED === "1" &&
    operationalRuntimeAllowed(env);
}

export default {
  async fetch(request) {
    const env = process.env;
    if (!smokeAllowed(env))
      return reply({ error: "Verificação indisponível." }, 404);
    if (request.method !== "GET")
      return reply({ error: "Método não permitido." }, 405);
    try {
      if (new URL(request.url).origin !== operationalOrigin(env))
        return reply({ error: "Origem não autorizada." }, 403);
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: operationalDatabaseUrl(env),
        max: 1,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 1000,
      });
      try {
        const checks = await runOperationalNeonSmoke(pool, env.OLIVEIRA_OPS_DATA_KEY);
        return reply({ ready: true, checks });
      } finally {
        await pool.end();
      }
    } catch {
      return reply({ ready: false, error: "Teste de integridade não concluído." }, 503);
    }
  },
};
