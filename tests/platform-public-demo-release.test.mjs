import test from "node:test";
import assert from "node:assert/strict";

test("public production release exposes full synthetic-only demo, not real data",async()=>{
  const keys=["VERCEL_ENV","VERCEL_PROJECT_ID","VERCEL_GIT_COMMIT_REF",
    "OLIVEIRA_PLATFORM_PREVIEW_ACK","OLIVEIRA_PLATFORM_STORE"];
  const old=new Map(keys.map(k=>[k,process.env[k]]));
  try {
    process.env.VERCEL_ENV="production";
    process.env.VERCEL_PROJECT_ID="prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
    process.env.VERCEL_GIT_COMMIT_REF="release/pincio-sem-n8n-2026-11-28";
    const app=(await import("../api/plataforma.mjs?full-public-release")).default;
    const home="https://pincio-assessoria.vercel.app/api/plataforma?op=";
    const config=await app.fetch(new Request(home+"config"));
    assert.equal(config.status,200);
    const configuration=await config.json();
    assert.equal(configuration.mode,"synthetic-only");
    assert.equal(configuration.storage,"temporario");
    assert.equal(configuration.realTransactions,false);
    const created=await app.fetch(new Request(home+"demo",{
      method:"POST",
      headers:{"origin":"https://pincio-assessoria.vercel.app",
        "content-type":"application/json"},
      body:JSON.stringify({acknowledge:true}),
    }));
    assert.equal(created.status,201);
    const data=await created.json();
    assert.equal(data.credentials.length,4);
    assert.match(data.notice,/demonstração/);
    assert.equal((await app.fetch(new Request(home+"session"))).status,200);
    const cookie=created.headers.get("set-cookie").split(";")[0];
    const session=await app.fetch(new Request(home+"session",{headers:{cookie}}));
    assert.equal(session.status,200);
    assert.equal((await session.json()).authenticated,true);
  }finally{
    for(const [key,value] of old){if(value===undefined)delete process.env[key];
      else process.env[key]=value;}
  }
});
test("no synthetic simulator on unapproved production branch",async()=>{
  const keys=["VERCEL_ENV","VERCEL_PROJECT_ID","VERCEL_GIT_COMMIT_REF"];
  const old=new Map(keys.map(k=>[k,process.env[k]]));
  try {
    process.env.VERCEL_ENV="production";
    process.env.VERCEL_PROJECT_ID="prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
    process.env.VERCEL_GIT_COMMIT_REF="main";
    const app=(await import("../api/plataforma.mjs?unapproved-full-release")).default;
    assert.equal((await app.fetch(new Request(
      "https://pincio-assessoria.vercel.app/api/plataforma?op=config"))).status,404);
  }finally{
    for(const [key,value] of old){if(value===undefined)delete process.env[key];
      else process.env[key]=value;}
  }
});
