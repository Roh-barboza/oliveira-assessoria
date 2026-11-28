import { createHmac, randomUUID } from "node:crypto";
import { encryption } from "../platform/security.mjs";

const services = new Set(["Passaporte italiano","AIRE","Fast It","Estado civil","Montagem de pasta para processos","Imposto de Renda","Processo administrativo","Não sei qual serviço preciso"]);
const area = "Assessoria Brasil e Itália";
const headers = {"Cache-Control":"no-store, private","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const reply = (body,status=200,extra={}) => Response.json(body,{status,headers:{...headers,...extra}});
const error = (status,message,extra={}) => reply({ok:false,error:message},status,extra);
async function readBody(request) {
  const length=request.headers.get("content-length");
  if(length!==null && (!/^\d+$/.test(length)||Number(length)>12288)) throw Object.assign(Error("Tamanho inválido"),{status:413});
  const reader=request.body?.getReader();
  if(!reader) throw Error("Corpo ausente");
  const parts=[]; let size=0;
  try {
    for(;;) {
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>12288) { await reader.cancel(); throw Object.assign(Error("Tamanho inválido"),{status:413}); }
      parts.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } finally { reader.releaseLock(); }
}
export function validateLead(body) {
  if(!body || typeof body!=="object" || Array.isArray(body) ||
     Object.keys(body).some(k=>!["nome","whatsapp","area","mensagem","website"].includes(k)) ||
     (body.website!==undefined && body.website!=="") ||
     !["nome","whatsapp","area","mensagem"].every(k=>typeof body[k]==="string")) return null;
  const nome=body.nome.trim(), raw=body.whatsapp.trim(), whatsapp=raw.replace(/\D/g,"");
  const match=body.mensagem.match(/^\[([^\]]+)\](?:\s|$)/);
  if(nome.length<2||nome.length>120||/[\x00-\x1f\x7f]/.test(nome)||
     raw.length>25||!/^[+\d\s().-]+$/.test(raw)||whatsapp.length<10||whatsapp.length>15||/^(\d)\1+$/.test(whatsapp)||
     body.area!==area||!match||!services.has(match[1])) return null;
  const mensagem=body.mensagem.slice(match[0].length).trim();
  if(mensagem.length>2000||body.mensagem.length>2120||/\x00/.test(mensagem)) return null;
  return {nome,whatsapp,area,servico:match[1],mensagem};
}
export function createLeadHandler({store,allowedOrigins}) {
  return async request=>{
    if(request.method!=="POST") return error(405,"Método não permitido.",{Allow:"POST"});
    const origin=request.headers.get("origin");
    if(!allowedOrigins.has(origin)||new URL(request.url).origin!==origin||request.headers.get("sec-fetch-site")==="cross-site") return error(403,"Origem não autorizada.");
    if(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json") return error(415,"Formato inválido.");
    let payload;
    try { payload=validateLead(await readBody(request)); }
    catch(e) { return error(e.status===413?413:400,"Solicitação inválida."); }
    if(!payload) return error(422,"Confira os campos do formulário.");
    if(!store) return error(503,"Recebimento temporariamente indisponível.");
    try {
      const result=await store.save(payload);
      if(result.limited) return error(429,"Limite temporário de envios. Tente mais tarde.",{"Retry-After":"3600"});
      if(typeof result.id!=="string"||!result.id.trim()) return error(503,"Não foi possível confirmar a gravação.");
      return reply({ok:true,protocol:result.id},result.duplicate?200:201);
    } catch { return error(503,"Não foi possível confirmar a gravação."); }
  };
}
export function postgresLeadStore(pool,key) {
  const cipher=encryption(key);
  const hash=(label,value)=>createHmac("sha256",Buffer.from(key,"hex")).update(label+"\0"+value).digest("hex");
  return {async save(payload){
    const fingerprint=hash("dedupe",JSON.stringify(payload));
    const phoneHash=hash("phone",payload.whatsapp);
    const id=randomUUID();
    const encrypted=cipher.seal(Buffer.from(JSON.stringify(payload)),"pincio-lead:"+id);
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize the small intake queue, including retries across hour boundaries.
      await client.query("SELECT id FROM pincio_lead_guard WHERE id=1 FOR UPDATE");
      const {rows:guard}=await client.query("SELECT id FROM pincio_lead_guard WHERE id=1");
      if(guard.length!==1) throw Error("Migration incomplete");
      const {rows:previous}=await client.query("SELECT id FROM pincio_leads WHERE fingerprint=$1 AND created_at >= now() - interval '24 hours' ORDER BY created_at DESC LIMIT 1",[fingerprint]);
      if(previous.length){await client.query("COMMIT");return {id:previous[0].id,duplicate:true};}
      const {rows:[counts]}=await client.query("SELECT count(*)::int AS total,count(*) FILTER (WHERE phone_hash=$1)::int AS phone FROM pincio_leads WHERE created_at >= now() - interval '1 hour'",[phoneHash]);
      if(counts.total>=60||counts.phone>=5){await client.query("ROLLBACK");return {limited:true};}
      await client.query("INSERT INTO pincio_leads(id,fingerprint,phone_hash,payload) VALUES($1,$2,$3,$4)",[id,fingerprint,phoneHash,encrypted]);
      await client.query("COMMIT");
      return {id,duplicate:false};
    }catch(e){try{await client.query("ROLLBACK");}catch{}throw e;}
    finally{client.release();}
  }};
}
