import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { OperationalAccounts } from "../server/platform/operational-accounts.mjs";
import { OperationalCases } from "../server/platform/operational-cases.mjs";
import { OperationalContracts } from "../server/platform/operational-contracts.mjs";
import { prepareStaffAccount } from "../server/platform/operational-identity.mjs";
import { createOperationalHttp } from "../server/platform/operational-http.mjs";

async function fixture(providerOverride, sandbox = true) {
  const db = new PGlite();
  const key = randomBytes(32).toString("hex");
  const accounts = new OperationalAccounts(db);
  await accounts.setup();
  const users = {};
  for (const role of ["admin","operator"]) {
    const p = await prepareStaffAccount({
      email: role+"@example.invalid",name:"Synthetic "+role,role,
      password:"Synthetic-only-long-password-12345",
    });
    await accounts.createPrepared(p);
    await accounts.changeStatus(p.id,"active");
    users[role]=p;
  }
  const cases = new OperationalCases(db,key);
  await cases.setup();
  const c = await cases.create(users.admin.id,{title:"CASO FICTÍCIO",service:"Documento sintético"});
  const ids={
    envelope:"00000000-0000-4000-8000-000000000010",
    document:"00000000-0000-4000-8000-000000000020",
    signer:"00000000-0000-4000-8000-000000000030",
  };
  const calls = [];
  const provider = providerOverride || {
    available: true,
    probe: async () => ({ reachable: true, code: "authenticated" }),
    submit: async (_row,pdf,checkpoint) => {
      calls.push({event:"send",pdfBytes:pdf.length});
      assert.equal(pdf.subarray(0,5).toString(),"%PDF-");
      await checkpoint("enviar_documento",{envelope:ids.envelope});
      await checkpoint("criar_signatario",{document:ids.document});
      await checkpoint("enviado",{signer:ids.signer});
    },
    current: async (_row) => {
      calls.push({event:"refresh"});
      return {status:"assinado",pdf:Buffer.from("%PDF-SANDBOX-synthetic")};
    },
  };
  const sandboxEnv={
    CLICKSIGN_TEST_EMAIL:"rodrigo.barboza1994@gmail.com",
    CLICKSIGN_SANDBOX_EMAIL_EXPLICIT_TEST:sandbox?"1":"0",
  };
  const contracts = new OperationalContracts({
    database:db,encryptionKey:key,cases,sandboxEnv,provider,
  });
  return {db,accounts,cases,contracts,users,c,provider,calls};
}

test("Only MFA-active admins may initialize and issue synthetic contract drafts",async()=>{
  const a=await fixture();
  try{
    assert.equal((await a.contracts.ready(a.users.admin.id)).installed,false);
    await assert.rejects(a.contracts.setup(a.users.operator.id),{status:403});
    assert.equal((await a.contracts.setup(a.users.admin.id)).installed,true);
    const contract=await a.contracts.create(a.users.admin.id,a.c.id);
    assert.equal(contract.status,"draft");
    assert.match(contract.pdfSha256,/^[a-f0-9]{64}$/);
    const file=await a.contracts.pdf(a.users.admin.id,contract.id);
    assert.equal(Buffer.from(file.pdfBase64,"base64").subarray(0,5).toString(),"%PDF-");
    assert.equal(file.synthetic,true);
    assert.equal(file.sha256,contract.pdfSha256);
    assert.equal((await a.contracts.list(a.users.admin.id,a.c.id)).length,1);
    await assert.rejects(a.contracts.pdf(a.users.operator.id,contract.id),{status:403});
    const enc=await a.db.query(
      "SELECT encrypted_pdf FROM oliveira_operational_contracts WHERE id=$1",[contract.id]);
    assert.equal(Buffer.from(enc.rows[0].encrypted_pdf).includes(
      Buffer.from("SANDBOX")),false);
    const approved=await a.contracts.approve(a.users.admin.id,contract.id,1);
    assert.equal(approved.status,"approved");
    assert.equal(approved.version,2);
    await assert.rejects(a.contracts.approve(a.users.admin.id,contract.id,1),{status:409});
    await assert.rejects(a.contracts.send(a.users.admin.id,contract.id,2,"wrong"),{status:422});
    const invited=await a.contracts.send(
      a.users.admin.id,contract.id,2,"ENVIAR_TESTE_SANDBOX");
    assert.equal(invited.status,"awaiting_signature");
    assert.equal(a.calls.filter(x=>x.event==="send").length,1);
    await assert.rejects(
      a.contracts.send(a.users.admin.id,contract.id,2,"ENVIAR_TESTE_SANDBOX"),
      {status:409});
    const signed=await a.contracts.refresh(a.users.admin.id,contract.id);
    assert.equal(signed.status,"signed");
    assert.equal(signed.signedReady,true);
    const signedPdf=await a.contracts.pdf(a.users.admin.id,contract.id,true);
    assert.equal(Buffer.from(signedPdf.pdfBase64,"base64").toString(),
      "%PDF-SANDBOX-synthetic");
    const events=await a.db.query(
      "SELECT event FROM oliveira_operational_contract_events WHERE contract_id=$1 ORDER BY occurred_at",
      [contract.id]);
    assert.equal(events.rows.length,4);
  } finally { await a.db.close(); }
});

