import test from "node:test";
import assert from "node:assert/strict";
import { checkLeadCors } from "../scripts/check-lead-cors.mjs";
test("read-only first-party API probe never submits data",async()=>{
  const result=await checkLeadCors(async(url,opts)=>{
    assert.equal(url,"https://pincio-assessoria.vercel.app/api/leads");
    assert.equal(opts.method,"GET");assert.equal(opts.body,undefined);assert.equal(opts.credentials,"omit");
    return new Response(null,{status:405,headers:{Allow:"POST"}});
  });
  assert.equal(result.status,"passed");assert.equal(result.leadSubmitted,false);assert.equal(result.receiptConfirmed,false);
  assert.equal((await checkLeadCors(async()=>new Response(null,{status:200}))).status,"failed");
  assert.equal((await checkLeadCors(async()=>{throw Error("offline")})).status,"unreachable");
});
