/* Progressive enhancement: all services remain readable without JavaScript. */
const search = document.getElementById("catalog-search");
const category = document.getElementById("catalog-category");
if (search && category) {
  const cards = [...document.querySelectorAll(".catalog-card")];
  const count = document.getElementById("catalog-count");
  const empty = document.getElementById("catalog-empty");
  const normalize = (text) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const index = cards.map((card) => ({
    card,
    text: normalize(
      card.querySelector("h3").textContent +
        " " +
        card.querySelector(".catalog-description").textContent,
    ),
  }));
  const update = () => {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const { card, text } of index) {
      card.hidden = !(
        (category.value === "todos" ||
          card.dataset.category === category.value) &&
        terms.every((term) => text.includes(term))
      );
      if (!card.hidden) visible++;
    }
    document.querySelectorAll(".catalog-group").forEach((group) => {
      group.hidden = ![...group.querySelectorAll(".catalog-card")].some(
        (card) => !card.hidden,
      );
    });
    count.textContent = `${visible} ${visible === 1 ? "serviço encontrado" : "serviços encontrados"}`;
    empty.hidden = visible !== 0;
  };
  search.addEventListener("input", update);
  category.addEventListener("change", update);
}