test("Disabled Sandbox invitation cannot reach external signature provider",async()=>{
  let count=0;
  const a=await fixture({
    available:true,
    submit:async()=>{count++;throw Error("External send must not happen.");},
  },false);
  try{
    await a.contracts.setup(a.users.admin.id);
    const draft=await a.contracts.create(a.users.admin.id,a.c.id);
    const approved=await a.contracts.approve(a.users.admin.id,draft.id,draft.version);
    await assert.rejects(
      a.contracts.send(a.users.admin.id,approved.id,approved.version,"ENVIAR_TESTE_SANDBOX"),
      {status:503});
    assert.equal(count,0);
    assert.equal((await a.contracts.list(a.users.admin.id,a.c.id))[0].status,"approved");
  } finally { await a.db.close(); }
});

test("Invalid Sandbox authentication blocks sending before any state change",async()=>{
  let submits=0;
  const a=await fixture({
    available:true,
    probe:async()=>({reachable:false,code:"http_401"}),
    submit:async()=>{submits++;throw Error("No remote submission allowed.");},
  });
  try{
    await a.contracts.setup(a.users.admin.id);
    const d=await a.contracts.create(a.users.admin.id,a.c.id);
    const approved=await a.contracts.approve(a.users.admin.id,d.id,d.version);
    await assert.rejects(
      a.contracts.send(a.users.admin.id,d.id,approved.version,"ENVIAR_TESTE_SANDBOX"),
      {status:503,message:/http_401/});
    const row=(await a.contracts.list(a.users.admin.id,a.c.id))[0];
    assert.equal(row.status,"approved");
    assert.equal(row.version,approved.version);
    assert.equal(row.envelopeId,null);
    assert.equal(submits,0);
  } finally { await a.db.close(); }
});

test("Sandbox remote failure prevents automatic duplicate envelope creation",async()=>{
  let count=0;
  const a=await fixture({
    available:true,
    probe:async()=>({reachable:true,code:"authenticated"}),
    submit:async(_row,_pdf,checkpoint)=>{
      count++;
      await checkpoint("criar_envelope",{envelope:"00000000-0000-4000-8000-000000000010"});
      throw Error("Remote timeout after envelope creation");
    },
  });
  try{
    await a.contracts.setup(a.users.admin.id);
    const d=await a.contracts.create(a.users.admin.id,a.c.id);
    const approved=await a.contracts.approve(a.users.admin.id,d.id,d.version);
    await assert.rejects(
      a.contracts.send(a.users.admin.id,d.id,approved.version,"ENVIAR_TESTE_SANDBOX"),
      {status:503});
    assert.equal((await a.contracts.list(a.users.admin.id,a.c.id))[0].status,"manual_review");
    await assert.rejects(
      a.contracts.send(a.users.admin.id,d.id,approved.version,"ENVIAR_TESTE_SANDBOX"),
      {status:409});
    assert.equal(count,1);
  }finally{await a.db.close();}
});

