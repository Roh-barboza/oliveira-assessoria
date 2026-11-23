"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const endpoint = "/api/operacional";
  const STATUS = Object.freeze({
    draft:"Minuta fictícia aguardando conferência",
    approved:"Minuta fictícia aprovada para teste",
    sending:"Solicitação enviada ao provedor; acompanhe a conclusão",
    awaiting_signature:"Convite enviado no Sandbox; aguardando assinatura",
    signed:"Assinatura Sandbox concluída",
    cancelled:"Envelope cancelado no Sandbox",
    manual_review:"Verificação manual necessária antes de qualquer novo envio",
  });
  let config = null, selected = null, busy = false;
  const toggle = (id, visible) => { $(id).hidden = !visible; };
  const feedback = (message, error = false) => {
    $("feedback").textContent = message;
    $("feedback").classList.toggle("error",error);
    $("feedback").hidden = !message;
  };
  function spinner(flag) {
    busy = flag;
    for (const b of document.querySelectorAll("button"))
      b.disabled = flag;
    if (!flag) updateControls();
  }
  async function request(op, { data, params } = {}) {
    const url = new URL(endpoint, location.origin);
    url.searchParams.set("op",op);
    for (const [key,value] of Object.entries(params||{}))
      url.searchParams.set(key,String(value));
    const res = await fetch(url, {
      method: data === undefined ? "GET" : "POST",
      credentials:"same-origin",cache:"no-store",
      ...(data === undefined ? {} : {
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data),
      }),
    });
    if (!(res.headers.get("content-type")||"").includes("application/json"))
      throw Error("Serviço operacional indisponível.");
    const payload = await res.json();
    if (!res.ok) {
      const error=new Error(payload?.error || "Operação não concluída.");
      error.status=res.status;
      throw error;
    }
    return payload;
  }
  const validCaseId = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
  const caseId = () => $("case-id").value.trim();
  const currentStatus = () => selected?.status || "";
  function updateControls() {
    const installed = Boolean(config?.installed);
    $("install").hidden=installed;
    $("prepare").disabled=busy || !installed || !validCaseId(caseId());
    $("list").disabled=busy || !installed || !validCaseId(caseId());
    toggle("contract-selected",Boolean(selected));
    if (!selected) return;
    $("contract-identification").textContent =
      "Contrato de teste: "+selected.id+" · Versão "+selected.version;
    $("contract-status").textContent=STATUS[currentStatus()]||"Estado não identificado";
    $("preview-pdf").disabled=busy;
    $("approve").hidden=currentStatus()!=="draft";
    $("approve").disabled=busy;
    $("send").hidden=currentStatus()!=="approved";
    $("send").disabled=busy || !config?.sandboxConnected;
    $("refresh").hidden=currentStatus()!=="awaiting_signature";
    $("refresh").disabled=busy || !config?.sandboxConnected;
    $("signed-pdf").hidden=currentStatus()!=="signed";
    $("signed-pdf").disabled=busy;
    const note = !config?.sandboxConnected ?
      "A chave Clicksign Sandbox ainda não está conectada ou o envio por e-mail está desativado." :
      currentStatus()==="approved" ?
      "Envio somente para o e-mail de teste autorizado: "+config.testRecipient : "";
    $("send-note").textContent=note;
  }
  function renderList(rows) {
    $("contract-items").replaceChildren();
    if (!Array.isArray(rows)) return;
    for (const contract of rows) {
      const item=document.createElement("div");
      item.className="contract-item";
      item.setAttribute("role","listitem");
      const p=document.createElement("p");
      p.textContent=(STATUS[contract.status]||contract.status)+" · "+contract.id;
      const button=document.createElement("button");
      button.className="button secondary small";
      button.type="button";
      button.textContent="Abrir minuta";
      button.addEventListener("click",()=>{
        selected=contract;updateControls();
        $("contract-selected").scrollIntoView({behavior:"smooth",block:"nearest"});
      });
      item.append(p,button);
      $("contract-items").append(item);
    }
  }
  async function reloadContracts(highlightId=null) {
    if (!validCaseId(caseId()))throw Error("Selecione uma solicitação de teste válida.");
    const response=await request("contract-list",{params:{caseId:caseId()}});
    renderList(response.contracts);
    if (highlightId)
      selected=response.contracts.find(c=>c.id===highlightId)||null;
    else if (selected)
      selected=response.contracts.find(c=>c.id===selected.id)||null;
    else selected=response.contracts[0]||null;
    updateControls();
  }
  async function updateConfig() {
    const data=await request("contract-ready");
    config=data.contracts;
    toggle("install",!config.installed);
    $("sandbox-status").textContent=!config.installed ?
      "Estrutura de contratos de demonstração ainda não preparada." :
      config.sandboxConnected ?
      "Sandbox vinculado. Convites permitidos somente para "+config.testRecipient+"." :
      "Minutas e revisões liberadas. A assinatura por e-mail aguarda conexão com a conta Sandbox.";
    updateControls();
  }
  async function perform(fn,success) {
    if (busy)return;
    spinner(true);feedback("");
    try { await fn(); if(success)feedback(success); }
    catch(e) {
      if (e.status===401) {
        toggle("workspace",false);toggle("blocked",true);
      }
      feedback(e.message || "Operação não concluída.",true);
    } finally {spinner(false);}
  }
  async function download(signed) {
    if (!selected)return;
    const {document:pdfDocument}=await request("contract-preview",{params:{
      id:selected.id,signed:signed?"1":"0",
    }});
    if (!pdfDocument?.pdfBase64 || pdfDocument.synthetic!==true)
      throw Error("Documento de teste indisponível.");
    const binary=atob(pdfDocument.pdfBase64);
    if (binary.length>3*1024*1024)throw Error("PDF acima do tamanho autorizado.");
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
    const a=document.createElement("a");
    a.href=url;a.download=pdfDocument.filename||"oliveira-minuta-teste.pdf";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  async function initial() {
    try {
      const session=await request("session");
      if (!session.authenticated || session.user?.role!=="admin") {
        toggle("blocked",true);toggle("workspace",false);
        $("environment").textContent="Acesso administrativo obrigatório";
        return;
      }
      toggle("blocked",false);toggle("workspace",true);
      $("environment").textContent="Administrador autenticado · Sandbox";
      const params=new URLSearchParams(location.search);
      if (validCaseId(params.get("caseId")||""))
        $("case-id").value=params.get("caseId");
      await updateConfig();
      if (config.installed && validCaseId(caseId()))await reloadContracts();
    } catch {
      toggle("blocked",true);toggle("workspace",false);
      $("environment").textContent="Serviço indisponível";
    }
  }
  $("case-id").addEventListener("input",()=>{selected=null;renderList([]);updateControls();});
  $("install").addEventListener("click",()=>perform(async()=>{
    await request("contract-install",{data:{acknowledge:"SANDBOX_SOMENTE"}});
    await updateConfig();
  },"Estrutura de minutas fictícias preparada no Neon."));
  $("list").addEventListener("click",()=>perform(()=>reloadContracts()));
  $("prepare").addEventListener("click",()=>perform(async()=>{
    const created=await request("contract-create",{data:{caseId:caseId()}});
    await reloadContracts(created.contract.id);
  },"Minuta fictícia criada. Baixe o PDF e confira antes de aprovar."));
  $("preview-pdf").addEventListener("click",()=>perform(()=>download(false)));
  $("signed-pdf").addEventListener("click",()=>perform(()=>download(true)));
  $("approve").addEventListener("click",()=>{
    if(!selected || !confirm("Confirma a aprovação somente desta minuta FICTÍCIA de teste?"))return;
    perform(async()=>{
      const updated=await request("contract-approve",{data:{
        id:selected.id,version:selected.version,
      }});
      selected=updated.contract;await reloadContracts(selected.id);
    },"Minuta fictícia aprovada.");
  });
  $("send").addEventListener("click",()=>{
    if (!selected || !config?.sandboxConnected ||
        !confirm("Enviar convite de TESTE Clicksign exclusivamente para "+
          config.testRecipient+"? O envio não pode ser desfeito automaticamente."))return;
    perform(async()=>{
      const updated=await request("contract-send",{data:{
        id:selected.id,version:selected.version,confirm:"ENVIAR_TESTE_SANDBOX",
      }});
      selected=updated.contract;await reloadContracts(selected.id);
    },"Convite solicitado no Sandbox. Confirme o recebimento no e-mail de teste.");
  });
  $("refresh").addEventListener("click",()=>perform(async()=>{
    const updated=await request("contract-refresh",{data:{id:selected.id}});
    selected=updated.contract;await reloadContracts(selected.id);
  },"Consulta do status realizada."));
  initial();
})();
