import { createHmac } from "node:crypto";

// Database-backed attempt limits. Do not rely on process memory in Vercel.
// Use a separately held secret; never store raw email addresses or IPs here.
export class OperationalLoginLimiter {
  constructor(database, secret, { now = () => Date.now() } = {}) {
    if (typeof secret !== "string" || Buffer.byteLength(secret) < 32)
      throw new Error("Segredo do limitador não configurado.");
    this.db = database;
    this.secret = secret;
    this.now = now;
  }
  async setup() {
    await this.db.query(`CREATE TABLE IF NOT EXISTS oliveira_login_limits (
      bucket_key text PRIMARY KEY,
      attempts integer NOT NULL CHECK (attempts >= 0),
      window_ends_at timestamptz NOT NULL
    )`);
  }
  key(kind, identifier) {
    if (!["user", "network"].includes(kind) ||
        typeof identifier !== "string" || !identifier || identifier.length > 512)
      throw new Error("Identificador inválido.");
    return createHmac("sha256", this.secret)
      .update(kind + ":" + identifier.toLowerCase().trim()).digest("hex");
  }
  async take(kind, identifier, { maxAttempts, windowMs } = {}) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100 ||
        !Number.isInteger(windowMs) || windowMs < 1000 || windowMs > 86400000)
      throw new Error("Política de limitação inválida.");
    const key = this.key(kind, identifier);
    const now = new Date(this.now());
    const windowEnd = new Date(this.now() + windowMs);
    // The database serializes competing attempts against the same key.
    const { rows } = await this.db.query(
      `INSERT INTO oliveira_login_limits AS l
         (bucket_key,attempts,window_ends_at) VALUES ($1,1,$3)
       ON CONFLICT (bucket_key) DO UPDATE
       SET attempts=CASE WHEN l.window_ends_at <= $2
         THEN 1 ELSE l.attempts+1 END,
           window_ends_at=CASE WHEN l.window_ends_at <= $2
         THEN $3 ELSE l.window_ends_at END
       RETURNING attempts,window_ends_at`,
      [key,now,windowEnd]
    );
    return {
      allowed: rows[0].attempts <= maxAttempts,
      retryAfterSeconds: rows[0].attempts <= maxAttempts ? 0 :
        Math.max(1, Math.ceil((new Date(rows[0].window_ends_at).getTime() - this.now()) / 1000)),
    };
  }
  async checkLogin(email, networkAddress) {
    // Both checks always execute, regardless of the outcome of the first.
    // Only accept the caller's verified network identity, not a user-supplied XFF.
    const user = await this.take("user", email, { maxAttempts: 5, windowMs: 900000 });
    const network = await this.take("network", networkAddress, { maxAttempts: 25, windowMs: 900000 });
    return {
      allowed: user.allowed && network.allowed,
      retryAfterSeconds: Math.max(user.retryAfterSeconds, network.retryAfterSeconds),
    };
  }
}
