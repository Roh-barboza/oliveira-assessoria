document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("consular-form");
  const status = document.getElementById("form-status");
  const scrollToTarget = (selector) =>
    document
      .querySelector(selector)
      ?.scrollIntoView({
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
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const payload = {
      nome: data.get("nome"),
      whatsapp: data.get("whatsapp"),
      area: data.get("area"),
      mensagem: `[${data.get("servico")}] ${data.get("mensagem") || ""}`.trim(),
    };
    button.disabled = true;
    button.textContent = "Enviando…";
    status.textContent = "";
    try {
      const response = await fetch(
        "https://chaoticcow-n8n.cloudfy.live/webhook/oliveira-leads",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error("Falha no envio");
      form.reset();
      status.textContent =
        "Recebemos seus dados. Em breve entraremos em contato.";
      status.style.color = "#187045";
    } catch {
      status.textContent =
        "Não foi possível enviar agora. Tente novamente em instantes.";
      status.style.color = "#9a2a38";
    } finally {
      button.disabled = false;
      button.innerHTML = 'Solicitar análise <span aria-hidden="true">→</span>';
    }
  });
});
