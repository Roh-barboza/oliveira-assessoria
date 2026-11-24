import { randomUUID, createHash } from "node:crypto";
import { encryption } from "./security.mjs";

const fail = (status, message) => Object.assign(new Error(message),{status});
const uuid = x => typeof x==="string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const MAX_BYTES=1024*1024;
const MIME=new Set(["application/pdf","image/png","image/jpeg"]);
function decodeFile(base64) {
  if(typeof base64!=="string" || !base64 ||
      base64.length>Math.ceil(MAX_BYTES/3)*4 ||
      !/^[a-zA-Z0-9+/]+={0,2}$/.test(base64))
    throw fail(422,"Arquivo inválido.");
  const bytes=Buffer.from(base64,"base64");
  if(bytes.length===0 || bytes.length>MAX_BYTES ||
      bytes.toString("base64")!==base64)
    throw fail(422,"Arquivo inválido.");
  return bytes;
}
function validSignature(bytes,mime) {
  if(mime==="application/pdf")
    return bytes.subarray(0,5).toString("ascii")==="%PDF-" &&
      bytes.subarray(Math.max(0,bytes.length-1024)).includes(Buffer.from("%%EOF"));
  if(mime==="image/png")
    return bytes.length>24 &&
      bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"));
  if(mime==="image/jpeg")
    return bytes.length>8 && bytes[0]===255 && bytes[1]===216 &&
      bytes[bytes.length-2]===255 && bytes[bytes.length-1]===217;
  return false;
}
export const operationalDocumentsSchema = `
CREATE TABLE IF NOT EXISTS oliveira_operational_documents (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES oliveira_operational_cases(id),
  uploaded_by uuid NOT NULL REFERENCES oliveira_staff_accounts(id),
  media_type text NOT NULL CHECK (media_type IN ('application/pdf','image/png','image/jpeg')),
  byte_length integer NOT NULL CHECK (byte_length>0 AND byte_length<=1048576),
  sha256 text NOT NULL,
  sealed_name bytea NOT NULL,
  sealed_bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oliveira_documents_case_idx
  ON oliveira_operational_documents(case_id,created_at DESC);
CREATE TABLE IF NOT EXISTS oliveira_document_access_log (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL,
  case_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('uploaded','downloaded','deleted')),
  at timestamptz NOT NULL DEFAULT now()
);
`;
/**
 * Authenticated, encrypted document storage for a private dedicated DB.
 * The application MUST supply a real, contractually approved malware scanner
 * before enabling uploads. A missing scanner fails CLOSED; no mock is used in
 * Vercel. This module is for integration tests until that approval.
 */
