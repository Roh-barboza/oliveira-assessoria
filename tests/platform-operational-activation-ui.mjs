import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { browserExecutablePath } from "../scripts/browser-path.mjs";

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve,reject) =>
    listener.once("error",reject).listen(0,"127.0.0.1",resolve));
  const port = listener.address().port;
  await new Promise((resolve)=>listener.close(resolve));
  return port;
}
const port=await freePort();
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,["scripts/serve.mjs"],{
  cwd:process.cwd(),env:{...process.env,PORT:String(port)},
  stdio:["ignore","pipe","pipe"],
});
let browser;
try {
  for(let i=0;i<80;i++) {
    try {
      if((await fetch(base+"/ativacao.html")).status===200)break;
    }catch{}
    if(server.exitCode!==null)throw new Error("Static test server stopped.");
    if(i===79)throw new Error("Static test server did not start.");
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch({executablePath:browserExecutablePath(),args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:850}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));

  await page.goto(base+"/ativacao.html");
  await page.locator("#unavailable").waitFor({state:"visible"});
  assert.equal(await page.locator("#start-panel").isVisible(),false);

  const calls=[];
  const otpSecret="JBSWY3DPEHPK3PXPJBSWY3DP";
  await page.route("**/api/operacional-bootstrap**",async(route)=>{
    const req=route.request();
    const op=new URL(req.url()).searchParams.get("op");
    const body=req.method()==="POST"?req.postDataJSON():null;
    calls.push({op,body});
    const payload=op==="start"?{email:"owner@example.test",totpSecret:otpSecret}:
      op==="confirm"?{activated:true}:{available:true};
    await route.fulfill({status:op==="start"?201:200,
      contentType:"application/json",body:JSON.stringify(payload)});
  });
  await page.reload();
  await page.locator("#start-panel").waitFor({state:"visible"});
  await page.locator("#setup-code").fill("K".repeat(64));
  await page.locator("#name").fill("Admin sintético");
  await page.locator("#email").fill("owner@example.test");
  await page.locator("#password").fill("A-one-time-synthetic-password-123");
  await page.locator("#start-form button").click();
  await page.locator("#verify-panel").waitFor({state:"visible"});
  assert.equal(await page.locator("#password").inputValue(),"");
  assert.equal(await page.locator("#totp-secret").textContent(),otpSecret);
  await page.locator("#otp-code").fill("123456");
  await page.locator("#verify-form button").click();
  await page.locator("#done-panel").waitFor({state:"visible"});
  assert.equal(await page.locator("#totp-secret").textContent(),"");
  assert.equal(await page.locator("#setup-code").inputValue(),"");
  assert.equal(calls.filter(x=>x.op==="start").length,1);
  assert.equal(calls.filter(x=>x.op==="confirm").length,1);
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);

  const accessibility=await new AxeBuilder({page}).analyze();
  assert.deepEqual(accessibility.violations.map(x=>x.id),[]);
  for(const width of [390,768,1366]){
    await page.setViewportSize({width,height:820});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  }
  assert.deepEqual(errors,[]);
  console.log("ATIVAÇÃO: indisponibilidade segura, primeiro cadastro, MFA, limpeza de credenciais, responsividade e acessibilidade aprovados.");
}finally{
  if(browser)await browser.close();
  server.kill();
}
