import { operationalRuntimeAllowed, operationalOrigin } from "./operacional.mjs";
import { operationalDatabaseUrl } from "../server/platform/operational-db-env.mjs";
import { createBootstrapService, matchesBootstrapToken } from "../server/platform/operational-bootstrap.mjs";

const privateHeaders = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const json = (body, status = 200) =>
  Response.json(body, { status, headers: privateHeaders });
let app;

export function firstAdminSetupAllowed(env) {
  return ["0", "auto"].includes(env?.OLIVEIRA_OPS_ENABLED) &&
    env.OLIVEIRA_OPS_SETUP_ENABLED === "1" &&
    typeof env.OLIVEIRA_OPS_SETUP_TOKEN === "string" &&
    env.OLIVEIRA_OPS_SETUP_TOKEN.length >= 48 &&
    env.OLIVEIRA_OPS_SETUP_TOKEN.length <= 256 &&
    operationalRuntimeAllowed({ ...env, OLIVEIRA_OPS_ENABLED: "1" });
}

async function parseBody(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return null;
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 4096)) return null;
  let size = 0;
  const buffers = [];
  for await (const chunk of request.body || []) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 4096) return null;
    buffers.push(bytes);
  }
  try {
    const decoded = JSON.parse(Buffer.concat(buffers).toString("utf8"));
    return decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? decoded : null;
  } catch {
    return null;
  }
}

async function bootstrapService(env) {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: operationalDatabaseUrl(env),
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    await pool.end();
    throw error;
  }
  return createBootstrapService({
    database: pool,
    encryptionKey: env.OLIVEIRA_OPS_DATA_KEY,
    rateSecret: env.OLIVEIRA_OPS_RATE_SECRET,
  });
}

export default {
  async fetch(request) {
    const env = process.env;
    if (!firstAdminSetupAllowed(env))
      return json({ error: "Ativação indisponível." }, 503);
    try {
      const origin = operationalOrigin(env);
      if (new URL(request.url).origin !== origin)
        return json({ error: "Origem não autorizada." }, 403);
      if (request.method === "GET") {
        app ??= bootstrapService(env).catch((error) => {
          app = null;
          throw error;
        });
        return json(await (await app).readiness());
      }
      if (request.method !== "POST")
        return json({ error: "Método não permitido." }, 405);
      if (request.headers.get("origin") !== origin ||
          request.headers.get("sec-fetch-site") === "cross-site")
        return json({ error: "Origem não autorizada." }, 403);
      const body = await parseBody(request);
      if (!body || !matchesBootstrapToken(body.setupCode, env.OLIVEIRA_OPS_SETUP_TOKEN))
        return json({ error: "Código de ativação inválido." }, 403);
      const op = new URL(request.url).searchParams.get("op");
      if (!["start", "recover", "confirm"].includes(op))
        return json({ error: "Operação inválida." }, 404);
      const keys = op === "start" ? ["setupCode", "email", "name", "password"] :
        op === "recover" ? ["setupCode", "email", "password"] :
        ["setupCode", "email", "code"];
      if (Object.keys(body).some((key) => !keys.includes(key)))
        return json({ error: "Campos inválidos." }, 422);
      app ??= bootstrapService(env).catch((error) => {
        app = null;
        throw error;
      });
      const service = await app;
      if (op === "start") {
        const created = await service.start(body);
        return json({ email: created.email, totpSecret: created.secret }, 201);
      }
      if (op === "recover") {
        const recovered = await service.recover(body);
        return json({ email: recovered.email, totpSecret: recovered.secret });
      }
      return json(await service.confirm(body));
    } catch (error) {
      const status = [403, 404, 409, 422, 429].includes(error?.status)
        ? error.status : 503;
      return json({
        error: status === 409 ? "Administrador já cadastrado ou ativação indisponível." :
          status === 422 ? "Dados inválidos ou código TOTP incorreto." :
          status === 429 ? "Muitas tentativas. Tente mais tarde." :
          "Serviço de ativação indisponível.",
      }, status);
    }
  },
};