export class OperationalDocuments {
  constructor({database,encryptionKey,cases,scanner=null}={}) {
    if(!database?.query || !cases?.get || !cases?.actor ||
      !/^[a-f0-9]{64}$/.test(encryptionKey||""))
      throw new Error("Documentos não configurados.");
    this.db=database;this.cases=cases;this.cipher=encryption(encryptionKey);
    this.scanner=scanner;
  }
  async setup() {
    for(const statement of operationalDocumentsSchema.split(";").map(s=>s.trim()).filter(Boolean))
      await this.db.query(statement);
  }
  async authorize(actorId,caseId,{write=false}={}) {
    if(!uuid(caseId))throw fail(422,"Solicitação inválida.");
    const item=await this.cases.get(actorId,caseId);
    const actor=await this.cases.actor(actorId);
    if(!item || !actor)throw fail(404,"Solicitação não encontrada.");
    if(write && (actor.role==="reviewer" ||
      actor.role!=="admin" && item.assignedTo!==actorId ||
      ["encerrado","pausado"].includes(item.status)))
      throw fail(403,"Acesso negado.");
    return item;
  }
  async upload(actorId,{caseId,name,mimeType,base64}={}) {
    await this.authorize(actorId,caseId,{write:true});
    if(!this.scanner?.scan)
      throw fail(503,"Verificação de arquivos indisponível.");
    if(typeof name!=="string" || name.length>128 ||
      !/^[\p{L}\p{N} _().,-]+\.(pdf|png|jpg|jpeg)$/iu.test(name) ||
      !MIME.has(mimeType))
      throw fail(422,"Arquivo inválido.");
    const bytes=decodeFile(base64);
    if(!validSignature(bytes,mimeType))throw fail(422,"Assinatura do arquivo inválida.");
    let scan;
    try {scan=await this.scanner.scan(bytes,mimeType);}
    catch {throw fail(503,"Verificação de arquivos indisponível.");}
    if(scan?.clean!==true || scan.engineVerified!==true)
      throw fail(422,"Arquivo não aprovado pela verificação de segurança.");
    const id=randomUUID();
    const digest=createHash("sha256").update(bytes).digest("hex");
    const nameData=this.cipher.seal(Buffer.from(name,"utf8"),id+":name");
    const sealed=this.cipher.seal(bytes,id+":content");
    await this.db.query(
      `INSERT INTO oliveira_operational_documents
       (id,case_id,uploaded_by,media_type,byte_length,sha256,sealed_name,sealed_bytes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id,caseId,actorId,mimeType,bytes.length,digest,nameData,sealed]);
    await this.db.query(
      `INSERT INTO oliveira_document_access_log(id,document_id,case_id,actor_id,action)
       VALUES($1,$2,$3,$4,'uploaded')`,
      [randomUUID(),id,caseId,actorId]);
    return {id,caseId,name,mimeType,size:bytes.length,sha256:digest};
  }
  async list(actorId,caseId) {
    await this.authorize(actorId,caseId);
    const {rows}=await this.db.query(
      `SELECT id,case_id,media_type,byte_length,sha256,sealed_name,created_at
       FROM oliveira_operational_documents WHERE case_id=$1
       ORDER BY created_at DESC,id ASC LIMIT 100`,
      [caseId]);
    return rows.map(row=>({
      id:row.id,caseId:row.case_id,mimeType:row.media_type,
      size:row.byte_length,sha256:row.sha256,createdAt:row.created_at,
      name:this.cipher.open(row.sealed_name,row.id+":name").toString("utf8"),
    }));
  }
  async download(actorId,caseId,documentId) {
    await this.authorize(actorId,caseId);
    if(!uuid(documentId))throw fail(422,"Documento inválido.");
    const {rows}=await this.db.query(
      `SELECT * FROM oliveira_operational_documents
       WHERE id=$1 AND case_id=$2`,[documentId,caseId]);
    const row=rows[0];
    if(!row)throw fail(404,"Documento não encontrado.");
    const bytes=this.cipher.open(row.sealed_bytes,row.id+":content");
    if(createHash("sha256").update(bytes).digest("hex")!==row.sha256)
      throw fail(503,"Documento inválido.");
    // Download audit happens before returning any bytes. Fail closed if log fails.
    await this.db.query(
      `INSERT INTO oliveira_document_access_log(id,document_id,case_id,actor_id,action)
       VALUES($1,$2,$3,$4,'downloaded')`,
      [randomUUID(),documentId,caseId,actorId]);
    return {id:documentId,caseId,
      name:this.cipher.open(row.sealed_name,row.id+":name").toString("utf8"),
      mimeType:row.media_type,sha256:row.sha256,base64:bytes.toString("base64")};
  }
  async remove(actorId,caseId,documentId) {
    const item=await this.authorize(actorId,caseId,{write:true});
    if(!uuid(documentId))throw fail(422,"Documento inválido.");
    const {rows}=await this.db.query(
      "DELETE FROM oliveira_operational_documents WHERE id=$1 AND case_id=$2 RETURNING id",
      [documentId,caseId]);
    if(!rows.length)throw fail(404,"Documento não encontrado.");
    await this.db.query(
      `INSERT INTO oliveira_document_access_log(id,document_id,case_id,actor_id,action)
       VALUES($1,$2,$3,$4,'deleted')`,
      [randomUUID(),documentId,caseId,actorId]);
    return {deleted:true};
  }
}
