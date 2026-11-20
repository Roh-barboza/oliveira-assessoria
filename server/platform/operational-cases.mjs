import { randomUUID } from "node:crypto";
import { encryption } from "./security.mjs";

// Dedicated operational case store. No HTTP endpoints, uploads or payments here.
// Metadata is encrypted per case; only identifiers and access-control columns
// remain queryable. A separate key must be held outside the database and Git.
const STATUS = new Set(["triagem", "aguardando_documentos", "conferencia",
  "pendencias", "preparado", "acompanhamento", "pausado", "encerrado"]);
const ROLE = new Set(["admin", "operator", "reviewer"]);
const allowedText = (s, max) => typeof s === "string" &&
  s.trim().length > 0 && s.trim().length <= max &&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s);
const uuid = (s) => typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const operationalCasesSchema = `
CREATE TABLE IF NOT EXISTS oliveira_operational_cases (
  id uuid PRIMARY KEY,
  assigned_to uuid NOT NULL REFERENCES oliveira_staff_accounts(id),
  reviewer_id uuid REFERENCES oliveira_staff_accounts(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL CHECK (status IN
    ('triagem','aguardando_documentos','conferencia','pendencias',
     'preparado','acompanhamento','pausado','encerrado')),
  encrypted_payload bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oliveira_operational_cases_assignee_idx
  ON oliveira_operational_cases(assigned_to, updated_at DESC);
CREATE INDEX IF NOT EXISTS oliveira_operational_cases_reviewer_idx
  ON oliveira_operational_cases(reviewer_id, updated_at DESC);
`;

export class OperationalCases {
  constructor(database, key) {
    this.database = database;
    this.cipher = encryption(key);
  }
  async setup() {
    // Dedicated database only. Apply as an explicit migration for production.
    for (const statement of operationalCasesSchema.split(";").map((x) => x.trim()).filter(Boolean))
      await this.database.query(statement);
  }
  async actor(id) {
    if (!uuid(id)) return null;
    const { rows } = await this.database.query(
      "SELECT id,role,status FROM oliveira_staff_accounts WHERE id=$1", [id]);
    const actor = rows[0];
    return actor?.status === "active" && ROLE.has(actor.role) ? actor : null;
  }
  async create(actorId, { title, service, notes = "", assignedTo } = {}) {
    const actor = await this.actor(actorId);
    if (!actor || !["admin","operator"].includes(actor.role))
      throw Object.assign(new Error("Acesso negado."), { status: 403 });
    if (!allowedText(title, 150) || !allowedText(service, 100) ||
        typeof notes !== "string" || notes.length > 3000)
      throw Object.assign(new Error("Campos inválidos."), { status: 422 });
    const assignee = assignedTo ?? actorId;
    if (!uuid(assignee)) throw Object.assign(new Error("Responsável inválido."), { status: 422 });
    if (assignee !== actorId && actor.role !== "admin")
      throw Object.assign(new Error("Acesso negado."), { status: 403 });
    const target = await this.actor(assignee);
    if (!target || !["admin","operator"].includes(target.role))
      throw Object.assign(new Error("Responsável indisponível."), { status: 422 });
    const id = randomUUID();
    const metadata = { title: title.trim(), service: service.trim(), notes,
      createdBy: actorId };
    const sealed = this.cipher.seal(Buffer.from(JSON.stringify(metadata)), id);
    await this.database.query(
      `INSERT INTO oliveira_operational_cases
       (id,assigned_to,status,encrypted_payload)
       VALUES($1,$2,'triagem',$3)`,
      [id,assignee,sealed]);
    return this.get(actorId,id);
  }
  async get(actorId, caseId) {
    const actor = await this.actor(actorId);
    if (!actor || !uuid(caseId)) return null;
    const { rows } = await this.database.query(
      `SELECT id,assigned_to,reviewer_id,status,version,encrypted_payload,
              created_at,updated_at
       FROM oliveira_operational_cases
       WHERE id=$1 AND ($2='admin' OR assigned_to=$3 OR reviewer_id=$3)`,
      [caseId,actor.role,actorId]);
    const row = rows[0];
    if (!row) return null;
    const data = JSON.parse(this.cipher.open(row.encrypted_payload,row.id).toString("utf8"));
    return { id: row.id, assignedTo: row.assigned_to, reviewerId: row.reviewer_id,
      status: row.status, version: Number(row.version), ...data,
      createdAt: row.created_at, updatedAt: row.updated_at };
  }
  async list(actorId, { limit = 50 } = {}) {
    const actor = await this.actor(actorId);
    if (!actor) throw Object.assign(new Error("Acesso negado."), { status: 403 });
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw Object.assign(new Error("Limite inválido."), { status: 422 });
    const { rows } = await this.database.query(
      `SELECT id FROM oliveira_operational_cases
       WHERE $1='admin' OR assigned_to=$2 OR reviewer_id=$2
       ORDER BY updated_at DESC,id ASC LIMIT $3`,
      [actor.role, actorId, limit]);
    const found = [];
    for (const row of rows) {
      const item = await this.get(actorId,row.id);
      if (item) found.push(item);
    }
    return found;
  }
  async changeStatus(actorId, caseId, { nextStatus, expectedVersion } = {}) {
    const actor = await this.actor(actorId);
    if (!actor || !uuid(caseId) || !STATUS.has(nextStatus) ||
        !Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
      throw Object.assign(new Error("Solicitação inválida."), { status: 422 });
    const record = await this.get(actorId,caseId);
    if (!record) throw Object.assign(new Error("Solicitação não encontrada."), { status: 404 });
    if (actor.role !== "admin" && record.assignedTo !== actorId)
      throw Object.assign(new Error("Acesso negado."), { status: 403 });
    if (record.status === "encerrado" || nextStatus === "encerrado" && actor.role !== "admin")
      throw Object.assign(new Error("Encerramento exige administração."), { status: 403 });
    const { rows } = await this.database.query(
      `UPDATE oliveira_operational_cases SET status=$3,version=version+1,
          updated_at=now()
       WHERE id=$1 AND version=$2 RETURNING id`,
      [caseId, expectedVersion,nextStatus]);
    if (!rows[0]) throw Object.assign(new Error("Versão desatualizada."), { status: 409 });
    return this.get(actorId,caseId);
  }
}
