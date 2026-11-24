import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { access, stat } from "node:fs/promises";
import { Pool } from "pg";
import {
  backupKey, encryptStream, decryptToStream, encryptedSha256,
} from "../server/platform/operational-backup-crypto.mjs";

const action=process.argv[2];
const file=process.argv[3];
const env=process.env;
const deny = message => {throw new Error(message);};
const key=backupKey(env.OLIVEIRA_OPS_BACKUP_KEY);
const validFile=typeof file==="string" && isAbsolute(file) &&
  /\.oliveira-backup\.enc$/.test(file) && !file.includes("\0");
if(!["backup","verify","restore"].includes(action) || !validFile)
  deny("Uso: node scripts/operations-backup.mjs backup|verify|restore /diretorio/arquivo.oliveira-backup.enc");

function connectionVariable(name) {
  const raw=env[name];
  if(!raw)deny("Conexão de banco privada não configurada.");
  let url;
  try {url=new URL(raw);}catch {deny("Conexão PostgreSQL inválida.");}
  if(!["postgresql:","postgres:"].includes(url.protocol) ||
      !url.hostname || !url.username || !url.password || url.pathname.length<2)
    deny("Conexão PostgreSQL incompleta.");
  const mode=url.searchParams.get("sslmode")||"require";
  if(!["require","verify-ca","verify-full"].includes(mode))
    deny("Conexão sem TLS obrigatório não autorizada.");
  const dbname=decodeURIComponent(url.pathname.slice(1));
  if(!dbname || dbname.includes("/"))deny("Nome de banco inválido.");
  const childEnv={...env,
    PGHOST:url.hostname,PGPORT:url.port||"5432",
    PGUSER:decodeURIComponent(url.username),
    PGPASSWORD:decodeURIComponent(url.password),
    PGDATABASE:dbname,PGSSLMODE:mode,
  };
  const channel=url.searchParams.get("channel_binding");
  if(channel)childEnv.PGCHANNELBINDING=channel;
  return {dbname,childEnv,raw};
}
async function finished(child) {
  const result=await new Promise((resolve,reject)=>{
    child.once("error",reject);
    child.once("close",(code,signal)=>resolve({code,signal}));
  });
  if(result.code!==0)deny("Ferramenta PostgreSQL falhou; verifique acesso e ambiente privado.");
}
try {
  if(env.OLIVEIRA_OPS_BACKUP_ACK!=="dedicated-neon-backup-reviewed")
    deny("Backup exige confirmação explícita do banco dedicado e destino privado.");
  if(action==="backup") {
    const {childEnv}=connectionVariable("OLIVEIRA_OPS_BACKUP_URL");
    try {await access(file);deny("Destino já existe; nunca sobrescrever backup.");}
    catch(e){if(e?.code!=="ENOENT")throw e;}
    const cmd=spawn("pg_dump",["--format=custom","--no-owner","--no-privileges"],{
      env:childEnv,stdio:["ignore","pipe","ignore"],
    });
    try {
      await Promise.all([encryptStream(cmd.stdout,file,key),finished(cmd)]);
    } catch(error) {
      cmd.kill();
      throw error;
    }
    const digest=await encryptedSha256(file);
    const bytes=(await stat(file)).size;
    console.log(JSON.stringify({status:"encrypted",bytes,sha256:digest,
      path:file,restoreVerified:false}));
  } else if(action==="verify") {
    const proc=spawn("pg_restore",["--list"],{
      env:env,stdio:["pipe","ignore","ignore"],
    });
    try {
      await decryptToStream(file,proc.stdin,key);
      proc.stdin.end();
      await finished(proc);
    } catch(error){proc.kill();throw error;}
    console.log("Arquivo cifrado íntegro e formato pg_dump reconhecido. Restauração em banco separado ainda não comprovada.");
  } else {
    if(env.OLIVEIRA_OPS_RESTORE_ACK!=="isolated-empty-database-reviewed")
      deny("Restauração permitida somente em banco de destino isolado e vazio.");
    const target=connectionVariable("OLIVEIRA_OPS_RESTORE_URL");
    const pool=new Pool({connectionString:target.raw,max:1,connectionTimeoutMillis:8000});
    try {
      const result=await pool.query(
        "SELECT count(*)::int AS total FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'oliveira_%'");
      if(result.rows[0]?.total!==0)
        deny("Banco de destino contém tabelas Oliveira; restauração recusada.");
    } finally {await pool.end();}
    const proc=spawn("pg_restore",[
      "--dbname",target.dbname,"--no-owner","--no-privileges","--exit-on-error",
    ],{env:target.childEnv,stdio:["pipe","ignore","ignore"]});
    try {
      await decryptToStream(file,proc.stdin,key);
      proc.stdin.end();
      await finished(proc);
    } catch(error){proc.kill();throw error;}
    console.log("Arquivo restaurado no banco isolado. Confirme integridade, controles de acesso e leitura com chave da aplicação antes de homologar.");
  }
} catch(error) {
  // Never log database URLs, password, SQL payloads or private dump contents.
  console.error("Backup/restauração não concluído:",error?.message||"Falha.");
  process.exitCode=1;
}
