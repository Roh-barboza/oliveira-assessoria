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

test("manual duplicate is not inserted; contact and process histories available to authorized team",()=>{const s=state();apply(s,"createLead",lead,actor,"m1",now);assert.equal(apply(s,"createLead",lead,actor,"m2",now).duplicate,true);assert.equal(s.LEADS.length,1);apply(s,"contact",{lead_id:"m1",canal:"WhatsApp",resultado:"respondeu",observacao:"Teste"},actor,"c1",now);apply(s,"sale",{lead_id:"m1",servico:"AIRE",valor_centavos:1000},actor,"s1",now);const d=apply(s,"dashboard",{},actor,"d1",now);assert.equal(d.contacts.length,1);assert.equal(d.history.length,1);assert.equal(d.clients.length,1);});

test("Apps Script output follows only Google's ContentService redirect without forwarding the signed POST", async () => {
  const scriptUrl = "https://script.google.com/macros/s/example/exec";
  const outputUrl = "https://script.googleusercontent.com/macros/echo?mock=1";
  const env = { PINCIO_CRM_SCRIPT_URL: scriptUrl, PINCIO_CRM_SHARED_SECRET: "x".repeat(32) };
  const input = { actor, action: "dashboard" };
  const calls = [];
  await sheetsCall(input, env, async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, "manual");
    if (url === scriptUrl) {
      assert.equal(options.method, "POST");
      return Response.redirect(outputUrl, 302);
    }
    assert.equal(options.body, undefined);
    assert.equal(options.method, undefined);
    return Response.json({ ok: true, data: {} });
  });
  assert.deepEqual(calls, [scriptUrl, outputUrl]);
});

test("signed writes fail closed on contention and preserve one atomic commit across retries", async () => {
  const { createHmac } = await import("node:crypto");
  const sandbox = vm.createContext({});
  vm.runInContext(code, sandbox);
  const schema = vm.runInContext("TABLES", sandbox);
  const rows = Object.fromEntries(Object.entries(schema).map(([name, header]) => [name, [header.split(" ")]]));
  rows.CONFIG.push(["modo", "ativo", ""]);
  rows.FLUXOS.push(["AIRE", 1, "Triagem", 1]);
  const names = Object.keys(rows);
  let acquired = false;
  let failWrite = false;
  let commits = 0;
  let locked = true;
  let releases = 0;
  const key = "test-transport".repeat(4);
  const mac = value => createHmac("sha256", key).update(value).digest("base64url");
  sandbox.sign_ = mac;
  sandbox.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: name => name.endsWith("SHARED_SECRET") ? key : "synthetic-sheet",
    }),
  };
  sandbox.LockService = {
    getScriptLock: () => ({
      tryLock: () => (acquired = !locked),
      releaseLock: () => { if (acquired) releases++; acquired = false; },
    }),
  };
  sandbox.SpreadsheetApp = {
    openById: () => ({
      getSheetByName: name => rows[name] ? ({
        getLastRow: () => rows[name].length,
        getRange: () => ({ getValues: () => rows[name] }),
        getMaxRows: () => 1000,
        getSheetId: () => names.indexOf(name),
      }) : null,
    }),
  };
  sandbox.Sheets = {
    Spreadsheets: {
      batchUpdate: ({ requests }) => {
        assert.ok(acquired);
        if (failWrite) throw Error("Simulated Sheets write failure");
        commits++;
        for (const { updateCells: update } of requests) {
          const { start, rows: [row] } = update;
          rows[names[start.sheetId]][start.rowIndex] = row.values.map(({ userEnteredValue: value }) => {
            assert.equal(value.formulaValue, undefined);
            return value.stringValue ?? value.numberValue;
          });
        }
      },
    },
  };
  sandbox.json_ = value => value;
  const payload = JSON.stringify({ actor: "public", action: "intake", id: "fixture", data: lead });
  const send = (ts, sig = mac(ts + "." + payload)) =>
    sandbox.doPost({ postData: { contents: JSON.stringify({ payload, ts, sig }) } });
  const now = Date.now();
  assert.equal(send(now, "invalid").status, 403);
  assert.equal(send(now - 301000).status, 403);
  assert.equal(send(now).status, 503);
  locked = false;
  failWrite = true;
  assert.equal(send(now).status, 503);
  assert.equal(rows.LEADS.length, 1);
  assert.equal(rows.OPERACOES.length, 1);
  failWrite = false;
  assert.equal(send(now).data.id, "fixture");
  assert.equal(send(now).data.id, "fixture");
  assert.equal(commits, 1);
  assert.equal(rows.TAREFAS.length, 2);
  assert.equal(rows.AUDITORIA.length, 2);
  assert.equal(rows.OPERACOES.length, 2);
  assert.equal(rows.LEADS[1][8], lead.mensagem);
  assert.equal(releases, 3);
});