test("Contract HTTP requires admin session, origin and explicit sandbox acknowledgement",async()=>{
  const a=await fixture();
  const origin="https://ops.example.test";
  const token="x".repeat(43);
  const identity = a.users.admin;
  const handler = createOperationalHttp({
    allowedOrigin:origin,networkIdentity:()=> "synthetic",
    authentication:{login:async()=>({authenticated:false})},
    accounts:{getSession:async()=>identity,revoke:async()=>{}},
    cases:a.cases,contracts:a.contracts,
  });
  const req=(op,body,extra={})=>handler(new Request(origin+"/api/operacional?op="+op,{
    method:body?"POST":"GET",
    headers:{cookie:"__Host-oliveira-ops="+token,
      ...(body?{origin,"content-type":"application/json"}:{}),...extra},
    body:body?JSON.stringify(body):undefined,
  }));
  try{
    assert.equal((await req("contract-ready")).status,200);
    assert.equal((await req("contract-connection")).status,200);
    assert.deepEqual((await (await req("contract-connection")).json()).check,
      {reachable:true,code:"authenticated"});
    assert.equal((await req("contract-install",{acknowledge:"WRONG"})).status,422);
    assert.equal((await req("contract-install",{acknowledge:"SANDBOX_SOMENTE"},
      {origin:"https://evil.example.test"})).status,403);
    assert.equal((await req("contract-install",{acknowledge:"SANDBOX_SOMENTE"})).status,200);
    const created=await req("contract-create",{caseId:a.c.id});
    assert.equal(created.status,201);
    const doc=(await created.json()).contract;
    const preview=await req("contract-preview",{});
    assert.equal(preview.status,422);
    const list=await req("contract-list");
    assert.equal(list.status,422);
    identity.role="operator";
    assert.equal((await req("contract-ready")).status,403);
    assert.equal((await req("contract-connection")).status,403);
    assert.equal((await req("contract-approve",{id:doc.id,version:1})).status,403);
  }finally{await a.db.close();}
});

test("Failed Clicksign notification records sanitized HTTP code and stage for manual review", async () => {
  const a=await fixture({
    available:true,
    submit:async(_row,_pdf,checkpoint)=>{
      await checkpoint("enviar_documento",{envelope:"00000000-0000-4000-8000-000000000010"});
      await checkpoint("notificar_signatario",{signer:"00000000-0000-4000-8000-000000000030"});
      throw Error("Clicksign HTTP 503");
    },
    probe:async()=>({reachable:true,code:"authenticated"}),
  });
  try {
    await a.contracts.setup(a.users.admin.id);
    const created=await a.contracts.create(a.users.admin.id,a.c.id);
    const approved=await a.contracts.approve(a.users.admin.id,created.id,created.version);
    await assert.rejects(
      a.contracts.send(a.users.admin.id,approved.id,approved.version,"ENVIAR_TESTE_SANDBOX"),
      {status:503});
    const row=(await a.contracts.list(a.users.admin.id,a.c.id))[0];
    assert.equal(row.status,"manual_review");
    assert.equal(row.stage,"notificar_signatario:http_503");
    assert.equal(row.envelopeId,"00000000-0000-4000-8000-000000000010");
    assert.deepEqual(await a.contracts.connection(a.users.admin.id),
      {reachable:true,code:"authenticated"});
    await assert.rejects(a.contracts.connection(a.users.operator.id),{status:403});
    await assert.rejects(
      a.contracts.send(a.users.admin.id,approved.id,approved.version,"ENVIAR_TESTE_SANDBOX"),
      {status:409});
  } finally { await a.db.close(); }
});
