import { encryption } from "./security.mjs";
import { generateTotpSecret, verifyTotp } from "./totp.mjs";
import { verifyStaffPassword } from "./operational-identity.mjs";

// Require a dedicated database, a separately held AES key and application-level
// rate limiting BEFORE connecting this service to an HTTP endpoint.
export class OperationalMfa {
  constructor(accounts, encryptionKey, { now = () => Date.now() } = {}) {
    this.accounts = accounts;
    this.db = accounts.database;
    this.cipher = encryption(encryptionKey);
    this.now = now;
  }
  async setup() {
    await this.db.query(`CREATE TABLE IF NOT EXISTS oliveira_staff_mfa (
      staff_id uuid PRIMARY KEY REFERENCES oliveira_staff_accounts(id) ON DELETE CASCADE,
      secret bytea NOT NULL,
      confirmed boolean NOT NULL DEFAULT false,
      last_counter bigint NOT NULL DEFAULT -1
    )`);
  }
  async startEnrollment(staffId) {
    const { rows } = await this.db.query(
      "SELECT id FROM oliveira_staff_accounts WHERE id=$1 AND status='pending-mfa'",
      [staffId]
    );
    if (!rows[0]) throw new Error("Cadastro não está pendente de MFA.");
    const secret = generateTotpSecret();
    const sealed = this.cipher.seal(Buffer.from(secret), staffId);
    const inserted = await this.db.query(
      `INSERT INTO oliveira_staff_mfa(staff_id,secret,confirmed,last_counter)
       SELECT id,$2,false,-1 FROM oliveira_staff_accounts
       WHERE id=$1 AND status='pending-mfa'
       ON CONFLICT(staff_id) DO UPDATE
       SET secret=EXCLUDED.secret,confirmed=false,last_counter=-1
       RETURNING staff_id`,
      [staffId,sealed]
    );
    if (!inserted.rows[0]) throw new Error("Cadastro não autorizado.");
    // Only disclose during a protected, authenticated enrollment flow.
    return { secret };
  }
  async useCode(staffId, code, { enrollment = false } = {}) {
    const { rows } = await this.db.query(
      `SELECT secret,last_counter,confirmed FROM oliveira_staff_mfa WHERE staff_id=$1`,
      [staffId]
    );
    if (!rows[0] || Boolean(rows[0].confirmed) === enrollment) return false;
    let secret;
    try {
      secret = this.cipher.open(rows[0].secret, staffId).toString("utf8");
    } catch {
      return false;
    }
    const counter = verifyTotp(secret, code, {
      now: this.now(), lastCounter: Number(rows[0].last_counter),
    });
    if (counter === null) return false;
    const update = await this.db.query(
      `UPDATE oliveira_staff_mfa SET last_counter=$2,
         confirmed=CASE WHEN $4 THEN true ELSE confirmed END
       WHERE staff_id=$1 AND last_counter < $2
         AND confirmed=$3 RETURNING staff_id`,
      [staffId,counter,!enrollment,enrollment]
    );
    return update.rows.length === 1;
  }
  async confirmEnrollment(staffId, code) {
    const consumed = await this.useCode(staffId, code, { enrollment: true });
    if (!consumed) return false;
    await this.accounts.changeStatus(staffId, "active");
    return true;
  }
  async authenticate(email, password, code) {
    // This is a service-layer primitive, NOT a public login endpoint.
    // The HTTP layer must enforce distributed rate limits and generic errors.
    const account = await this.accounts.findByEmail(email);
    if (!account || account.status !== "active") return null;
    if (!(await verifyStaffPassword(account, password))) return null;
    if (!(await this.useCode(account.id, code))) return null;
    return this.accounts.createSession(account, { mfaVerified: true });
  }
}
