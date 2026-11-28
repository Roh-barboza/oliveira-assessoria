import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createLeadHandler, validateLead, postgresLeadStore } from "../server/leads/intake.mjs";
import { encryption } from "../server/platform/security.mjs";
const origin="https://pincio-assessoria.vercel.app";
const valid={nome:"Contato sintético",whatsapp:"11900000000",area:"Assessoria Brasil e Itália",mensagem:"[AIRE] Teste"};
const req=(body=valid,headers={},method="POST")=>new Request(origin+"/api/leads",{method,headers:{origin,"content-type":"application/json",...headers},...(method==="POST"?{body:JSON.stringify(body)}:{})});
test("API rejects cross-origin, methods, invalid payloads and missing persistence",async()=>{
  let calls=0;
  const store={save:async()=>{calls++;return {id:"test"};}};
  const run=createLeadHandler({store,allowedOrigins:new Set([origin])});
  assert.equal((await run(req(valid,{origin:"https://other.invalid"}))).status,403);
  assert.equal((await run(req(valid,{},"GET"))).status,405);
  assert.equal((await run(req(valid,{"content-type":"text/plain"}))).status,415);
  assert.equal((await run(req({...valid,website:"bot"}))).status,422);
  assert.equal((await run(req({...valid,whatsapp:"123"}))).status,422);
  assert.equal((await run(req({...valid,mensagem:"[Outro] teste"}))).status,422);
  assert.equal((await run(req({...valid,mensagem:"a".repeat(13000)}))).status,413);
  assert.equal(calls,0);
  assert.equal((await createLeadHandler({allowedOrigins:new Set([origin])})(req())).status,503);
  const failure=createLeadHandler({store:{save:async()=>{throw Error("private details");}},allowedOrigins:new Set([origin])});
  const res=await failure(req());
  assert.equal(res.status,503);assert.doesNotMatch(await res.text(),/private details/);
});
test("SQL persistence encrypts payload, deduplicates retries and limits repeated phone",async()=>{
  const db=new PGlite();
  try {
    await db.exec(await readFile("db/pincio-leads.sql","utf8"));
    const pool={connect:async()=>({query:(sql,args)=>db.query(sql,args),release(){}})};
    const key="ab".repeat(32),store=postgresLeadStore(pool,key);
    const run=createLeadHandler({store,allowedOrigins:new Set([origin])});
    const first=await run(req());assert.equal(first.status,201);
    const one=await first.json();assert.equal(one.ok,true);
    const retry=await run(req());assert.equal(retry.status,200);assert.equal((await retry.json()).protocol,one.protocol);
    const {rows}=await db.query("SELECT * FROM pincio_leads");
    assert.equal(rows.length,1);
    assert.doesNotMatch(Buffer.from(rows[0].payload).toString("utf8"),/Contato sintético/);
    assert.deepEqual(JSON.parse(encryption(key).open(rows[0].payload,"pincio-lead:"+one.protocol)),validateLead(valid));
    for(let i=0;i<4;i++) assert.equal((await run(req({...valid,mensagem:"[AIRE] Variação "+i}))).status,201);
    assert.equal((await run(req({...valid,mensagem:"[AIRE] Novo"}))).status,429);
    assert.equal((await run(req())).status,200);
  } finally{await db.close();}
});
