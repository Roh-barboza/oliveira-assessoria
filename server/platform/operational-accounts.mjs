import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isStaffAuthorized } from "./operational-identity.mjs";

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const permittedRole = new Set(["admin", "operator", "reviewer"]);
const permittedStatus = new Set(["pending-mfa", "active", "disabled"]);

export const operationalSchema = `
CREATE TABLE IF NOT EXISTS oliveira_staff_accounts (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','operator','reviewer')),
  status text NOT NULL CHECK (status IN ('pending-mfa','active','disabled')),
  secret_hash text NOT NULL,
  secret_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
CREATE TABLE IF NOT EXISTS oliveira_staff_sessions (
  id uuid PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES oliveira_staff_accounts(id) ON DELETE CASCADE,
  token_digest text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oliveira_staff_sessions_owner_idx
  ON oliveira_staff_sessions(staff_id, expires_at);
`;

export class OperationalAccounts {
  constructor(database, { now = () => Date.now() } = {}) {
    this.database = database;
    this.now = now;
  }
  async setup() {
    // Intended for a dedicated database. Never run this against n8n or another app's schema.
    await this.database.query(operationalSchema);
  }
  async createPrepared(account) {
    if (!account?.id || !account?.password ||
        !permittedRole.has(account.role) || account.status !== "pending-mfa")
      throw new Error("Cadastro não preparado.");
    const { rows } = await this.database.query(
      `INSERT INTO oliveira_staff_accounts
        (id,email,display_name,role,status,secret_hash,secret_salt)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,email,display_name AS name,role,status`,
      [account.id, account.email, account.name, account.role, account.status,
       account.password.hash, account.password.salt]
    );
    return rows[0];
  }
  async findByEmail(email) {
    if (typeof email !== "string" || email.length > 254) return null;
    const { rows } = await this.database.query(
      `SELECT id,email,display_name AS name,role,status,secret_hash,secret_salt
       FROM oliveira_staff_accounts WHERE email=$1`,
      [email.trim().toLowerCase()]
    );
    const row = rows[0];
    return row ? {
      id: row.id, email: row.email, name: row.name, role: row.role, status: row.status,
      password: { algorithm: "scrypt-v1", hash: row.secret_hash, salt: row.secret_salt },
    } : null;
  }
  async changeStatus(id, status) {
    if (!permittedStatus.has(status)) throw new Error("Estado inválido.");
    const { rows } = await this.database.query(
      `UPDATE oliveira_staff_accounts
       SET status=$2,disabled_at=CASE WHEN $2='disabled' THEN now() ELSE NULL END
       WHERE id=$1 RETURNING id,status`,
      [id,status]
    );
    if (!rows[0]) return null;
    if (status !== "active") await this.revokeAll(id);
    return rows[0];
  }
  async createSession(account, { mfaVerified = false, lifetimeMs = 3600000 } = {}) {
    if (!isStaffAuthorized(account, { mfaVerified }))
      throw new Error("Acesso requer conta ativa e MFA.");
    if (!Number.isInteger(lifetimeMs) || lifetimeMs < 60000 || lifetimeMs > 3600000)
      throw new Error("Duração de sessão inválida.");
    const token = randomBytes(32).toString("base64url");
    const id = randomUUID();
    const expires = new Date(this.now() + lifetimeMs);
    const { rows } = await this.database.query(
      `INSERT INTO oliveira_staff_sessions(id,staff_id,token_digest,expires_at)
       SELECT $1,id,$2,$3 FROM oliveira_staff_accounts
       WHERE id=$4 AND status='active' RETURNING id`,
      [id,tokenHash(token),expires,account.id]
    );
    if (!rows[0]) throw new Error("Conta inativa.");
    return { token, expiresAt: expires.toISOString() };
  }
  async getSession(token) {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const { rows } = await this.database.query(
      `SELECT a.id,a.email,a.display_name AS name,a.role,a.status
       FROM oliveira_staff_sessions s
       JOIN oliveira_staff_accounts a ON a.id=s.staff_id
       WHERE s.token_digest=$1 AND s.revoked_at IS NULL
         AND s.expires_at > $2 AND a.status='active'`,
      [tokenHash(token),new Date(this.now())]
    );
    return rows[0] ?? null;
  }
  async revoke(token) {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    await this.database.query(
      "UPDATE oliveira_staff_sessions SET revoked_at=now() WHERE token_digest=$1 AND revoked_at IS NULL",
      [tokenHash(token)]
    );
  }
  async revokeAll(staffId) {
    await this.database.query(
      "UPDATE oliveira_staff_sessions SET revoked_at=now() WHERE staff_id=$1 AND revoked_at IS NULL",
      [staffId]
    );
  }
}
