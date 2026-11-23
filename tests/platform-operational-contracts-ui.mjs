import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { browserExecutablePath } from "../scripts/browser-path.mjs";

async function port() {
  const sock=net.createServer();
  await new Promise((resolve,reject)=>sock.once("error",reject).listen(0,"127.0.0.1",resolve));
  const n=sock.address().port;
  await new Promise(resolve=>sock.close(resolve));
  return n;
}
const n=await port(), origin="http://127.0.0.1:"+n;
const server=spawn(process.execPath,["scripts/serve.mjs"],{
  cwd:process.cwd(),env:{...process.env,PORT:String(n)},stdio:["ignore","pipe","pipe"],
});
const caseId="22222222-2222-4222-8222-222222222222";
const contractId="33333333-3333-4333-8333-333333333333";
let browser;
try {
  for(let i=0;i<80;i++){
    try{if((await fetch(origin+"/contratos.html")).status===200)break;}catch{}
    if(server.exitCode!==null||i===79)throw Error("Static server not started.");
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch({executablePath:browserExecutablePath(),args:["--no-sandbox"]});
  const context=await browser.newContext({viewport:{width:390,height:850},acceptDownloads:true});
  const page=await context.newPage();
  const pageErrors=[];
  page.on("pageerror",err=>pageErrors.push(err.message));
  page.on("dialog",dialog=>dialog.accept());
  let role="operator",installed=false,sandboxConnected=false,contract=null;
  const invoked=[];
  const base64=Buffer.from("%PDF-synthetic-demo").toString("base64");
  await page.route("**/api/operacional?**",async(route)=>{
    const req=route.request(),op=new URL(req.url()).searchParams.get("op");
    const body=req.method()==="POST"?req.postDataJSON():null;
    invoked.push({op,body});
    let result={},status=200;
    if(op==="session")result={authenticated:true,user:{
      id:"11111111-1111-4111-8111-111111111111",name:"Synthetic",email:"admin@example.invalid",role,
    }};
    else if(op==="contract-ready")result={contracts:{
      installed,sandboxConnected,testRecipient:"rodrigo.barboza1994@gmail.com",realContracts:false,
    }};
    else if(op==="contract-connection")result={check:{reachable:sandboxConnected,code:sandboxConnected?"authenticated":"not_configured"}};
    else if(op==="contract-install"){
      assert.equal(body.acknowledge,"SANDBOX_SOMENTE");
      installed=true;result={contracts:{installed,sandboxConnected}};
    } else if(op==="contract-list"){
      result={contracts:contract?[contract]:[]};
    } else if(op==="contract-get"){
      result={contract};
    } else if(op==="contract-create"){
      assert.equal(body.caseId,caseId);
      contract={id:contractId,caseId,status:"draft",version:1,pdfSha256:"a".repeat(64)};
      result={contract};status=201;
    } else if(op==="contract-preview"){
      result={document:{pdfBase64:base64,synthetic:true,filename:"minuta-teste.pdf"}};
    } else if(op==="contract-approve"){
      assert.equal(body.version,1);
      contract={...contract,status:"approved",version:2};
      result={contract};
    } else if(op==="contract-send"){
      assert.equal(body.confirm,"ENVIAR_TESTE_SANDBOX");
      contract={...contract,status:"awaiting_signature",version:4};
      result={contract};
    } else if(op==="contract-refresh"){
      contract={...contract,status:"signed",version:5,signedReady:true};
      result={contract};
    } else { status=404;result={error:"Unknown synthetic route"}; }
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(result)});
  });
  await page.goto(origin+"/contratos.html?caseId="+caseId);
  await page.locator("#blocked").waitFor({state:"visible"});
  assert.equal(await page.locator("#workspace").isVisible(),false);

  role="admin";
  await page.reload();
  await page.locator("#workspace").waitFor({state:"visible"});
  await page.locator("#install").waitFor({state:"visible"});
  await page.locator("#install").click();
  await page.locator("#install").waitFor({state:"hidden"});
  await page.locator("#prepare").click();
  await page.locator("#contract-selected").waitFor({state:"visible"});
  assert.match(await page.locator("#contract-status").textContent(),/aguardando conferência/);
  const download=page.waitForEvent("download");
  await page.locator("#preview-pdf").click();
  const file=await download;
  assert.equal(file.suggestedFilename(),"minuta-teste.pdf");
  await page.locator("#approve").click();
  await page.getByText("Minuta fictícia aprovada para teste",{exact:true}).waitFor();
  assert.equal(await page.locator("#send").isDisabled(),true);
  assert.equal(invoked.some(x=>x.op==="contract-send"),false);

  sandboxConnected=true;
  await page.goto(origin+"/contratos.html?contractId="+contractId);
  await page.locator("#contract-selected").waitFor({state:"visible"});
  assert.equal(await page.locator("#send").isDisabled(),true);
  await page.locator("#check-connection").click();
  await page.getByText(/Token aceito pela Clicksign/).waitFor();
  await page.locator("#send").click();
  await page.getByText("Convite enviado no Sandbox; aguardando assinatura",{exact:true}).waitFor();
  await page.locator("#refresh").click();
  await page.getByText("Assinatura Sandbox concluída",{exact:true}).waitFor();
  assert.equal(await page.locator("#signed-pdf").isVisible(),true);
  const audit=await new AxeBuilder({page}).analyze();
  assert.deepEqual(audit.violations.map(x=>x.id),[]);
  for(const width of [390,768,1366]){
    await page.setViewportSize({width,height:850});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  }
  assert.deepEqual(pageErrors,[]);
  assert.equal(invoked.filter(x=>x.op==="contract-send").length,1);
  console.log("CONTRATOS: admin, preparação, PDF, aprovação, envio bloqueado sem credenciais, assinatura simulada, acessibilidade e responsividade OK.");
}finally{
  if(browser)await browser.close();
  server.kill();
}
