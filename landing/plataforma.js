"use strict";
const $ = (s) => document.querySelector(s),
  e = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let state,
  csrf,
  config,
  view = "overview",
  selected = null,
  step = 1,
  draft = {},
  priceResult = null;
const staff = () => state && state.user.role !== "customer";
const label = (text, name, type = "text", value = "", extra = "") =>
  `<label>${e(text)}<input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
const option = (value, text, selectedValue) =>
  `<option value="${e(value)}" ${value === selectedValue ? "selected" : ""}>${e(text)}</option>`;
const select = (title, name, options) =>
  `<label>${e(title)}<select name="${name}">${options}</select></label>`;
const status = (s) => e(s.replaceAll("_", " "));
const money = (v) =>
  v === null || v === undefined
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(v / 100);
const service = (id) => config.catalog.find((s) => s.id === id);
const caseName = (c) =>
  `${service(c.serviceId)?.name || c.serviceId} · ${service(c.serviceId)?.variants.find((v) => v.id === c.variantId)?.name || ""}`;
const userName = (id) => state.users.find((u) => u.id === id)?.name || "Equipe";
function feedback(message) {
  $("#feedback").textContent = message;
}
async function api(op, body) {
  const r = await fetch(`/api/plataforma?op=${op}`, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body
      ? { "Content-Type": "application/json", "X-Platform-CSRF": csrf || "" }
      : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("A API não está disponível neste endereço.");
  }
  if (!r.ok) throw Error(data.error || "Operação indisponível.");
  return data;
}
async function refresh() {
  const data = await api("state");
  state = data.state;
  csrf = data.csrf;
  render();
}
function render() {
  $("#entry").hidden = !!state;
  $("#workspace").hidden = !state;
  if (!state) return;
  $("#identity").textContent =
    `${state.user.name} · ${state.user.role === "customer" ? "Cliente de teste" : state.user.role === "rodrigo" ? "Administração" : "Atendimento"}`;
  document
    .querySelectorAll("[data-staff]")
    .forEach((el) => (el.hidden = !staff()));
  document
    .querySelectorAll("[data-view]")
    .forEach((el) =>
      el.setAttribute(
        "aria-current",
        el.dataset.view === view ? "page" : "false",
      ),
    );
  const content = $("#content");
  if (view === "overview")
    content.innerHTML = `<article class="card"><p class="eyebrow">ACOMPANHAMENTO</p><h2>Uma visão dos próximos passos</h2><div class="metrics"><div class="metric"><strong>${state.cases.length}</strong><span>Atendimentos</span></div><div class="metric"><strong>${state.cases.reduce((n, c) => n + c.documents.filter((d) => !d.deleted && d.status !== "conferido").length, 0)}</strong><span>Documentos em revisão</span></div><div class="metric"><strong>${state.tasks.filter((t) => t.status === "aberta").length}</strong><span>Tarefas abertas</span></div></div><div class="actions"><button data-view="request">Solicitar análise de teste</button><button class="secondary" data-view="cases">Ver atendimentos</button></div><p>São Paulo é a cobertura operacional indicada. Outras regiões exigem avaliação. A liberação comercial, os preços e as minutas jurídicas continuam pendentes.</p><p class="muted">Nenhum status neste painel representa decisão, emissão ou prazo de órgão oficial.</p></article><div class="grid">${config.catalog.map((s) => `<article class="card"><span class="badge">${s.id.startsWith("IT") ? "Itália" : "Brasil"}</span><h3>${e(s.name)}</h3><p>${e(s.variants[0].scope[0])}</p><p class="small">Sob orçamento · liberação comercial pendente</p><button class="secondary" data-service="${s.id}">Preparar solicitação</button></article>`).join("")}</div>`;
  if (view === "request") renderWizard();
  if (view === "cases") {
    const c = state.cases.find((x) => x.id === selected);
    content.innerHTML = c
      ? renderCase(c)
      : `<article class="card"><div class="row"><h2>Atendimentos</h2><button data-view="request">Nova solicitação</button></div>${state.cases.length ? state.cases.map((c) => `<div class="row card"><div><h3>${e(caseName(c))}</h3><p>${e(userName(c.ownerId))} <span class="badge">${status(c.status)}</span></p><p class="small">${e(c.triage)}</p></div><button data-case="${c.id}" class="secondary">Abrir atendimento</button></div>`).join("") : "<p>Nenhuma solicitação neste espaço. Comece pela análise de teste.</p>"}</article>`;
  }
  if (view === "pricing") renderPricing();
  if (view === "history")
    content.innerHTML = `<article class="card"><h2>Histórico de atendimento</h2><p>Registro cronológico de ações. Os conteúdos dos documentos e as senhas não aparecem aqui.</p><div class="table-wrap"><table><thead><tr><th>Quando</th><th>Ação</th><th>Responsável</th></tr></thead><tbody>${[
      ...state.audit,
    ]
      .reverse()
      .map(
        (a) =>
          `<tr><td>${e(new Date(a.at).toLocaleString("pt-BR"))}</td><td>${e(a.action)}</td><td>${e(userName(a.actor))}</td></tr>`,
      )
      .join("")}</tbody></table></div></article>`;
}
function renderWizard() {
  if (!draft.serviceId) {
    draft = state.draft
      ? structuredClone(state.draft)
      : {
          serviceId: config.catalog[0].id,
          variantId: config.catalog[0].variants[0].id,
          answers: {},
        };
  }
  const s = service(draft.serviceId),
    a = draft.answers || {};
  let fields = "";
  if (step === 1)
    fields =
      select(
        "Serviço",
        "serviceId",
        config.catalog
          .map((x) => option(x.id, x.name, draft.serviceId))
          .join(""),
      ) +
      select(
        "Modalidade",
        "variantId",
        s.variants.map((v) => option(v.id, v.name, draft.variantId)).join(""),
      ) +
      (staff()
        ? select(
            "Cliente de teste",
            "ownerId",
            state.users
              .filter((u) => u.role === "customer")
              .map((u) => option(u.id, u.name, draft.ownerId))
              .join(""),
          )
        : "") +
      "<p>Registro de filhos e IR estão adiados. Passaporte brasileiro permanece candidato e não está disponível para contratação.</p>";
  if (step === 2) {
    fields =
      label(
        "Cidade / estado de residência",
        "region",
        "text",
        a.region,
        'required maxlength="250" placeholder="São Paulo / SP — exemplo sintético"',
      ) +
      label(
        "Consulado / órgão informado",
        "consulate",
        "text",
        a.consulate,
        'maxlength="250"',
      );
    if (s.id === "IT-01")
      fields +=
        select(
          "Situação da cidadania informada",
          "citizenship",
          ["Reconhecida", "Em análise", "Não sei informar"]
            .map((x) => option(x, x, a.citizenship))
            .join(""),
        ) +
        select(
          "Atendimento adulto?",
          "adult",
          ["Sim", "Não — exige avaliação específica"]
            .map((x) => option(x, x, a.adult))
            .join(""),
        ) +
        label(
          "Situação cadastral / AIRE informada",
          "cadastre",
          "text",
          a.cadastre,
          'maxlength="250"',
        );
    if (s.id === "IT-02")
      fields +=
        select(
          "Atualização pretendida",
          "updateType",
          [
            "Inscrição",
            "Endereço",
            "Circunscrição",
            "Outra atualização cadastral",
          ]
            .map((x) => option(x, x, a.updateType))
            .join(""),
        ) +
        "<p>Registro Civil é um procedimento separado de AIRE e de FAST IT.</p>";
    if (s.id === "IT-03")
      fields += label(
        "Dificuldade na plataforma (sem credenciais)",
        "difficulty",
        "text",
        a.difficulty,
        'maxlength="250"',
      );
    if (s.id === "BR-04")
      fields +=
        label(
          "Finalidade da organização",
          "purpose",
          "text",
          a.purpose,
          'maxlength="250"',
        ) +
        `<label>Lista indicativa de itens sintéticos<textarea name="items" maxlength="800">${e(a.items)}</textarea></label>`;
    if (s.id === "IT-08")
      fields += label(
        "Pendência aparente a organizar",
        "difficulty",
        "text",
        a.difficulty,
        'maxlength="250"',
      );
  }
  if (step === 3) {
    const v = s.variants.find((v) => v.id === draft.variantId);
    fields = `<h3>${e(s.name)} · ${e(v.name)}</h3><p>${e(a.region)}</p><h3>Entregas propostas</h3><ul>${v.deliveries.map((t) => `<li>${e(t)}</li>`).join("")}</ul><h3>Limites do atendimento</h3><ul>${v.exclusions.map((t) => `<li>${e(t)}</li>`).join("")}</ul><p>${e(v.period)}</p><p>O envio abre uma triagem de teste. Não é contratação, aprovação comercial ou promessa de resultado.</p><label class="check"><input name="confirm" type="checkbox" required> Conferi o escopo e estou usando apenas informações sintéticas.</label>`;
  }
  $("#content").innerHTML =
    `<article class="card"><p class="steps">ETAPA ${step} DE 3 · ${step === 1 ? "Serviço" : step === 2 ? "Seu contexto" : "Revisão"}</p><h2>Preparar sua solicitação</h2><p class="muted">Rascunho salvo no seu espaço autenticado. Documentos são enviados depois da triagem. Nunca informe senhas ou códigos de portais.</p><form id="wizard">${fields}<div class="actions">${step > 1 ? '<button type="button" class="secondary" id="previous">Voltar</button>' : ""}<button type="submit">${step === 3 ? "Enviar solicitação de teste" : "Continuar"}</button>${step === 2 ? '<button type="button" id="save-draft" class="secondary">Salvar e continuar depois</button>' : ""}</div></form></article>`;
}
function renderCase(c) {
  const inactive = ["encerrado", "cancelado"].includes(c.status),
    disabled = inactive ? "disabled" : "";
  const docs = c.documents
    .map(
      (d) =>
        `<div class="card"><div class="row"><strong>${e(d.name)}</strong><span class="badge">${status(d.status)}</span></div><p class="small break">SHA-256: ${e(d.hash)}</p>${!d.deleted ? `<a href="/api/plataforma?op=download&case=${c.id}&id=${d.id}">Baixar documento de teste</a>` : "<p>Conteúdo eliminado; metadados preservados para auditoria.</p>"}${staff() && !d.deleted && !inactive ? `<form data-op="review"><input type="hidden" name="documentId" value="${d.id}">${select("Resultado da conferência", "result", option("approved", "Aprovar materialmente") + option("correction", "Solicitar correção"))}${label("Observação de conferência", "note", "text", "", 'maxlength="400"')}<button>Registrar conferência</button></form>` : ""}${d.first ? `<p class="small">1ª conferência: ${e(userName(d.first.actor))} · ${e(d.first.result)}</p>` : ""}${d.second ? `<p class="small">2ª conferência: ${e(userName(d.second.actor))} · ${e(d.second.result)}</p>` : ""}${state.user.role === "rodrigo" && !d.deleted ? `<details><summary>Eliminação por política validada</summary><form data-op="disposal"><input type="hidden" name="documentId" value="${d.id}">${label("Política / decisão aplicável", "policy", "text", "", "required")}${label("Justificativa", "reason", "text", "", "required")}<button>Eliminar conteúdo de teste</button></form></details>` : ""}</div>`,
    )
    .join("");
  return `<article class="card"><button class="secondary" id="back-cases">← Todos os atendimentos</button><p class="eyebrow">${e(userName(c.ownerId))}</p><h2>${e(caseName(c))}</h2><span class="badge">${status(c.status)}</span><p>${e(c.triage)}</p><p>Execução: ${e(userName(c.assignedTo))} · Segunda conferência: ${e(userName(c.reviewerId))}</p><p class="small">T0: ${c.t0 ? e(new Date(c.t0).toLocaleDateString("pt-BR")) : "a registrar após aceite e documentos mínimos"} · Janela privada: ${c.days} dias · Rodadas: ${c.rounds || 0} / 2</p>${c.dueAt ? `<p class="small">Fim da preparação / janela: ${e(new Date(c.dueAt).toLocaleDateString("pt-BR"))} ${Date.parse(c.dueAt) < Date.now() ? "· Revisar vencimento com responsável" : ""}</p>` : ""}${c.followUntil ? `<p>Acompanhamento privado até ${e(new Date(c.followUntil).toLocaleDateString("pt-BR"))}</p>` : ""}<p class="muted">Prazos privados de teste; não são prazos oficiais. Nenhum serviço foi comercialmente liberado por esta tela.</p>${c.closure ? `<p>Encerramento: ${e(c.closure)}</p>` : ""}</article>
 ${staff() && !inactive ? `<div class="split"><article class="card"><h3>Estado do atendimento</h3><form data-op="case-status">${select("Novo estado", "status", ["triagem", "aguardando_documentos", "conferencia", "pendencias", "preparado", "acompanhamento", "pausado", "encerrado", "cancelado"].map((x) => option(x, x.replaceAll("_", " "), c.status)).join(""))}<label>Entregas, pendências e próximos passos<textarea name="note" maxlength="800"></textarea></label><button>Atualizar estado</button></form></article><article class="card"><h3>Marcos e revisões</h3><form data-op="operations"><label class="check"><input type="checkbox" name="scopeAccepted"> Aceite do escopo de teste registrado</label><label class="check"><input type="checkbox" name="minimumReceived"> Dados e documentos mínimos recebidos</label>${c.serviceId === "IT-02" ? label("Protocolo completo informado pelo titular", "protocolDate", "date") : ""}${c.variantId === "documental-completo" ? label("Último protocolo do lote inicial autorizado", "externalBatchDate", "date") : ""}<label class="check"><input type="checkbox" name="round"> Registrar rodada de complemento</label><label class="check"><input type="checkbox" name="companyError"> Correção de erro da Oliveira (não consome rodada)</label>${label("Descrição do marco / rodada", "note", "text", "", 'maxlength="400"')}<button>Registrar marco</button></form></article></div>` : ""}
 <article class="card"><h3>Documentos e pendências</h3><p>Conferência material em duas etapas. Não certifica autenticidade, validade jurídica ou deferimento.</p><ul>${c.requirements.map((r) => `<li>${e(r.label)} · ${c.documents.some((d) => d.requirementId === r.id && !d.deleted && d.second?.result === "approved") ? "Conferido em duas etapas" : "Pendente"}</li>`).join("") || "<li>Nenhuma exigência registrada; a equipe define o checklist após triagem.</li>"}</ul>${staff() && !inactive ? `<form data-op="requirement">${label("Adicionar pendência ao checklist", "label", "text", "", 'required maxlength="100"')}<button class="secondary">Adicionar pendência</button></form>` : ""}${!inactive ? `<details><summary>Enviar arquivo sintético</summary><p><a href="/api/plataforma?op=fixture" download>Baixar arquivo de teste permitido</a>. O servidor recusa qualquer outro conteúdo.</p><form id="upload">${select("Vincular à pendência", "requirementId", option("", "Sem vínculo") + c.requirements.map((r) => option(r.id, r.label)).join(""))}<label>Arquivo de teste<input type="file" name="file" required accept=".txt,text/plain"></label><button>Enviar para conferência</button></form></details>` : ""}${docs}</article>
 <div class="split"><article class="card"><h3>Contato e autorizações</h3>${!inactive ? `<form data-op="case-note">${label("Mensagem sintética no histórico do caso", "note", "text", "", 'required maxlength="400"')}<label class="check"><input type="checkbox" name="requestHuman"> Solicitar revisão humana</label><button class="secondary">Registrar mensagem no caso</button></form>` : ""}${(c.responses || []).map((r) => `<p class="small">${e(userName(r.actor))}: ${e(r.text)}</p>`).join("")}${!inactive ? `<form data-op="case-save"><label class="check"><input type="checkbox" name="optIn" ${c.optIn ? "checked" : ""}> Autorizar sugestões de acompanhamento neste teste</label><button class="secondary">Salvar preferência</button></form><form data-op="authorization">${label("Finalidade da autorização proposta", "purpose", "text", "", 'required maxlength="180"')}${label("Destinatário / órgão", "recipient", "text", "", 'required maxlength="100"')}<button class="secondary">Registrar para revisão</button></form>` : ""}<p class="muted">Um registro não substitui procuração, consentimento válido ou permissão do órgão.</p><ul>${c.authorizations.map((a) => `<li>${e(a.purpose)} · ${e(a.recipient)} · validação oficial pendente</li>`).join("")}</ul></article><article class="card"><h3>Próximos passos</h3>${
   staff() && !inactive
     ? `<form data-op="task-create">${label("Tarefa para a equipe", "title", "text", "", 'required maxlength="120"')}${select(
         "Responsável",
         "assignedTo",
         state.users
           .filter((u) => u.role !== "customer")
           .map((u) => option(u.id, u.name, c.assignedTo))
           .join(""),
       )}${label("Data limite interna", "dueAt", "date")}<button>Adicionar tarefa</button></form><div class="actions"><button data-action="agent" class="secondary">Gerar sugestão de follow-up</button></div><p class="muted">Motor de regras local, sem LLM. Deduplicação por janela. Revisão humana obrigatória; nenhum envio.</p>`
     : ""
 }${
   state.tasks
     .filter((t) => t.caseId === c.id)
     .map(
       (t) =>
         `<div class="card"><strong>${e(t.title)}</strong><p>${e(userName(t.assignedTo))} · ${status(t.status)}</p>${t.message ? `<p>${e(t.message)}</p><span class="badge">Sugestão não enviada</span>` : ""}${staff() && !inactive ? `<form data-op="task-update"><input type="hidden" name="taskId" value="${t.id}">${select("Estado da tarefa", "status", ["aberta", "concluida", "pausada"].map((x) => option(x, x, t.status)).join(""))}<button class="secondary">Atualizar tarefa</button></form>` : ""}</div>`,
     )
     .join("") || "<p>Nenhuma tarefa visível.</p>"
 }</article></div>
 <article class="card"><h3>Minutas e assinatura simulada</h3><p>Modelo por serviço, com versão e hash. Revisão jurídica pendente. Nenhum convite externo é enviado.</p>${!inactive ? '<button data-action="contract-create">Gerar minuta de teste em PDF</button>' : ""}${c.contracts.map((x) => `<div class="card"><span class="badge">${status(x.status)}</span><p class="small break">Versão: ${e(x.templateVersion)}<br>Hash: ${e(x.hash)}</p><a href="/api/plataforma?op=contract-pdf&case=${c.id}&id=${x.id}" target="_blank" rel="noopener">Baixar PDF da minuta simulada</a>${!inactive ? `<form data-op="contract-action"><input type="hidden" name="contractId" value="${x.id}"><input type="hidden" name="hash" value="${x.hash}">${select("Ação simulada", "action", option("invite", "Preparar convite interno") + (state.user.id === c.ownerId ? option("sign", "Simular minha assinatura") : "") + option("cancel", "Cancelar simulação") + (staff() ? option("fail", "Simular falha") : ""))}<button class="secondary">Executar no simulador</button></form>` : ""}</div>`).join("")}</article>
 ${staff() ? `<article class="card"><h3>Pagamentos de teste</h3><p>Sem checkout ou cobrança real. O valor manual abaixo é exclusivamente de teste, não aprova preço.</p>${!inactive ? `<form data-op="payment" class="split">${select("Método simulado", "method", option("pix", "PIX") + option("card", "Cartão"))}${label("Valor sintético em centavos", "amount", "number", "", 'required min="1" max="100000000"')}${label("Chave idempotente (mínimo 12 caracteres)", "idempotencyKey", "text", "", 'required minlength="12" maxlength="100"')}${select("Estado a simular", "action", option("create", "Criar simulação") + option("paid", "Confirmar pagamento simulado") + option("failed", "Simular falha") + option("cancel", "Cancelar simulação"))}<button>Executar simulação</button></form>` : ""}${c.payments.map((p) => `<p>${e(p.method.toUpperCase())} · ${money(p.amountCents)} · ${status(p.status)} · <code>${e(p.key)}</code></p>`).join("")}</article>` : ""}`;
}
function renderPricing() {
  if (!staff()) return;
  const id = $("#price-row")?.value || state.pricing[0].id,
    row = state.pricing.find((r) => r.id === id),
    v = row.costs;
  const fields = [
    ["operating", "Custo operacional direto"],
    ["hours", "Horas estimadas"],
    ["hourRate", "Custo por hora"],
    ["partner", "Parceiros variáveis"],
    ["otherVariable", "Outros custos variáveis"],
    ["taxPercent", "Tributos (%)"],
    ["gatewayPercent", "Taxa do meio de pagamento (%)"],
    ["gatewayFixed", "Taxa fixa do meio de pagamento"],
    ["price", "Preço privado a simular"],
    ["targetMargin", "Margem de contribuição alvo (%)"],
    ["installments", "Número de parcelas (1–12)"],
    ["financePercent", "Acréscimo total informado (%)"],
    ["officialFees", "Taxas oficiais separadas"],
    ["externalClientPaid", "Despesas externas pagas pelo cliente"],
  ];
  $("#content").innerHTML =
    `<article class="card"><p class="eyebrow">RESTRITO À EQUIPE</p><h2>Precificação e modalidades</h2><p>20 linhas do modelo existente. Nenhum preço é público ou aprovado. Campo vazio permanece desconhecido; informe zero somente quando apurado.</p>${select("Serviço e modalidade", "price-row", state.pricing.map((r) => option(r.id, `${r.name} · ${r.modality}`, id)).join("")).replace('name="price-row"', 'name="price-row" id="price-row"')}<form id="pricing"><input type="hidden" name="id" value="${e(id)}">${select("Base de custo operacional", "costMode", option("direct", "Custo direto", v.costMode) + option("hours", "Horas × custo-hora", v.costMode))}<div class="split">${fields.map(([name, title]) => label(title, name, "text", v[name] ?? "", 'inputmode="decimal"')).join("")}</div><p class="muted">Escolha uma base: custo direto ou horas. Não preencha as duas. Taxas oficiais e despesas do cliente ficam fora da margem. O acréscimo informado não é taxa real de adquirente nem CET.</p>${label("Acompanhamento proposto (revisão comercial)", "period", "text", row.terms?.period || "", 'maxlength="600"')}${label("Serviços adicionais para avaliar (não incluídos automaticamente)", "additional", "text", row.terms?.additional || "", 'maxlength="600"')}<div class="actions"><button type="submit">Calcular e salvar rascunho</button></div></form><div id="price-result" role="status">${priceResult || ""}</div><p class="small">Rascunho v${row.version} · aprovação comercial pendente</p></article>`;
}
function collectWizard() {
  const form = $("#wizard");
  if (!form) return;
  const fields = Object.fromEntries(new FormData(form));
  if (step === 1) {
    draft = { ...draft, ...fields, answers: draft.answers || {} };
    if (
      !service(draft.serviceId).variants.some((v) => v.id === draft.variantId)
    )
      draft.variantId = service(draft.serviceId).variants[0].id;
  } else if (step === 2) draft.answers = { ...draft.answers, ...fields };
}
async function saveDraft() {
  await api("draft-save", {
    serviceId: draft.serviceId,
    variantId: draft.variantId,
    answers: draft.answers || {},
  });
  feedback("Rascunho salvo no seu espaço autenticado.");
}
async function operation(op, body) {
  await api(op, { caseId: selected, ...body });
  await refresh();
  feedback(
    "Registro salvo no ambiente de teste. Nenhuma operação real foi ativada.",
  );
}
document.addEventListener("click", async (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.view) {
      view = b.dataset.view;
      if (view === "cases") selected = null;
      render();
    }
    if (b.dataset.service) {
      draft = {
        serviceId: b.dataset.service,
        variantId: service(b.dataset.service).variants[0].id,
        answers: {},
      };
      step = 1;
      view = "request";
      render();
    }
    if (b.dataset.case) {
      selected = b.dataset.case;
      view = "cases";
      render();
    }
    if (b.id === "back-cases") {
      selected = null;
      render();
    }
    if (b.id === "previous") {
      collectWizard();
      step--;
      render();
    }
    if (b.id === "save-draft") {
      collectWizard();
      await saveDraft();
    }
    if (b.id === "hide-credentials") {
      $("#credentials").hidden = true;
      $("#credential-data").replaceChildren();
    }
    if (b.id === "logout") {
      await api("logout", {});
      state = null;
      csrf = null;
      $("#credentials").hidden = true;
      $("#credential-data").replaceChildren();
      render();
      feedback("Sessão encerrada.");
    }
    if (b.dataset.action) {
      b.disabled = true;
      await operation(b.dataset.action, {});
    }
  } catch (err) {
    feedback(err.message);
  } finally {
    b.disabled = false;
  }
});
document.addEventListener("change", (event) => {
  if (event.target.name === "serviceId") {
    collectWizard();
    draft.variantId = service(draft.serviceId).variants[0].id;
    renderWizard();
  }
  if (event.target.id === "price-row") {
    priceResult = null;
    renderPricing();
  }
});
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target,
    button = form.querySelector('button[type="submit"],button:not([type])');
  if (button) button.disabled = true;
  try {
    const body = Object.fromEntries(new FormData(form));
    if (form.getAttribute("id") === "demo") {
      const data = await api("demo", {
        acknowledge: form.elements.ack.checked,
      });
      state = data.state;
      csrf = data.csrf;
      $("#credentials").hidden = false;
      $("#credential-data").innerHTML =
        `<p class="break">Espace : <code>${e(data.workspace)}</code></p><div class="table-wrap"><table><thead><tr><th>Utilisateur</th><th>Senha individual</th></tr></thead><tbody>${data.credentials.map((c) => `<tr><td>${e(c.username)}</td><td><code>${e(c.password)}</code></td></tr>`).join("")}</tbody></table></div>`
          .replace("Espace :", "Espaço:")
          .replace("Utilisateur", "Usuário");
      render();
      feedback(
        "Demonstração criada. Guarde os acessos antes de trocar de usuário.",
      );
    } else if (form.getAttribute("id") === "login") {
      const data = await api("login", body);
      state = data.state;
      csrf = data.csrf;
      view = location.pathname.includes("solicitar") ? "request" : "overview";
      draft = {};
      render();
      form.reset();
      feedback("Acesso autenticado.");
    } else if (form.getAttribute("id") === "wizard") {
      collectWizard();
      if (step < 3) {
        await saveDraft();
        step++;
        renderWizard();
      } else {
        const payload = {
          serviceId: draft.serviceId,
          variantId: draft.variantId,
          answers: draft.answers,
        };
        if (staff()) payload.ownerId = draft.ownerId;
        const data = await api("case-create", payload);
        selected = data.id;
        draft = {};
        step = 1;
        view = "cases";
        await refresh();
        feedback("Solicitação sintética registrada para triagem.");
      }
    } else if (form.getAttribute("id") === "upload") {
      const file = form.elements.file.files[0];
      if (!file || file.size > 90000)
        throw Error("Escolha o arquivo de teste (máximo 90 KB).");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = "";
      for (const byte of bytes) raw += String.fromCharCode(byte);
      await operation("upload", {
        name: file.name,
        content: btoa(raw),
        requirementId: body.requirementId || null,
      });
    } else if (form.getAttribute("id") === "pricing") {
      const costs = { ...body };
      delete costs.id;
      delete costs.period;
      delete costs.additional;
      const data = await api("pricing", {
          id: body.id,
          costs,
          terms: { period: body.period, additional: body.additional },
          save: true,
        }),
        c = data.calculation;
      priceResult = `<h3>Resultado interno</h3><p>${c.complete ? "Custos informados para esta simulação." : "Faltam custos: " + e(c.missing.join(", "))}</p><p>Contribuição: ${money(c.contributionCents)} · Margem: ${c.contributionPercent === null ? "Não calculada" : e(c.contributionPercent.toFixed(2)) + "%"}</p><p>Preço para margem alvo: ${money(c.suggestedPriceCents)}</p><p>Parcelas: ${c.installmentsCents ? c.installmentsCents.map(money).join(" + ") : "Informe preço, parcelas e acréscimo total apurado."}</p><p class="muted">${e(c.note)}</p>`;
      await refresh();
      feedback("Simulação salva como rascunho; não é preço aprovado.");
    } else if (form.dataset.op) {
      if (form.dataset.op === "case-note")
        body.requestHuman = form.elements.requestHuman.checked;
      if (form.dataset.op === "case-save")
        body.optIn = form.elements.optIn.checked;
      if (form.dataset.op === "operations") {
        for (const key of [
          "scopeAccepted",
          "minimumReceived",
          "round",
          "companyError",
        ])
          body[key] = form.elements[key].checked;
        for (const key of ["protocolDate", "externalBatchDate"])
          if (body[key] === "") delete body[key];
      }
      if (form.dataset.op === "payment") body.amount = Number(body.amount);
      await operation(form.dataset.op, body);
    }
  } catch (err) {
    feedback(err.message);
  } finally {
    if (button) button.disabled = false;
  }
});
(async () => {
  try {
    config = await api("config");
    $("#environment").textContent =
      config.note + " Contratos, cobranças e mensagens reais desativados.";
    try {
      const data = await api("session");
      if (data.authenticated) {
        state = data.state;
        csrf = data.csrf;
      }
      render();
    } catch {
      render();
    }
  } catch (err) {
    $("#environment").textContent =
      "Este ambiente de teste está indisponível. O site público continua acessível.";
    feedback(err.message);
    document
      .querySelectorAll("#entry button")
      .forEach((b) => (b.disabled = true));
  }
})();
