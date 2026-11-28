import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {seal,unseal,permitted} from "../server/crm/auth.mjs";
import {sheetsCall} from "../server/crm/sheets.mjs";
const code=await readFile("apps-script/pincio-crm/Code.gs","utf8");
const context=vm.createContext({});vm.runInContext(code,context);
const apply=context.apply_,now="2026-11-28T12:00:00.000Z",actor="admin@example.invalid";
function state(){return {LEADS:[],TAREFAS:[],ATENDIMENTOS:[],CLIENTES:[],VENDAS:[],PROCESSOS:[],HISTORICO_SERVICOS:[],AUDITORIA:[],OPERACOES:[],USUARIOS:[{email:actor,perfil:"admin",ativo:"sim"}],CONFIG:[],FLUXOS:[{servico:"AIRE",ordem:1,etapa:"Triagem",prazo_interno_dias:1},{servico:"AIRE",ordem:2,etapa:"Entrega",prazo_interno_dias:3}]};}
const lead={nome:"Teste fictício",whatsapp:"11900000000",servico:"AIRE",mensagem:"=não é fórmula"};
test("intake dedup, contact follow-up, sale and process lifecycle",()=>{
 const s=state();assert.equal(apply(s,"intake",lead,"public","l1",now).id,"l1");assert.equal(apply(s,"intake",lead,"public","l2",now).duplicate,true);assert.equal(s.LEADS.length,1);assert.equal(s.TAREFAS.length,1);
 apply(s,"contact",{lead_id:"l1",canal:"WhatsApp",resultado:"sem_resposta"},actor,"c1",now);assert.equal(s.LEADS[0].proximo_followup,"2026-11-29T12:00:00.000Z");assert.equal(s.TAREFAS[0].status,"concluida");
 apply(s,"contact",{lead_id:"l1",canal:"WhatsApp",resultado:"sem_resposta"},actor,"c2",now);assert.equal(s.LEADS[0].proximo_followup,"2026-12-01T12:00:00.000Z");
 apply(s,"contact",{lead_id:"l1",canal:"WhatsApp",resultado:"sem_resposta"},actor,"c3",now);assert.equal(s.TAREFAS.at(-1).tipo,"revisar_lead");
 apply(s,"sale",{lead_id:"l1",servico:"AIRE",valor_centavos:15000},actor,"s1",now);assert.equal(s.VENDAS.length,1);assert.equal(s.PROCESSOS[0].etapa,"Triagem");assert.equal(s.LEADS[0].status,"contratado");
 assert.throws(()=>apply(s,"sale",{lead_id:"l1",valor_centavos:15000},actor,"s2",now),/encerrado/);
 apply(s,"advance",{processo_id:"s1:process",ordem_atual:1},actor,"a1",now);assert.equal(s.PROCESSOS[0].etapa,"Entrega");assert.throws(()=>apply(s,"advance",{processo_id:"s1:process",ordem_atual:1},actor,"a2",now),/Etapa mudou/);
 apply(s,"advance",{processo_id:"s1:process",ordem_atual:2},actor,"a3",now);assert.equal(s.PROCESSOS[0].status,"concluido");
 assert.equal(apply(s,"dashboard",{},actor,"d1",now).metrics.salesCents,15000);
});
test("only approved members can read, public cannot read or sell",()=>{const s=state();assert.throws(()=>apply(s,"dashboard",{},"public","x",now),/não autorizado/);assert.throws(()=>apply(s,"dashboard",{},"other@example.invalid","x",now),/não autorizado/);});
test("sessions are signed, expire and require exact email allowlist",()=>{const k="k".repeat(32),v=seal({email:actor,exp:200},k);assert.equal(unseal(v,k,100).email,actor);assert.equal(unseal(v,k,201),null);assert.equal(unseal(v+"x",k,100),null);assert.equal(permitted(actor,{PINCIO_CRM_ALLOWED_EMAILS:actor}),true);assert.equal(permitted("x"+actor,{PINCIO_CRM_ALLOWED_EMAILS:actor}),false);});
test("transport only sends signed envelopes to configured Google Apps Script",async()=>{const env={PINCIO_CRM_SCRIPT_URL:"https://script.google.com/macros/s/example/exec",PINCIO_CRM_SHARED_SECRET:"x".repeat(32)};const result=await sheetsCall({actor:"public",action:"intake",data:lead,id:"l1"},env,async(url,opts)=>{assert.equal(url,env.PINCIO_CRM_SCRIPT_URL);const b=JSON.parse(opts.body);assert.equal(JSON.parse(b.payload).id,"l1");assert.match(b.sig,/^[A-Za-z0-9_-]{43}$/);return Response.json({ok:true,data:{id:"l1"}});});assert.equal(result.id,"l1");await assert.rejects(sheetsCall({actor:"public",action:"intake"}, {...env,PINCIO_CRM_SCRIPT_URL:"https://evil.invalid/exec"}),/indisponível/);});
