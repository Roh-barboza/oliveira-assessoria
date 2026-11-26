import { createHash, randomUUID } from "node:crypto";
import { encryption } from "./security.mjs";
import { renderPdf } from "./pdf.mjs";
import { clicksign } from "./providers/clicksign.mjs";

const uuid = (v) => typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const fail = (status, message) => Object.assign(new Error(message), { status });
const STAGES = ["draft", "approved", "sending", "awaiting_signature",
  "signed", "cancelled", "manual_review"];

export const operationalContractSchema = [
  "CREATE TABLE IF NOT EXISTS oliveira_operational_contracts (" +
    "id uuid PRIMARY KEY, " +
    "case_id uuid NOT NULL REFERENCES oliveira_operational_cases(id), " +
    "created_by uuid NOT NULL REFERENCES oliveira_staff_accounts(id), " +
    "approved_by uuid REFERENCES oliveira_staff_accounts(id), " +
    "status text NOT NULL CHECK (status IN ('draft','approved','sending','awaiting_signature','signed','cancelled','manual_review')), " +
    "version bigint NOT NULL DEFAULT 1 CHECK (version>0), " +
    "encrypted_pdf bytea NOT NULL, " +
    "signed_pdf bytea, " +
    "pdf_sha256 text NOT NULL, " +
    "envelope_id uuid, document_id uuid, signer_id uuid, " +
    "last_stage text, " +
    "created_at timestamptz NOT NULL DEFAULT now(), " +
    "updated_at timestamptz NOT NULL DEFAULT now())",
  "CREATE INDEX IF NOT EXISTS oliveira_ops_contract_case_idx " +
    "ON oliveira_operational_contracts(case_id,created_at DESC)",
  "CREATE TABLE IF NOT EXISTS oliveira_operational_contract_events (" +
    "id uuid PRIMARY KEY, contract_id uuid NOT NULL REFERENCES oliveira_operational_contracts(id), " +
    "actor_id uuid NOT NULL REFERENCES oliveira_staff_accounts(id), " +
    "event text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now())",
];

const summary = (row) => ({
  id: row.id, caseId: row.case_id, status: row.status,
  version: Number(row.version), pdfSha256: row.pdf_sha256,
  envelopeId: row.envelope_id, stage: row.last_stage,
  createdAt: row.created_at, updatedAt: row.updated_at,
  signedReady: row.status === "signed" && Boolean(row.signed_pdf),
});

