"use strict";

// Internal interface only. The backend is deliberately not publicly mounted.
// When /api/operacional is missing, all credentials and case actions stay hidden.
(() => {
  const endpoint = "/api/operacional";
  const statusNames = Object.freeze({
    triagem: "Triagem",
    aguardando_documentos: "Aguardando documentos",
    conferencia: "Conferência",
    pendencias: "Pendências",
    preparado: "Preparado",
    acompanhamento: "Acompanhamento",
    pausado: "Pausado",
    encerrado: "Encerrado",
  });
  const $ = (id) => document.getElementById(id);
  let activeUser = null;
  let selected = null;
  let currentCases = [];
  let busy = false;
  const formatLabel = (value) => statusNames[value] || "Etapa não identificada";
  const setVisible = (id, value) => { $(id).hidden = !value; };
  const feedback = (message, error = false) => {
    const node = $("feedback");
    node.textContent = message;
    node.classList.toggle("error", error);
    node.hidden = !message;
  };
  const environment = (text) => { $("environment").textContent = text; };
  const setBusy = (value) => {
    busy = value;
    for (const button of document.querySelectorAll("#login-form button, #case-form button, #status-form button, #refresh, #logout"))
      button.disabled = value;
  };

  async function request(op, { method = "GET", data, params } = {}) {
    const url = new URL(endpoint, location.origin);
    url.searchParams.set("op", op);
    for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, String(value));
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: data === undefined ? {} : { "Content-Type": "application/json" },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("Serviço operacional indisponível.");
    const body = await response.json();
    if (!response.ok) {
      const message = typeof body?.error === "string" ? body.error : "Operação não concluída.";
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    return body;
  }
  function renderEmpty(message) {
    $("cases-list").replaceChildren();
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = message;
    $("cases-list").append(p);
  }
  function showLogin() {
    activeUser = null;
    selected = null;
    currentCases = [];
    $("login-form").reset();
    setVisible("login-area", true);
    setVisible("unavailable", false);
    setVisible("dashboard", false);
    setVisible("selected-panel", false);
    environment("Acesso restrito");
  }
  function unavailable() {
    activeUser = null;
    selected = null;
    setVisible("unavailable", true);
    setVisible("login-area", false);
    setVisible("dashboard", false);
    setVisible("selected-panel", false);
    environment("Ainda não configurado");
  }
  function showDashboard(user) {
    activeUser = user;
    selected = null;
    setVisible("login-area", false);
    setVisible("unavailable", false);
    setVisible("dashboard", true);
    setVisible("selected-panel", false);
    environment("Sessão autenticada");
    $("account-details").textContent = [user.name, user.role, user.email].filter(Boolean).join(" · ");
    // An operator cannot close a case; the server also enforces the rule.
    const option = $("next-status").querySelector('option[value="encerrado"]');
    if (option) option.disabled = user.role !== "admin";
    if (user.role === "reviewer") $("case-form").hidden = true;
    else $("case-form").hidden = false;
  }
  function caseRow(item) {
    const row = document.createElement("article");
    row.className = "case-item";
    const details = document.createElement("div");
    const badge = document.createElement("span");
    badge.className = "case-status";
    badge.textContent = formatLabel(item.status);
    details.append(badge);
    const heading = document.createElement("strong");
    heading.textContent = String(item.title || "Solicitação");
    details.append(heading);
    const info = document.createElement("p");
    info.textContent = String(item.service || "Serviço não informado");
    details.append(info);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary small";
    button.textContent = "Detalhes";
    button.setAttribute("aria-label", "Detalhes da solicitação: " + String(item.title || "sem título"));
    button.addEventListener("click", () => selectCase(item.id));
    row.append(details, button);
    return row;
  }
  async function refreshCases() {
    if (!activeUser) return;
    const data = await request("case-list", { params: { limit: 50 } });
    if (!Array.isArray(data.cases)) throw new Error("Resposta inesperada do serviço.");
    currentCases = data.cases;
    $("count-total").textContent = String(currentCases.length);
    $("count-triagem").textContent = String(currentCases.filter((c) => c.status === "triagem").length);
    $("count-acompanhamento").textContent = String(currentCases.filter((c) => c.status === "acompanhamento").length);
    $("cases-list").replaceChildren();
    if (!currentCases.length) return renderEmpty("Nenhuma solicitação vinculada à sua conta.");
    for (const item of currentCases) $("cases-list").append(caseRow(item));
    if (selected && !currentCases.some((c) => c.id === selected.id)) {
      selected = null;
      setVisible("selected-panel", false);
    }
  }
  async function selectCase(id) {
    if (busy) return;
    setBusy(true);
    try {
      const data = await request("case-get", { params: { id } });
      if (!data.case || data.case.id !== id) throw new Error("Solicitação não encontrada.");
      selected = data.case;
      const contractLink = $("contracts-case-link");
      contractLink.hidden = activeUser?.role !== "admin";
      contractLink.href = "/contratos.html?caseId=" + encodeURIComponent(selected.id);
      $("selected-case").textContent = [selected.title, selected.service, "Versão " + selected.version].join(" · ");
      $("next-status").value = selected.status;
      setVisible("selected-panel", true);
      $("status-form").hidden = activeUser?.role === "reviewer" || selected.status === "encerrado";
      $("selected-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
      feedback("");
    } catch (error) {
      feedback(error.message || "Não foi possível abrir a solicitação.", true);
    } finally { setBusy(false); }
  }
  async function loadSession() {
    feedback("");
    environment("Verificando ambiente...");
    try {
      const data = await request("session");
      if (typeof data.authenticated !== "boolean") throw new Error("Resposta inesperada.");
      if (data.authenticated && data.user?.id) {
        showDashboard(data.user);
        try { await refreshCases(); }
        catch (error) { feedback(error.message, true); renderEmpty("Não foi possível carregar as solicitações."); }
      } else showLogin();
    } catch {
      unavailable();
    }
  }

  $("retry").addEventListener("click", loadSession);
  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    feedback("");
    try {
      await request("login", { method: "POST", data: {
        email: String(data.email || "").trim(), password: String(data.password || ""), code: String(data.code || ""),
      } });
      form.reset();
      await loadSession();
    } catch (error) {
      // Do not retain or echo passwords or authenticator codes.
      form.elements.password.value = "";
      form.elements.code.value = "";
      feedback(error.status === 429 ?
        "Muitas tentativas de acesso. Aguarde antes de tentar novamente." :
        error.message || "Falha na autenticação.", true);
      if (error.status === 503) unavailable();
    } finally { setBusy(false); }
  });
  $("case-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !activeUser) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      await request("case-create", { method: "POST", data: {
        title: String(data.title || "").trim(),
        service: String(data.service || "").trim(),
        notes: String(data.notes || ""),
      } });
      form.reset();
      feedback("Solicitação registrada.");
      await refreshCases();
    } catch (error) {
      if (error.status === 401) return loadSession();
      feedback(error.message || "Não foi possível registrar a solicitação.", true);
    } finally { setBusy(false); }
  });
  $("status-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !selected) return;
    setBusy(true);
    try {
      const data = await request("case-status", { method: "POST", data: {
        id: selected.id, nextStatus: $("next-status").value, expectedVersion: selected.version,
      } });
      selected = data.case;
      feedback("Etapa atualizada.");
      await refreshCases();
      if (selected) {
        $("selected-case").textContent =
          [selected.title, selected.service, "Versão " + selected.version].join(" · ");
        $("status-form").hidden = activeUser?.role === "reviewer" || selected.status === "encerrado";
      }
    } catch (error) {
      if (error.status === 401) return loadSession();
      feedback(error.status === 409 ? "Esse atendimento foi alterado. Atualize os dados antes de salvar." :
        error.message || "Não foi possível atualizar a etapa.", true);
    } finally { setBusy(false); }
  });
  $("refresh").addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try { await refreshCases(); feedback(""); }
    catch (error) { feedback(error.message || "Não foi possível atualizar.", true); }
    finally { setBusy(false); }
  });
  $("logout").addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try { await request("logout", { method: "POST" }); showLogin(); feedback(""); }
    catch { feedback("Não foi possível encerrar a sessão. Feche o navegador e contate o administrador.", true); }
    finally { setBusy(false); }
  });
  loadSession();
})();
