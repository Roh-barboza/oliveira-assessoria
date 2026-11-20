import { composeOperationalApp } from "../server/platform/operational-runtime.mjs";
import { operationalDatabaseUrl } from "../server/platform/operational-db-env.mjs";

const SITE_PROJECT_ID = "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
const REQUIRED_BRANCH = "feature/plataforma-operacional-preview";
let instance;

// Derive the exact Preview deployment origin from a Vercel-controlled system
// variable, avoiding manual edits every time a new Preview URL is deployed.
export function operationalOrigin(env) {
  const origin = env.OLIVEIRA_OPS_ORIGIN ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null);
  if (typeof origin !== "string" ||
      !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i.test(origin)) return null;
  if (["https://oliveira-assessoria.vercel.app",
       "https://oliveira-assessoria-barbozaa-s-projects.vercel.app"].includes(origin)) return null;
  return origin;
}

// Single Vercel project with a strictly gated Preview-only operational API.
export function operationalRuntimeAllowed(env) {
  const id = env.VERCEL_PROJECT_ID;
  const exactOrigin = operationalOrigin(env);
  return env.VERCEL === "1" &&
    env.VERCEL_ENV === "preview" &&
    env.VERCEL_GIT_COMMIT_REF === REQUIRED_BRANCH &&
    id === SITE_PROJECT_ID &&
    env.OLIVEIRA_OPS_ALLOWED_PROJECT_ID === SITE_PROJECT_ID &&
    env.OLIVEIRA_OPS_PREVIEW_ACK === "shared-project-preview-only" &&
    env.OLIVEIRA_OPS_ENABLED === "1" &&
    Boolean(exactOrigin) &&
    env.OLIVEIRA_OPS_STORE === "postgres" &&
    Boolean(operationalDatabaseUrl(env)) &&
    /^[a-f0-9]{64}$/.test(env.OLIVEIRA_OPS_DATA_KEY || "") &&
    typeof env.OLIVEIRA_OPS_RATE_SECRET === "string" &&
    Buffer.byteLength(env.OLIVEIRA_OPS_RATE_SECRET) >= 32;
}

function trustedVercelNetworkIdentity() {
  // Avoid spoofable client-IP headers until the edge normalization is verified.
  // A shared DB-backed bucket limits all login attempts to 25 per 15 minutes;
  // each account has an additional stricter attempt limit.
  return "oliveira-ops-preview-global";
}

async function runtime() {
  const env = process.env;
  if (!operationalRuntimeAllowed(env)) return async () =>
    Response.json({ error: "Ambiente operacional não configurado." },
      { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: operationalDatabaseUrl(env),
    max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
  // The migration must already be applied. Never auto-migrate at request time.
  try {
    await pool.query("SELECT 1 FROM oliveira_staff_accounts LIMIT 0");
    await pool.query("SELECT 1 FROM oliveira_staff_mfa LIMIT 0");
    await pool.query("SELECT 1 FROM oliveira_staff_sessions LIMIT 0");
    await pool.query("SELECT 1 FROM oliveira_login_limits LIMIT 0");
    await pool.query("SELECT 1 FROM oliveira_operational_cases LIMIT 0");
  } catch (error) {
    await pool.end();
    throw error;
  }
  return composeOperationalApp({
    database: pool,
    encryptionKey: env.OLIVEIRA_OPS_DATA_KEY,
    rateLimitSecret: env.OLIVEIRA_OPS_RATE_SECRET,
    allowedOrigin: operationalOrigin(env),
    networkIdentity: trustedVercelNetworkIdentity,
  });
}
export default {
  async fetch(request) {
    try {
      instance ??= runtime().catch((error) => {
        instance = undefined;
        throw error;
      });
      return await (await instance)(request);
    } catch {
      return Response.json({ error: "Serviço operacional indisponível." }, {
        status: 503,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      });
    }
  },
};
