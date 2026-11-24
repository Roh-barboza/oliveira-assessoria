import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prepareStaffAccount } from "./operational-identity.mjs";
import { OperationalAccounts } from "./operational-accounts.mjs";
import { OperationalMfa } from "./operational-mfa.mjs";
import { OperationalLoginLimiter } from "./operational-login-limiter.mjs";

const error = (status, message) => Object.assign(new Error(message), { status });
const uuid = value => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const digest = value => createHash("sha256").update(value).digest("hex");
const validToken = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validEmail = value => typeof value === "string" && value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const now = () => new Date();

export const invitationSchema = `
CREATE TABLE IF NOT EXISTS oliveira_staff_invitations (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('operator','reviewer')),
  kind text NOT NULL CHECK (kind IN ('invite','reset')),
  token_digest text UNIQUE NOT NULL,
  staff_id uuid REFERENCES oliveira_staff_accounts(id),
  created_by uuid NOT NULL REFERENCES oliveira_staff_accounts(id),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oliveira_staff_invitations_expiry_idx
  ON oliveira_staff_invitations(expires_at);
`;

/**
 * Private, one-time staff onboarding with password and TOTP chosen by the invitee.
 * Never transmits tokens by email/WhatsApp. A verified admin must transfer them
 * by an approved secure channel; no public self-registration exists.
 */
