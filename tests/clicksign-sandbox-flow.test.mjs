import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { clicksign, maxPdfBytes } from "../server/platform/providers/clicksign.mjs";
import { renderPdf } from "../server/platform/pdf.mjs";

const authEnv = {
  CLICKSIGN_SANDBOX_EXPLICIT_TEST: "1",
  CLICKSIGN_ACCESS_TOKEN: "local-mocked-token-only",
  CLICKSIGN_WEBHOOK_SECRET: "local-mocked-secret-only",
  CLICKSIGN_TEST_EMAIL: "assinatura@example.invalid",
};

const envelopeId = "00000000-0000-4000-8000-000000000010";
const documentId = "00000000-0000-4000-8000-000000000020";
const signerId = "00000000-0000-4000-8000-000000000030";
const reqId1 = "00000000-0000-4000-8000-000000000040";
const reqId2 = "00000000-0000-4000-8000-000000000050";

test("Clicksign sandbox complete envelope-to-signed-PDF journey, with 100% mocked network", async () => {
  const contractId = randomUUID();
  const pdf = Buffer.from(await renderPdf([
    ["CONTRATO FICTÍCIO", "Minuta de teste sem validade jurídica."],
    ["SERVIÇO", "Assessoria documental simulada sem cobrança."],
    ["ASSINATURA", "Signatário de demonstração, sem dados pessoais reais."],
  ], new Date("2026-11-23T12:00:00.000Z")));
  assert.ok(pdf.subarray(0,5).equals(Buffer.from("%PDF-")));
  assert.ok(pdf.length <= maxPdfBytes);
  let status="draft";
  let eventsSigned=false;
  const requests=[];
  const checkpointLog=[];
  const fetcher=async (url, options={}) => {
    const { pathname, hostname, protocol } = new URL(url);
    requests.push({url:String(url),method:options.method||"GET",
      body:options.body?JSON.parse(options.body):null,
      headers:options.headers||{}});
    assert.equal(protocol,"https:");
    if (hostname==="clicksign-content-sandbox.s3.amazonaws.com") {
      assert.equal(pathname,"/test-signed.pdf");
      return new Response(pdf,{status:200,headers:{"content-type":"application/pdf"}});
    }
    assert.equal(hostname,"sandbox.clicksign.com");
    assert.ok(pathname.startsWith("/api/v3/envelopes"));
    assert.equal(options.headers?.Authorization,authEnv.CLICKSIGN_ACCESS_TOKEN);
    assert.equal(options.headers?.["Content-Type"],"application/vnd.api+json");
    if(pathname==="/api/v3/envelopes"&&options.method==="POST"){
      assert.equal(options.body!==undefined,true);
      assert.equal(JSON.parse(options.body).data.type,"envelopes");
      assert.match(JSON.parse(options.body).data.attributes.name,/SANDBOX Oliveira/);
      return Response.json({data:{id:envelopeId,type:"envelopes",attributes:{status:"draft"}}});
    }
    if(pathname===`/api/v3/envelopes/${envelopeId}/documents`&&options.method==="POST"){
      const data=JSON.parse(options.body).data;
      assert.equal(data.type,"documents");
      assert.equal(data.attributes.metadata.contract_id,contractId);
      const raw=Buffer.from(data.attributes.content_base64.split(",")[1],"base64");
      assert.deepEqual(raw,pdf);
      return Response.json({data:{id:documentId,type:"documents"}});
    }
    if(pathname===`/api/v3/envelopes/${envelopeId}/signers`&&options.method==="POST"){
      const data=JSON.parse(options.body).data;
      assert.equal(data.attributes.email,authEnv.CLICKSIGN_TEST_EMAIL);
      assert.equal(data.attributes.communicate_events.signature_request,"none");
      return Response.json({data:{id:signerId,type:"signers"}});
    }
    if(pathname===`/api/v3/envelopes/${envelopeId}/requirements`&&options.method==="POST"){
      const data=JSON.parse(options.body).data;
      assert.equal(data.relationships.document.data.id,documentId);
      assert.equal(data.relationships.signer.data.id,signerId);
      const num=requests.filter(x=>x.url.endsWith("/requirements")).length;
      if(num===1){assert.equal(data.attributes.action,"agree");assert.equal(data.attributes.role,"sign");}
      else {assert.equal(data.attributes.action,"provide_evidence");
        assert.equal(data.attributes.auth,"embedded_signature");}
      return Response.json({data:{id:num===1?reqId1:reqId2,type:"requirements"}});
    }
    if(pathname===`/api/v3/envelopes/${envelopeId}`&&options.method==="PATCH"){
      assert.equal(JSON.parse(options.body).data.attributes.status,"running");
      status="running";
      return Response.json({data:{id:envelopeId,type:"envelopes",attributes:{status}}});
    }
    if(pathname===`/api/v3/envelopes/${envelopeId}`&&options.method==="GET")
      return Response.json({data:{id:envelopeId,type:"envelopes",attributes:{status}}});
    if(pathname===`/api/v3/envelopes/${envelopeId}/documents`&&options.method==="GET")
      return Response.json({data:[{id:documentId,attributes:{status:"closed"},
        links:{files:{signed:"https://clicksign-content-sandbox.s3.amazonaws.com/test-signed.pdf"}}}]});
    if(pathname===`/api/v3/envelopes/${envelopeId}/documents/${documentId}/events`&&options.method==="GET")
      return Response.json({data:eventsSigned?[{attributes:{name:"sign"}}]:[]});
    assert.fail(`Unexpected Clicksign test API call: ${options.method} ${pathname}`);
  };
  const adapter=clicksign(authEnv,fetcher);
  assert.equal(adapter.available,true);
  await adapter.submit({id:contractId,signature_mode:"embedded"},pdf,
    async (step,ids) => checkpointLog.push({step,...ids}));
  assert.deepEqual(checkpointLog.map(x=>x.step),[
    "criar_envelope","enviar_documento","criar_signatario",
    "qualificar_signatario","configurar_autenticacao","ativar_envelope","enviado"
  ]);
  assert.equal(checkpointLog[1].envelope,envelopeId);
  assert.equal(checkpointLog[2].document,documentId);
  assert.equal(checkpointLog[3].signer,signerId);
  assert.equal(requests.filter(x=>x.method==="POST").length,5);
  assert.equal(requests.filter(x=>x.method==="PATCH").length,1);
  assert.deepEqual(await adapter.current({envelope_id:envelopeId,
    document_id:documentId,signer_id:signerId,signature_mode:"embedded"}),
    {status:"aguardando_assinatura"});
  status="closed";
  const signed=adapter.current({envelope_id:envelopeId,
    document_id:documentId,signer_id:signerId,signature_mode:"embedded"});
  assert.deepEqual(await signed,{});
  eventsSigned=true;
  const completed=await adapter.current({envelope_id:envelopeId,
    document_id:documentId,signer_id:signerId,signature_mode:"embedded"});
  assert.equal(completed.status,"assinado");
  assert.deepEqual(completed.pdf,pdf);
  assert.equal(requests.filter(x=>x.url.includes("/test-signed.pdf")).length,1);
});