export class OperationalContracts {
  constructor({ database, encryptionKey, cases, sandboxEnv = {}, provider = null }) {
    if (typeof database?.query !== "function" || !cases?.get)
      throw new Error("Contratos operacionais não configurados.");
    this.database = database;
    this.cases = cases;
    this.cipher = encryption(encryptionKey);
    this.sandboxEnv = sandboxEnv;
    this.provider = provider || clicksign(sandboxEnv);
  }
  async actor(actorId) {
    if (!uuid(actorId)) throw fail(403, "Acesso negado.");
    const { rows } = await this.database.query(
      "SELECT id,role,status FROM oliveira_staff_accounts WHERE id=$1", [actorId]);
    if (rows[0]?.status !== "active" || rows[0].role !== "admin")
      throw fail(403, "Acesso administrativo obrigatório.");
    return rows[0];
  }
  async ready(actorId) {
    await this.actor(actorId);
    const { rows } = await this.database.query(
      "SELECT to_regclass('public.oliveira_operational_contracts') AS name");
    return {
      installed: Boolean(rows[0]?.name),
      sandboxConfigured: Boolean(this.provider.available &&
        this.sandboxEnv.CLICKSIGN_SANDBOX_EMAIL_EXPLICIT_TEST === "1"),
      testRecipient: this.sandboxEnv.CLICKSIGN_TEST_EMAIL || null,
      realContracts: false,
    };
  }
  async connection(actorId) {
    await this.actor(actorId);
    // A read-only call to Sandbox. Never creates an envelope or sends e-mail.
    if (typeof this.provider.probe !== "function")
      return { reachable: false, code: "not_supported" };
    return this.provider.probe();
  }
  async setup(actorId) {
    await this.actor(actorId);
    for (const sql of operationalContractSchema)
      await this.database.query(sql);
    return this.ready(actorId);
  }
  async record(actorId, contractId) {
    await this.actor(actorId);
    if (!uuid(contractId)) throw fail(422, "Identificador inválido.");
    const { rows } = await this.database.query(
      "SELECT * FROM oliveira_operational_contracts WHERE id=$1", [contractId]);
    if (!rows[0]) throw fail(404, "Minuta não encontrada.");
    return rows[0];
  }
  async read(actorId, contractId) {
    return summary(await this.record(actorId, contractId));
  }
  async log(actorId, id, name) {
    await this.database.query(
      "INSERT INTO oliveira_operational_contract_events(id,contract_id,actor_id,event) VALUES($1,$2,$3,$4)",
      [randomUUID(), id, actorId, name]);
  }
  async list(actorId, caseId) {
    await this.actor(actorId);
    if (!uuid(caseId)) throw fail(422, "Identificador inválido.");
    const item = await this.cases.get(actorId, caseId);
    if (!item) throw fail(404, "Solicitação não encontrada.");
    const { rows } = await this.database.query(
      "SELECT * FROM oliveira_operational_contracts WHERE case_id=$1 ORDER BY created_at DESC LIMIT 20",
      [caseId]);
    return rows.map(summary);
  }
  async create(actorId, caseId) {
    await this.actor(actorId);
    if (!uuid(caseId)) throw fail(422, "Identificador inválido.");
    const item = await this.cases.get(actorId, caseId);
    if (!item || item.status === "encerrado")
      throw fail(422, "Solicitação indisponível para minuta.");
    // No customer information, legal clauses, values or personal data.
    // This is a visible synthetic demonstration, NOT a template for client use.
    const id = randomUUID();
    const pdf = await renderPdf([
      ["DOCUMENTO DE DEMONSTRAÇÃO", "SANDBOX. Documento fictício, não constitui proposta, contratação ou obrigação."],
      ["REFERÊNCIA INTERNA", "Identificador de teste: " + id + "."],
      ["SERVIÇO", "Fluxo técnico de assinatura para demonstração. Não contém dados de cliente."],
      ["ASSINATURA", "Assinatura de teste exclusivamente para validar o envio, a identificação do envelope e o retorno do PDF."],
      ["LIMITAÇÃO", "Sem preço, aceite comercial, responsabilidade de prestação de serviços ou validade jurídica."],
    ], new Date());
    const hash = createHash("sha256").update(pdf).digest("hex");
    await this.database.query(
      "INSERT INTO oliveira_operational_contracts " +
      "(id,case_id,created_by,status,encrypted_pdf,pdf_sha256) " +
      "VALUES($1,$2,$3,'draft',$4,$5)",
      [id,caseId,actorId,this.cipher.seal(pdf,id),hash]);
    await this.log(actorId,id,"prepared_synthetic");
    return summary(await this.record(actorId,id));
  }
  async pdf(actorId, contractId, signed = false) {
    const row = await this.record(actorId, contractId);
    if (signed && row.status !== "signed") throw fail(409, "Assinatura ainda não concluída.");
    const data = signed ? row.signed_pdf : row.encrypted_pdf;
    if (!data) throw fail(404, "Arquivo indisponível.");
    const pdf = this.cipher.open(data, signed ? row.id + ":signed" : row.id);
    return {
      filename: "pincio-" + (signed ? "assinada-" : "minuta-") + row.id + ".pdf",
      pdfBase64: pdf.toString("base64"),
      sha256: createHash("sha256").update(pdf).digest("hex"),
      synthetic: true,
    };
  }
  async approve(actorId, contractId, version) {
    await this.actor(actorId);
    if (!uuid(contractId) || !Number.isSafeInteger(version) || version < 1)
      throw fail(422, "Dados inválidos.");
    const { rows } = await this.database.query(
      "UPDATE oliveira_operational_contracts " +
      "SET status='approved',approved_by=$3,version=version+1,updated_at=now() " +
      "WHERE id=$1 AND version=$2 AND status='draft' RETURNING *",
      [contractId,version,actorId]);
    if (!rows.length) throw fail(409, "Minuta já alterada ou aprovada.");
    await this.log(actorId,contractId,"approved_synthetic");
    return summary(rows[0]);
  }
  async send(actorId, contractId, version, confirmation) {
    await this.actor(actorId);
    if (confirmation !== "ENVIAR_TESTE_SANDBOX" || !uuid(contractId) ||
        !Number.isSafeInteger(version) || version < 1)
      throw fail(422, "Confirmação inválida.");
    if (!this.provider.available ||
        this.sandboxEnv.CLICKSIGN_SANDBOX_EMAIL_EXPLICIT_TEST !== "1")
      throw fail(503, "Conta Sandbox não conectada ou convite de teste desativado.");
    const email = String(this.sandboxEnv.CLICKSIGN_TEST_EMAIL||"").toLowerCase();
    if (email !== "rodrigo.barboza1994@gmail.com")
      throw fail(503, "Destinatário de teste não autorizado.");
    // Check the real Sandbox token before persisting 'sending'. The read-only
    // check must never create envelopes or send invitations.
    const check = typeof this.provider.probe === "function"
      ? await this.provider.probe()
      : { reachable: false, code: "not_supported" };
    if (check?.reachable !== true || check?.code !== "authenticated") {
      const code = String(check?.code || "indisponivel")
        .replace(/[^a-z0-9_]/gi, "").slice(0, 32);
      throw fail(503, "Autenticação Clicksign não validada (" + code +
        "). Use Verificar conexão antes de enviar.");
    }
    // Atomic claim, so double-clicks and parallel function instances cannot resend.
    const { rows } = await this.database.query(
      "UPDATE oliveira_operational_contracts SET status='sending', " +
      "last_stage='iniciado',version=version+1,updated_at=now() " +
      "WHERE id=$1 AND version=$2 AND status='approved' RETURNING *",
      [contractId,version]);
    if (!rows.length) throw fail(409, "Envelope já iniciado ou minuta alterada.");
    const row = rows[0];
    const pdf = this.cipher.open(row.encrypted_pdf,row.id);
    try {
      await this.provider.submit(
        { id:row.id,signature_mode:"email" },
        pdf,
        async (stage, ids = {}) => {
          await this.database.query(
            "UPDATE oliveira_operational_contracts SET " +
            "envelope_id=COALESCE($2,envelope_id), " +
            "document_id=COALESCE($3,document_id), " +
            "signer_id=COALESCE($4,signer_id),last_stage=$5,updated_at=now() " +
            "WHERE id=$1 AND status='sending'",
            [row.id,ids.envelope||null,ids.document||null,ids.signer||null,stage]);
        }
      );
      const finish=await this.database.query(
        "UPDATE oliveira_operational_contracts " +
        "SET status='awaiting_signature',version=version+1,updated_at=now() " +
        "WHERE id=$1 AND status='sending' AND envelope_id IS NOT NULL " +
        "AND document_id IS NOT NULL AND signer_id IS NOT NULL RETURNING *",
        [row.id]);
      if(!finish.rows.length)throw new Error("Checkpoint remoto incompleto.");
      await this.log(actorId,row.id,"invited_sandbox");
      return summary(finish.rows[0]);
    } catch (remoteError) {
      // Remote partial success may exist. NEVER automatically resend.
      // Retain only the public HTTP status code, never remote response bodies or secrets.
      const statusMatch = /^Clicksign HTTP (\d{3})$/.exec(remoteError?.message || "");
      const code = statusMatch ? statusMatch[1] : "unknown";
      await this.database.query(
        "UPDATE oliveira_operational_contracts SET status='manual_review', " +
        "last_stage=left(coalesce(last_stage, 'iniciado') || ':http_' || $2,100), " +
        "version=version+1,updated_at=now() WHERE id=$1 AND status='sending'",
        [row.id,code]);
      await this.log(actorId,row.id,"remote_error_requires_manual_review");
      throw fail(503,"Falha remota. Verifique o envelope na Clicksign antes de qualquer novo envio.");
    }
  }
  async refresh(actorId, contractId) {
    const row = await this.record(actorId,contractId);
    if (row.status === "signed" || row.status === "cancelled") return summary(row);
    if (row.status !== "awaiting_signature" || !row.envelope_id ||
        !row.document_id || !row.signer_id)
      throw fail(409, "Envelope indisponível para consulta.");
    if (!this.provider.available)
      throw fail(503, "Sandbox não conectado.");
    let result;
    try {
      result = await this.provider.current({
        envelope_id:row.envelope_id,document_id:row.document_id,
        signer_id:row.signer_id,signature_mode:"email",
      });
    } catch {
      throw fail(503,"Não foi possível consultar a assinatura no Sandbox.");
    }
    if (result.status === "assinado" && result.pdf) {
      const sealed=this.cipher.seal(result.pdf,row.id+":signed");
      const updated=await this.database.query(
        "UPDATE oliveira_operational_contracts SET status='signed',signed_pdf=$2, " +
        "version=version+1,updated_at=now() " +
        "WHERE id=$1 AND status='awaiting_signature' RETURNING *",
        [row.id,sealed]);
      if (updated.rows.length)await this.log(actorId,row.id,"signed_pdf_verified");
    } else if (result.status === "cancelado") {
      const updated=await this.database.query(
        "UPDATE oliveira_operational_contracts SET status='cancelled',version=version+1, " +
        "updated_at=now() WHERE id=$1 AND status='awaiting_signature' RETURNING *",
        [row.id]);
      if (updated.rows.length)await this.log(actorId,row.id,"cancelled_remote");
    }
    return summary(await this.record(actorId,contractId));
  }
}
