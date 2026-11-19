import { isIP } from "node:net";
import { composeOperationalApp } from "../server/platform/operational-runtime.mjs";

const ORIGINAL_SITE_PROJECT_ID = "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
const REQUIRED_BRANCH = "feature/plataforma-operacional-preview";
let instance;

// The public site's production and previews must never have operational DB access.
export function operationalRuntimeAllowed(env) {
  const id = env.VERCEL_PROJECT_ID;
  const exactOrigin = env.OLIVEIRA_OPS_ORIGIN;
  return env.VERCEL === "1" &&
    env.VERCEL_ENV === "preview" &&
    env.VERCEL_GIT_COMMIT_REF === REQUIRED_BRANCH &&
    /^prj_[A-Za-z0-9]+$/.test(id || "") &&
    id !== ORIGINAL_SITE_PROJECT_ID &&
    env.OLIVEIRA_OPS_ALLOWED_PROJECT_ID === id &&
    env.OLIVEIRA_OPS_ENABLED === "1" &&
    /^https:\/\/[-a-z0-9.]+(?:\.vercel\.app)?$/i.test(exactOrigin || "") &&
    env.OLIVEIRA_OPS_STORE === "postgres" &&
    typeof env.OLIVEIRA_OPS_DATABASE_URL === "string" &&
    env.OLIVEIRA_OPS_DATABASE_URL.startsWith("postgres") &&
    /^[a-f0-9]{64}$/.test(env.OLIVEIRA_OPS_DATA_KEY || "") &&
    typeof env.OLIVEIRA_OPS_RATE_SECRET === "string" &&
    Buffer.byteLength(env.OLIVEIRA_OPS_RATE_SECRET) >= 32;
}

function trustedVercelNetworkIdentity(request) {
  // Vercel's edge proxy sets x-real-ip. Never accept an arbitrary client IP
  // header outside the gated Vercel runtime. Missing/invalid IP fails closed.
  const candidate = request.headers.get("x-real-ip");
  return isIP(candidate || "") ? candidate : null;
}

async function runtime() {
  const env = process.env;
  if (!operationalRuntimeAllowed(env)) return async () =>
    Response.json({ error: "Ambiente operacional não configurado." },
      { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: env.OLIVEIRA_OPS_DATABASE_URL,
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
    allowedOrigin: env.OLIVEIRA_OPS_ORIGIN,
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
