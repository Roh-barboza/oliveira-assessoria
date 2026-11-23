"use strict";

// Never store the activation code, password or TOTP secret in localStorage,
// cookies, query strings, analytics, or console logs.
(() => {
  const $ = (id) => document.getElementById(id);
  const endpoint = "/api/operacional-bootstrap";
  let activeEmail = null;
  let busy = false;

  function show(name) {
    for (const key of ["unavailable", "start-panel", "recover-panel", "verify-panel", "done-panel"])
      $(key).hidden = key !== name;
  }
  function feedback(message, isError = false) {
    const node = $("feedback");
    node.textContent = message;
    node.classList.toggle("error", isError);
    node.hidden = !message;
  }
  function setBusy(value) {
    busy = value;
    for (const button of document.querySelectorAll("button")) button.disabled = value;
  }
  async function call(op, data) {
    const url = new URL(endpoint, location.origin);
    if (op) url.searchParams.set("op", op);
    const res = await fetch(url, {
      method: data ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: data ? { "Content-Type": "application/json" } : {},
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    if (!res.headers.get("content-type")?.includes("application/json"))
      throw new Error("Ativação indisponível neste endereço.");
    const body = await res.json();
    if (!res.ok) throw new Error(typeof body.error === "string"
      ? body.error : "Operação não concluída.");
    return body;
  }
  async function check() {
    if (busy) return;
    setBusy(true);
    feedback("");
    $("environment").textContent = "Verificando ambiente...";
    try {
      const status = await call(null);
      if (status.completed === true) {
        $("environment").textContent = "Administrador já ativado";
        show("done-panel");
      } else if (status.pending === true) {
        $("environment").textContent = "MFA pendente";
        show("recover-panel");
      } else if (status.available === true) {
        $("environment").textContent = "Preview protegido";
        show("start-panel");
      } else throw new Error("Ativação indisponível.");
    } catch {
      $("environment").textContent = "Ativação bloqueada";
      show("unavailable");
    } finally { setBusy(false); }
  }
  $("start-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !$("start-form").reportValidity()) return;
    const data = {
      setupCode: $("setup-code").value,
      email: $("email").value.trim(),
      name: $("name").value.trim(),
      password: $("password").value,
    };
    setBusy(true);
    feedback("");
    try {
      const created = await call("start", data);
      if (typeof created.email !== "string" ||
          !/^[A-Z2-7]{20,}$/.test(created.totpSecret || ""))
        throw new Error("Resposta inesperada do servidor.");
      activeEmail = created.email;
      $("password").value = "";
      $("totp-secret").textContent = created.totpSecret;
      $("environment").textContent = "Aguardando MFA";
      show("verify-panel");
      $("otp-code").focus();
    } catch (error) {
      feedback(error.message || "Não foi possível criar o administrador.", true);
    } finally {
      data.password = "";
      data.setupCode = "";
      setBusy(false);
    }
  });
  $("recover-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !$("recover-form").reportValidity()) return;
    const data = {
      setupCode: $("recover-setup-code").value,
      email: $("recover-email").value.trim(),
      password: $("recover-password").value,
    };
    setBusy(true);
    feedback("");
    try {
      const recovered = await call("recover", data);
      if (typeof recovered.email !== "string" ||
          !/^[A-Z2-7]{20,}$/.test(recovered.totpSecret || ""))
        throw new Error("Resposta inesperada do servidor.");
      $("setup-code").value = data.setupCode;
      $("recover-setup-code").value = "";
      $("recover-password").value = "";
      activeEmail = recovered.email;
      $("totp-secret").textContent = recovered.totpSecret;
      $("environment").textContent = "Confirme o novo MFA";
      show("verify-panel");
      $("otp-code").focus();
    } catch (error) {
      feedback(error.message || "Não foi possível retomar a ativação.", true);
    } finally {
      data.setupCode = "";
      data.password = "";
      setBusy(false);
    }
  });
  $("copy-secret").addEventListener("click", async () => {
    const secret = $("totp-secret").textContent;
    try {
      await navigator.clipboard.writeText(secret);
      feedback("Chave copiada. Cadastre-a diretamente no seu autenticador.");
    } catch {
      feedback("Selecione a chave acima e copie manualmente.", true);
    }
  });
  $("verify-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !$("verify-form").reportValidity() || !activeEmail) return;
    setBusy(true);
    feedback("");
    try {
      const result = await call("confirm", {
        setupCode: $("setup-code").value,
        email: activeEmail,
        code: $("otp-code").value.trim(),
      });
      if (result.activated !== true) throw new Error("Confirmação não concluída.");
      $("setup-code").value = "";
      $("totp-secret").textContent = "";
      $("otp-code").value = "";
      activeEmail = null;
      $("environment").textContent = "MFA confirmado";
      show("done-panel");
    } catch (error) {
      feedback(error.message || "Não foi possível validar o código.", true);
      $("otp-code").select();
    } finally { setBusy(false); }
  });
  $("retry").addEventListener("click", check);
  check();
})();
