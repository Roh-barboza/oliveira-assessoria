document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("main-nav");
  const form = document.getElementById("consular-form");
  const status = document.getElementById("form-status");
  const scrollToTarget = (selector) =>
    document
      .querySelector(selector)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  toggle?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.querySelector("i").className = isOpen
      ? "fa-solid fa-xmark"
      : "fa-solid fa-bars";
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
  nav?.querySelectorAll('a[href^="#"]').forEach((link) =>
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
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
      button.innerHTML =
        'Solicitar análise <i class="fa-solid fa-arrow-right"></i>';
    }
  });
});
