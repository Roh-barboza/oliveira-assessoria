/* Navigation enhances an accessible, visible fallback when JavaScript is unavailable. */
document.documentElement.classList.add("js");
const toggle = document.getElementById("menu-toggle");
const nav = document.getElementById("main-nav");
if (toggle && nav) {
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    toggle.firstElementChild.textContent = open ? "×" : "☰";
  };
  toggle.addEventListener("click", () =>
    setOpen(toggle.getAttribute("aria-expanded") !== "true"),
  );
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      toggle.getAttribute("aria-expanded") === "true"
    ) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-header")) setOpen(false);
  });
  matchMedia("(max-width: 900px)").addEventListener("change", () =>
    setOpen(false),
  );
}
const service = new URLSearchParams(location.search).get("servico");
const select = document.querySelector('#consular-form [name="servico"]');
if (
  service &&
  select &&
  [...select.options].some((option) => option.value === service)
)
  select.value = service;
