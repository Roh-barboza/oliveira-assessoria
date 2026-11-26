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
  let config = null, selected = null, busy = false, connectionOk = false;
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
      "Contrato de teste: "+selected.id+" · Versão "+selected.version +
      (selected.envelopeId ? " · Envelope Clicksign: "+selected.envelopeId : "");
    $("contract-status").textContent=STATUS[currentStatus()]||"Estado não identificado";
    $("preview-pdf").disabled=busy;
    $("approve").hidden=currentStatus()!=="draft";
    $("approve").disabled=busy;
    $("send").hidden=currentStatus()!=="approved";
    $("send").disabled=busy || !config?.sandboxConfigured || !connectionOk;
    $("refresh").hidden=currentStatus()!=="awaiting_signature";
    $("refresh").disabled=busy || !config?.sandboxConfigured;
    $("signed-pdf").hidden=currentStatus()!=="signed";
    $("signed-pdf").disabled=busy;
    const note = !config?.sandboxConfigured ?
      "O Sandbox ainda não está configurado para enviar convites de teste por e-mail." :
      currentStatus()==="approved" ?
      "Envio somente para o e-mail de teste autorizado: "+config.testRecipient : "";
    const lastStage=selected.stage||"não informada";
    const extra=lastStage.includes("notificar_signatario:http_503") ?
      " A API pode exigir liberação da função de notificação na conta Clicksign." :
      lastStage.includes("http_401") ?
      " A Clicksign não aceitou a credencial utilizada nessa etapa." :
      lastStage.includes("http_422") ?
      " A Clicksign recusou os dados ou o estado do envelope." : "";
    $("send-note").textContent=currentStatus()==="manual_review" ?
      "O convite NÃO foi confirmado. Última etapa: "+lastStage+"."+extra+
      " Verifique o envelope existente na Clicksign antes de qualquer novo envio." : note;
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
    connectionOk=false;
    toggle("install",!config.installed);
    $("sandbox-status").textContent=!config.installed ?
      "Estrutura de contratos de demonstração ainda não preparada." :
      config.sandboxConfigured ?
      "Sandbox configurado. Clique em Verificar conexão para confirmar o acesso à API da Clicksign." :
      "Minutas e revisões liberadas. A assinatura por e-mail aguarda conexão com a conta Sandbox.";
    updateControls();
  }
  const connectionMessages = Object.freeze({
    authenticated:"Token aceito pela Clicksign. Isso NÃO confirma liberação de notificações por e-mail.",
    http_401:"Falha de autenticação (401). A Clicksign recusou a credencial atual. Nenhum convite foi enviado por esta verificação.",
    http_403:"Clicksign recusou a consulta. Verifique as permissões e o e-mail associado ao token.",
    http_404:"API de consulta não encontrada. Verifique a versão da integração com a Clicksign.",
    http_422:"Clicksign recusou os parâmetros da consulta. A autenticação ainda não foi confirmada.",
    http_429:"Limite de solicitações atingido na Clicksign. Não repita o envio.",
    http_500:"A Clicksign retornou erro interno.",
    http_503:"O serviço da Clicksign está indisponível ou sua conta não tem liberação necessária.",
    network_error:"Não foi possível alcançar a Clicksign Sandbox.",
    not_configured:"Token ou autorização Sandbox não configurado na Vercel.",
    invalid_token_format:"A credencial cadastrada não tem o formato de Access Token da API v3. É necessário um UUID com 36 caracteres e hífens, copiado de Configurações → API no Sandbox. Nenhum envio foi realizado.",
  });
  async function checkConnection() {
    const {check}=await request("contract-connection");
    connectionOk=check?.reachable === true && check?.code === "authenticated";
    const code=String(check?.code||"desconhecido");
    const indicator=$("connection-indicator");
    const result=$("connection-result");
    indicator.dataset.state=connectionOk?"success":"error";
    indicator.textContent=connectionOk?"Conexão validada":"Conexão não validada";
    result.textContent=connectionMessages[code] ||
      "Conexão Clicksign não confirmada. Código: "+code;
    result.dataset.state=connectionOk?"success":"error";
    result.hidden=false;
    $("connection-help").hidden=!["http_401","invalid_token_format"].includes(code);
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
    a.href=url;a.download=pdfDocument.filename||"pincio-minuta-teste.pdf";
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
      const contractId=params.get("contractId")||"";
      if (config.installed && validCaseId(contractId)) {
        const {contract}=await request("contract-get",{params:{id:contractId}});
        if (!contract || !validCaseId(contract.caseId))
          throw Error("Minuta não encontrada.");
        $("case-id").value=contract.caseId;
        selected=contract;
        await reloadContracts(contract.id);
      } else if (config.installed && validCaseId(caseId())) {
        await reloadContracts();
      }
    } catch {
      toggle("blocked",true);toggle("workspace",false);
      $("environment").textContent="Serviço indisponível";
    }
  }
  $("check-connection").addEventListener("click",()=>perform(checkConnection));
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
    if (!selected || !config?.sandboxConfigured || !connectionOk ||
        !confirm("Enviar convite de TESTE Clicksign exclusivamente para "+
          config.testRecipient+"? O envio não pode ser desfeito automaticamente."))return;
    perform(async()=>{
      const id=selected.id;
      try {
        const updated=await request("contract-send",{data:{
          id,version:selected.version,confirm:"ENVIAR_TESTE_SANDBOX",
        }});
        selected=updated.contract;
      } catch(error) {
        // A partial remote failure transitions the row to manual_review.
        // Fetch the current state instead of leaving a stale "Send" button.
        try { await reloadContracts(id); } catch {}
        throw error;
      }
      await reloadContracts(id);
    },"A Clicksign aceitou a solicitação de convite. Consulte a assinatura no painel.");
  });
  $("refresh").addEventListener("click",()=>perform(async()=>{
    const updated=await request("contract-refresh",{data:{id:selected.id}});
    selected=updated.contract;await reloadContracts(selected.id);
  },"Consulta do status realizada."));
  initial();
})();
