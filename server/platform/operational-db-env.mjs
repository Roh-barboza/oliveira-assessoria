// Resolve database credentials without copying sensitive Vercel/Neon values.
// The Neon integration injects DATABASE_URL at build/deploy time. Merely
// having a DATABASE_URL must never activate the operational API.
const validPostgresUrl = (value) =>
  typeof value === "string" && /^postgres(?:ql)?:\/\//.test(value);

export function operationalDatabaseUrl(env) {
  if (!env || typeof env !== "object") return null;
  if (env.OLIVEIRA_OPS_DATABASE_SOURCE === "neon-vercel") {
    return typeof env.NEON_PROJECT_ID === "string" && env.NEON_PROJECT_ID.length > 0 &&
      validPostgresUrl(env.DATABASE_URL)
      ? env.DATABASE_URL : null;
  }
  if (env.OLIVEIRA_OPS_DATABASE_SOURCE === "dedicated-url")
    return validPostgresUrl(env.OLIVEIRA_OPS_DATABASE_URL)
      ? env.OLIVEIRA_OPS_DATABASE_URL : null;
  return null;
}
