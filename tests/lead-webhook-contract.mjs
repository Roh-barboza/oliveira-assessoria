import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { chromium } from "playwright";
import { browserExecutablePath } from "../scripts/browser-path.mjs";

const serverPort = async () => {
  const socket = net.createServer();
  await new Promise((resolve,reject) =>
    socket.once("error",reject).listen(0,"127.0.0.1",resolve));
  const port=socket.address().port;
  await new Promise(resolve=>socket.close(resolve));
  return port;
};
const port=await serverPort();
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,["scripts/serve.mjs"],{
  env:{...process.env,PORT:String(port)},cwd:process.cwd(),
  stdio:["ignore","pipe","pipe"],
});
let browser;
try {
  for(let i=0;i<90;i++){
    try{if((await fetch(origin+"/index.html")).status===200)break;}catch{}
    if(server.exitCode!==null||i===89)throw Error("Local site did not start.");
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch({executablePath:browserExecutablePath(),
    args:["--no-sandbox"]});
  const context=await browser.newContext();
  const page=await context.newPage();
  const requests=[];
  let rejectWebhook=false;

  // Intercept 100% of the outbound request; never contact Cloudfy/n8n.
  await page.route("https://chaoticcow-n8n.cloudfy.live/**",async(route)=>{
    const request=route.request();
    const headers={
      "Access-Control-Allow-Origin":origin,
      "Access-Control-Allow-Methods":"POST, OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type",
      "Content-Type":"application/json",
    };
    if(request.method()==="OPTIONS"){
      await route.fulfill({status:204,headers});
      return;
    }
    requests.push({method:request.method(),body:request.postDataJSON()});
    await route.fulfill({
      status:rejectWebhook?503:200,headers,
      body:JSON.stringify({ok:!rejectWebhook}),
    });
  });
  await page.goto(origin+"/index.html",{waitUntil:"domcontentloaded"});
  const form=page.locator("#consular-form");
  await form.locator('[name="nome"]').fill("Contato sintético de teste");
  await form.locator('[name="whatsapp"]').fill("(11) 90000-0000");
  await form.locator('[name="servico"]').selectOption({label:"AIRE"});
  await form.locator('[name="mensagem"]').fill("Somente teste de contrato; não enviar");
  await form.locator('button[type="submit"]').click();
  await page.getByText("Recebemos seus dados. Em breve entraremos em contato.").waitFor();
  assert.equal(requests.length,1);
  assert.equal(requests[0].method,"POST");
  assert.deepEqual(requests[0].body,{
    nome:"Contato sintético de teste",whatsapp:"(11) 90000-0000",
    area:"Assessoria Brasil e Itália",
    mensagem:"[AIRE] Somente teste de contrato; não enviar",
  });
  assert.equal(await form.locator('[name="nome"]').inputValue(),"");

  rejectWebhook=true;
  await form.locator('[name="nome"]').fill("Teste de erro");
  await form.locator('[name="whatsapp"]').fill("(11) 90000-0000");
  await form.locator('[name="servico"]').selectOption({label:"Fast It"});
  await form.locator('button[type="submit"]').click();
  await page.getByText("Não foi possível enviar agora. Tente novamente em instantes.").waitFor();
  assert.equal(requests.length,2);
  assert.equal(await form.locator('[name="nome"]').inputValue(),"Teste de erro");
  assert.equal(await form.locator('button[type="submit"]').isEnabled(),true);
  console.log("LEADS: contrato JSON, serviço, sucesso, erro e ausência de tráfego real ao n8n aprovados.");
}finally{
  if(browser)await browser.close();
  server.kill();
}
