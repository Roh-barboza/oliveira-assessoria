import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {OperationalAccounts} from "../server/platform/operational-accounts.mjs";
import {OperationalCases} from "../server/platform/operational-cases.mjs";
import {OperationalDocuments} from "../server/platform/operational-documents.mjs";
import {prepareStaffAccount} from "../server/platform/operational-identity.mjs";
import {createOperationalHttp} from "../server/platform/operational-http.mjs";

const key=randomBytes(32).toString("hex");
const pdf=Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
async function context() {
  const db=new PGlite();
  const accounts=new OperationalAccounts(db);
  await accounts.setup();
  const users={};
  for(const [role,name] of [["admin","admin"],["operator","operator"],["operator","other"],["reviewer","reviewer"]]) {
    const account=await prepareStaffAccount({
      email:name+"@example.test",name,role,
      password:"Long-staff-test-password-only-123456",
    });
    await accounts.createPrepared(account);
    await accounts.changeStatus(account.id,"active");
    users[name]=account;
  }
  const cases=new OperationalCases(db,key);
  await cases.setup();
  const item=await cases.create(users.operator.id,{
    title:"Test case",service:"Documentação sintética",
  });
  const documents=new OperationalDocuments({
    database:db,encryptionKey:key,cases,
    scanner:{scan:async()=>({clean:true,engineVerified:true})},
  });
  await documents.setup();
  return {db,accounts,users,cases,item,documents};
}
test("encrypted PDF uploads require scanner, case ownership, and readable audit",async()=>{
  const {db,users,cases,item,documents}=await context();
  try {
    const blocked=new OperationalDocuments({database:db,encryptionKey:key,cases});
    await assert.rejects(blocked.upload(users.operator.id,{
      caseId:item.id,name:"anexo.pdf",mimeType:"application/pdf",
      base64:pdf.toString("base64"),
    }),{status:503});
    await assert.rejects(documents.upload(users.other.id,{
      caseId:item.id,name:"anexo.pdf",mimeType:"application/pdf",
      base64:pdf.toString("base64"),
    }),{status:404});
    await assert.rejects(documents.upload(users.reviewer.id,{
      caseId:item.id,name:"anexo.pdf",mimeType:"application/pdf",
      base64:pdf.toString("base64"),
    }),{status:404});
    const uploaded=await documents.upload(users.operator.id,{
      caseId:item.id,name:"registro.pdf",mimeType:"application/pdf",
      base64:pdf.toString("base64"),
    });
    assert.match(uploaded.sha256,/^[0-9a-f]{64}$/);
    const raw=await db.query(
      "SELECT sealed_name,sealed_bytes FROM oliveira_operational_documents WHERE id=$1",
      [uploaded.id]);
    assert.equal(Buffer.from(raw.rows[0].sealed_name).includes(Buffer.from("registro.pdf")),false);
    assert.equal(Buffer.from(raw.rows[0].sealed_bytes).includes(pdf),false);
    assert.equal((await documents.list(users.operator.id,item.id)).length,1);
    assert.equal((await documents.list(users.admin.id,item.id)).length,1);
    await assert.rejects(documents.list(users.other.id,item.id),{status:404});
    const downloaded=await documents.download(users.operator.id,item.id,uploaded.id);
    assert.deepEqual(Buffer.from(downloaded.base64,"base64"),pdf);
    assert.equal(downloaded.name,"registro.pdf");
    await assert.rejects(documents.download(users.other.id,item.id,uploaded.id),{status:404});
    assert.deepEqual(await documents.remove(users.operator.id,item.id,uploaded.id),{deleted:true});
    assert.equal((await documents.list(users.operator.id,item.id)).length,0);
    const audit=await db.query(
      "SELECT action FROM oliveira_document_access_log ORDER BY at,id");
    assert.deepEqual(audit.rows.map(r=>r.action).sort(),["deleted","downloaded","uploaded"]);
  }finally{await db.close();}
});
test("malware scan failures and invalid signatures never persist bytes",async()=>{
  const {db,users,cases,item}=await context();
  try {
    for(const scanner of [
      {scan:async()=>({clean:false,engineVerified:true})},
      {scan:async()=>{throw Error("Scanner offline, private data");}},
      {scan:async()=>({clean:true,engineVerified:false})},
    ]) {
      const documents=new OperationalDocuments({
        database:db,encryptionKey:key,cases,scanner,
      });
      await assert.rejects(documents.upload(users.operator.id,{
        caseId:item.id,name:"documento.pdf",mimeType:"application/pdf",
        base64:pdf.toString("base64"),
      }));
    }
    await assert.rejects(new OperationalDocuments({
      database:db,encryptionKey:key,cases,scanner:{scan:async()=>({clean:true,engineVerified:true})},
    }).upload(users.operator.id,{
      caseId:item.id,name:"../filename.pdf",mimeType:"application/pdf",
      base64:pdf.toString("base64"),
    }),{status:422});
    const rows=await db.query("SELECT count(*)::int AS total FROM oliveira_operational_documents");
    assert.equal(rows.rows[0].total,0);
  }finally{await db.close();}
});
test("document HTTP never allows anonymous or unreviewed upload",async()=>{
  const {db,users,documents,item}=await context();
  try {
    const token="A".repeat(43);
    const handler=createOperationalHttp({
      allowedOrigin:"https://ops.example.test",
      networkIdentity:()=> "test",
      accounts:{getSession:async value=>value===token
        ? {id:users.operator.id,role:"operator"} : null,revoke:async()=>{}},
      authentication:{login:async()=>({authenticated:false})},
      documents,
    });
    const call=async(op,{method="GET",body,cookie=true,params="",origin="https://ops.example.test"}={})=>
      handler(new Request("https://ops.example.test/api/operacional?op="+op+params,{
        method,
        headers:{
          ...(method==="POST"?{origin,"content-type":"application/json"}:{}),
          ...(cookie?{cookie:"__Host-oliveira-ops="+token}:{})
        },
        ...(body?{body:JSON.stringify(body)}:{}),
      }));
    assert.equal((await call("doc-list",{cookie:false,params:"&caseId="+item.id})).status,401);
    assert.equal((await call("doc-list",{params:"&caseId="+item.id})).status,200);
    assert.equal((await call("doc-upload",{method:"POST",body:{
      caseId:item.id,name:"file.pdf",mimeType:"application/pdf",base64:pdf.toString("base64"),
      isAdmin:true,
    }})).status,422);
    assert.equal((await call("doc-upload",{method:"POST",body:{
      caseId:item.id,name:"file.pdf",mimeType:"application/pdf",base64:pdf.toString("base64"),
    },origin:"https://evil.example.test"})).status,403);
    assert.equal((await call("doc-upload",{method:"POST",body:{
      caseId:item.id,name:"file.pdf",mimeType:"application/pdf",base64:pdf.toString("base64"),
    }})).status,201);
  }finally{await db.close();}
});