export class OperationalInvitations {
  constructor(database, encryptionKey, rateSecret) {
    if (!database?.query || !/^[a-f0-9]{64}$/.test(encryptionKey || "") ||
      typeof rateSecret !== "string" || Buffer.byteLength(rateSecret) < 32)
      throw new Error("Convites não configurados.");
    this.db = database;
    this.key = encryptionKey;
    this.rateSecret = rateSecret;
  }
  async setup() {
    for (const statement of invitationSchema.split(";").map(s => s.trim()).filter(Boolean))
      await this.db.query(statement);
  }
  async authorizedAdmin(client, actorId) {
    if (!uuid(actorId)) throw error(403, "Acesso negado.");
    const { rows } = await client.query(
      "SELECT id FROM oliveira_staff_accounts WHERE id=$1 AND role='admin' AND status='active'",
      [actorId]);
    if (!rows.length) throw error(403, "Acesso negado.");
  }
  async issue(actorId, { email, name, role, resetStaffId = null } = {}) {
    if (!validEmail(email) || typeof name !== "string" ||
        name.trim().length < 2 || name.trim().length > 120 ||
        !["operator","reviewer"].includes(role))
      throw error(422, "Dados inválidos.");
    const normalizedEmail = email.trim().toLowerCase();
    const token = randomBytes(32).toString("hex");
    const client = typeof this.db.connect === "function" ? await this.db.connect() : this.db;
    let opened = false;
    try {
      await client.query("BEGIN"); opened = true;
      await this.authorizedAdmin(client, actorId);
      if (resetStaffId) {
        if (!uuid(resetStaffId) || resetStaffId === actorId)
          throw error(422, "Funcionário inválido.");
        const { rows } = await client.query(
          `SELECT id,email,display_name AS name,role FROM oliveira_staff_accounts
           WHERE id=$1 AND role IN ('operator','reviewer') AND status IN ('active','pending-mfa') FOR UPDATE`,
          [resetStaffId]);
        const staff = rows[0];
        if (!staff || staff.email !== normalizedEmail ||
            staff.name !== name.trim() || staff.role !== role)
          throw error(404, "Funcionário indisponível.");
        await client.query(
          "UPDATE oliveira_staff_accounts SET status='pending-mfa' WHERE id=$1",
          [resetStaffId]);
        await client.query(
          "UPDATE oliveira_staff_sessions SET revoked_at=now() WHERE staff_id=$1 AND revoked_at IS NULL",
          [resetStaffId]);
        await client.query(
          "UPDATE oliveira_staff_invitations SET expires_at=now() WHERE staff_id=$1 AND used_at IS NULL",
          [resetStaffId]);
      } else {
        const { rows } = await client.query(
          "SELECT id FROM oliveira_staff_accounts WHERE email=$1", [normalizedEmail]);
        if (rows.length) throw error(409, "E-mail já cadastrado.");
        const pending = await client.query(
          `SELECT id FROM oliveira_staff_invitations
           WHERE email=$1 AND used_at IS NULL AND expires_at>now()`,
          [normalizedEmail]);
        if (pending.rows.length) throw error(409, "Convite ativo já existente.");
      }
      const id = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await client.query(
        `INSERT INTO oliveira_staff_invitations
         (id,email,display_name,role,kind,token_digest,staff_id,created_by,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id,normalizedEmail,name.trim(),role,resetStaffId ? "reset" : "invite",
         digest(token),resetStaffId,actorId,expiresAt]);
      await client.query("COMMIT"); opened = false;
      return { token, expiresAt: expiresAt.toISOString(), email: normalizedEmail };
    } catch (e) {
      if (opened) await client.query("ROLLBACK");
      throw e;
    } finally {
      if (client !== this.db) client.release();
    }
  }
  async invite(actorId, details) {
    return this.issue(actorId, details);
  }
  async reset(actorId, targetId) {
    if (!uuid(targetId)) throw error(422, "Funcionário inválido.");
    await this.authorizedAdmin(this.db, actorId);
    const {rows} = await this.db.query(
      `SELECT email,display_name AS name,role FROM oliveira_staff_accounts
       WHERE id=$1 AND role IN ('operator','reviewer') AND status IN ('active','pending-mfa')`,
      [targetId]);
    if (!rows[0]) throw error(404, "Funcionário indisponível.");
    return this.issue(actorId, { ...rows[0], resetStaffId:targetId });
  }
  async redeem({ token, password } = {}) {
    if (!validToken(token) || typeof password !== "string" ||
        password.length < 14 || password.length > 1024)
      throw error(422, "Convite inválido.");
    const limiter = new OperationalLoginLimiter(this.db, this.rateSecret);
    const allowed = await limiter.checkLogin(digest(token), "team-invite-redeem");
    if (!allowed.allowed) throw error(429, "Muitas tentativas.");
    const client = typeof this.db.connect === "function" ? await this.db.connect() : this.db;
    let opened = false;
    try {
      await client.query("BEGIN"); opened = true;
      const { rows } = await client.query(
        `SELECT * FROM oliveira_staff_invitations
         WHERE token_digest=$1 AND used_at IS NULL AND expires_at>now()
         FOR UPDATE`, [digest(token)]);
      const invite = rows[0];
      if (!invite || invite.redeemed_at) throw error(409, "Convite expirado ou utilizado.");
      const prepared = await prepareStaffAccount({
        email:invite.email,name:invite.display_name,role:invite.role,password,
      });
      let staffId = invite.staff_id;
      if (invite.kind === "reset") {
        const changed = await client.query(
          `UPDATE oliveira_staff_accounts SET
            secret_hash=$2,secret_salt=$3,status='pending-mfa'
           WHERE id=$1 AND status='pending-mfa' AND role=$4 RETURNING id`,
          [staffId,prepared.password.hash,prepared.password.salt,invite.role]);
        if (!changed.rows.length) throw error(409, "Conta não disponível.");
      } else {
        const txAccounts = new OperationalAccounts(client);
        await txAccounts.createPrepared(prepared);
        staffId = prepared.id;
      }
      const mfa = new OperationalMfa(new OperationalAccounts(client),this.key);
      const enrollment = await mfa.startEnrollment(staffId);
      await client.query(
        "UPDATE oliveira_staff_invitations SET staff_id=$2,redeemed_at=now() WHERE id=$1",
        [invite.id,staffId]);
      await client.query("COMMIT"); opened = false;
      return { email:invite.email, totpSecret:enrollment.secret };
    } catch (e) {
      if (opened) await client.query("ROLLBACK");
      throw e;
    } finally {
      if (client !== this.db) client.release();
    }
  }
  async confirm({ token, code } = {}) {
    if (!validToken(token) || typeof code !== "string" || !/^\d{6}$/.test(code))
      throw error(422, "Código inválido.");
    const limiter = new OperationalLoginLimiter(this.db,this.rateSecret);
    const allowed = await limiter.checkLogin(digest(token), "team-invite-confirm");
    if (!allowed.allowed) throw error(429, "Muitas tentativas.");
    const client = typeof this.db.connect === "function" ? await this.db.connect() : this.db;
    let opened = false;
    try {
      await client.query("BEGIN"); opened = true;
      const { rows } = await client.query(
        `SELECT id,staff_id FROM oliveira_staff_invitations
         WHERE token_digest=$1 AND redeemed_at IS NOT NULL
           AND used_at IS NULL AND expires_at>now() FOR UPDATE`,
        [digest(token)]);
      if (!rows[0]?.staff_id) throw error(409, "Convite indisponível.");
      const accounts = new OperationalAccounts(client);
      const mfa = new OperationalMfa(accounts, this.key);
      if (!await mfa.confirmEnrollment(rows[0].staff_id,code))
        throw error(422, "Código inválido.");
      await client.query("UPDATE oliveira_staff_invitations SET used_at=now() WHERE id=$1",
        [rows[0].id]);
      await client.query("COMMIT"); opened = false;
      return { activated:true };
    } catch (e) {
      if (opened) await client.query("ROLLBACK");
      throw e;
    } finally {
      if (client !== this.db) client.release();
    }
  }
}
