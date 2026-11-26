document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("consular-form");
  const status = document.getElementById("form-status");
  const scrollToTarget = (selector) =>
    document.querySelector(selector)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });

  document
    .querySelectorAll("[data-scroll]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        scrollToTarget(button.dataset.scroll),
      ),
    );
  document.querySelectorAll("[data-service]").forEach((link) =>
    link.addEventListener("click", () => {
      const select = form?.querySelector('[name="servico"]');
      if (select) select.value = link.dataset.service;
    }),
  );
  let sending = false;
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const payload = {
      nome: String(data.get("nome") || "").trim(),
      whatsapp: String(data.get("whatsapp") || "").trim(),
      area: data.get("area"),
      mensagem: `[${data.get("servico")}] ${data.get("mensagem") || ""}`.trim(),
    };
    if (data.get("website")) {
      status.textContent =
        "Não foi possível validar o formulário. Recarregue a página e tente novamente.";
      return;
    }
    const digits = payload.whatsapp.replace(/\D/g, "");
    if (
      payload.nome.length < 2 ||
      payload.nome.length > 120 ||
      digits.length < 10 ||
      digits.length > 15 ||
      /^(\d)\1+$/.test(digits) ||
      String(data.get("mensagem") || "").length > 2000
    ) {
      status.textContent =
        "Confira seu nome, telefone e o limite de 2.000 caracteres da mensagem.";
      return;
    }
    sending = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    button.disabled = true;
    button.textContent = "Enviando…";
    status.textContent = "";
    try {
      const response = await fetch(
        "https://chaoticcow-n8n.cloudfy.live/webhook/oliveira-leads",
        {
          method: "POST",
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error("Falha no envio");
      form.reset();
      status.textContent =
        "Solicitação enviada. Aguarde a confirmação de recebimento pela equipe.";
      status.style.color = "#187045";
    } catch {
      status.textContent = controller.signal.aborted
        ? "O envio demorou mais que o esperado e não foi confirmado. Antes de reenviar, confirme com a equipe para evitar duplicação."
        : "Não foi possível confirmar o envio. Seus dados foram mantidos no formulário. Antes de reenviar, confirme com a equipe para evitar duplicação.";
      status.style.color = "#9a2a38";
    } finally {
      clearTimeout(timeout);
      sending = false;
      button.disabled = false;
      button.innerHTML = 'Solicitar análise <span aria-hidden="true">→</span>';
    }
  });
  if (form) form.querySelector('button[type="submit"]').disabled = false;
});