test("Clicksign provider refuses disabled sandbox and nonembedded submission", async () => {
  let calls=0;
  const fakeFetch=async()=>{calls++;throw Error("No network permitted");};
  const missing=clicksign({},fakeFetch);
  assert.equal(missing.available,false);
  await assert.rejects(
    missing.submit({id:randomUUID(),signature_mode:"embedded"},Buffer.from("%PDF-test"),async()=>{}),
    /Sandbox externo desativado/
  );
  const adapter=clicksign(authEnv,fakeFetch);
  await assert.rejects(
    adapter.submit({id:randomUUID(),signature_mode:"email"},Buffer.from("%PDF-test"),async()=>{}),
    /Sandbox externo desativado/
  );
  assert.equal(calls,0);
});

test("Clicksign blocks untrusted signed-file hosts and invalid PDF bytes", async()=>{
  let docHost="https://example.com/unsafe.pdf";
  const row={envelope_id:envelopeId,document_id:documentId,
    signer_id:signerId,signature_mode:"embedded"};
  let downloadCalls=0;
  const fetcher=async(url)=>{
    const pathname=new URL(url).pathname;
    if(url.startsWith("https://example.com")){downloadCalls++;return new Response("%PDF-invalid");}
    if(pathname===`/api/v3/envelopes/${envelopeId}`)
      return Response.json({data:{id:envelopeId,attributes:{status:"closed"}}});
    if(pathname===`/api/v3/envelopes/${envelopeId}/documents`)
      return Response.json({data:[{id:documentId,attributes:{status:"closed"},
        links:{files:{signed:docHost}}}]});
    if(pathname.includes("/events"))
      return Response.json({data:[{attributes:{name:"sign"}}]});
    if(url===docHost) {downloadCalls++;return new Response("not-a-pdf");}
    assert.fail("Unexpected request");
  };
  const a=clicksign(authEnv,fetcher);
  await assert.rejects(a.current(row),/Host de arquivo Clicksign não autorizado/);
  assert.equal(downloadCalls,0);
  docHost="https://sandbox.clicksign.com/test-signed.pdf";
  await assert.rejects(a.current(row),/Arquivo assinado inválido/);
  assert.equal(downloadCalls,1);
});