test("payment plans preserve the contracted total and partial receipts drive outstanding balances", () => {
  const s = { ...state(), PARCELAS: [], RECEBIMENTOS: [] };
  apply(s, "createLead", lead, actor, "l1", now);
  apply(s, "sale", { lead_id: "l1", valor_centavos: 11000 }, actor, "s1", now);
  const plan = {
    venda_id: "s1",
    forma_pagamento: "Pix",
    parcelas: [
      { vencimento: "2026-11-26", valor_centavos: 5000 },
      { vencimento: "2026-12-27", valor_centavos: 6000 },
    ],
  };
  assert.throws(() => apply(s, "paymentPlan", { ...plan, parcelas: plan.parcelas.slice(0, 1) }, actor, "p1", now), /somar/);
  assert.equal(s.PARCELAS.length, 0);
  apply(s, "paymentPlan", plan, actor, "p1", now);
  assert.throws(() => apply(s, "paymentPlan", plan, actor, "p2", now), /parcelada/);
  const receipt = { parcela_id: "p1:1", data: "2026-11-28", valor_centavos: 2000 };
  apply(s, "receivePayment", receipt, actor, "r1", now);
  assert.throws(() => apply(s, "receivePayment", { ...receipt, valor_centavos: 3001 }, actor, "r2", now), /saldo/);
  assert.throws(() => apply(s, "receivePayment", { ...receipt, data: "2026-02-30" }, actor, "r2", now), /Data inválida/);
  assert.throws(() => apply(s, "receivePayment", { ...receipt, data: "2026-11-29" }, actor, "r2", now), /inválido/);
  const dashboard = apply(s, "dashboard", {}, actor, "d1", now);
  assert.equal(dashboard.metrics.converted, 1);
  assert.equal(dashboard.metrics.salesCents, 11000);
  assert.equal(dashboard.finance.monthPaid, 2000);
  assert.equal(dashboard.finance.pending, 9000);
  assert.equal(dashboard.finance.overdue, 3000);
});

test("scheduled summaries include only internal counts and leave disabled automation idle", async () => {
  const automation = await readFile("apps-script/pincio-crm-automation/Code.gs", "utf8");
  const sandbox = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Utilities: { formatDate: date => date.toISOString().slice(0, 10) },
  });
  vm.runInContext(automation, sandbox);
  assert.doesNotThrow(() => sandbox.runCrmDailyAutomation());
  const tabs = {
    LEADS: [["nome", "status", "ultimo_contato", "proximo_followup"], ["Nome fictício", "novo", "", "2026-11-26"]],
    TAREFAS: [["vencimento", "status"], ["2026-11-26", "pendente"]],
    PROCESSOS: [["atualizado_em", "status"], ["2026-11-19", "ativo"]],
  };
  const workbook = {
    getSheetByName: name => tabs[name] ? ({
      getLastRow: () => tabs[name].length,
      getDataRange: () => ({ getValues: () => tabs[name] }),
    }) : null,
  };
  const report = sandbox.summary_(workbook, new Date(now), 7);
  assert.match(report, /Leads novos sem atendimento: 1/);
  assert.match(report, /Retornos vencidos: 1/);
  assert.match(report, /Tarefas vencidas: 1/);
  assert.match(report, /Processos sem atualização há 7 dias ou mais: 1/);
  assert.doesNotMatch(report, /Nome fictício/);
});

test("the administrator can reassign follow-ups and change cadence, and a pending document keeps the process stage", () => {
  const s = state();
  const operator = "operator@example.invalid";
  s.USUARIOS.push({ email: operator, perfil: "operador", ativo: "sim" });
  apply(s, "createLead", lead, actor, "l1", now);
  assert.throws(() => apply(s, "assignLead", { lead_id: "l1", responsavel: operator }, operator, "a1", now), /administradores/);
  assert.throws(() => apply(s, "setFollowup", { days: [2, 4, 8] }, operator, "f1", now), /administradores/);
  apply(s, "assignLead", { lead_id: "l1", responsavel: operator }, actor, "a1", now);
  assert.equal(s.TAREFAS[0].responsavel, operator);
  apply(s, "setFollowup", { days: [2, 4, 8] }, actor, "f1", now);
  apply(s, "contact", { lead_id: "l1", canal: "E-mail", resultado: "sem_resposta" }, actor, "c1", now);
  assert.equal(s.TAREFAS.at(-1).vencimento, "2026-11-30T12:00:00.000Z");
  assert.equal(s.TAREFAS.at(-1).responsavel, operator);
  const { processo_id } = apply(s, "sale", { lead_id: "l1", valor_centavos: 10000 }, actor, "s1", now);
  apply(s, "processNote", { processo_id, ordem_atual: 1, observacao: "Documento fictício pendente" }, operator, "n1", now);
  assert.equal(s.HISTORICO_SERVICOS.at(-1).observacao, "Documento fictício pendente");
  assert.equal(s.PROCESSOS[0].ordem, 1);
  assert.equal(s.TAREFAS.at(-1).status, "pendente");
});
