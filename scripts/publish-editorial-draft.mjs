import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeOfficialUrl, slugifyArticleTitle } from "./editorial-agent.mjs";

const START = "<!-- PINCIO-EDITORIAL-ARTICLES:START -->";
const END = "<!-- PINCIO-EDITORIAL-ARTICLES:END -->";
const EMPTY_START = "<!-- PINCIO-EDITORIAL-EMPTY:START -->";
const EMPTY_END = "<!-- PINCIO-EDITORIAL-EMPTY:END -->";
const DEFAULT_ORIGIN = "https://pincio-assessoria.vercel.app";
const CATEGORIES = new Set(["Serviços consulares", "Documentação", "Brasil", "Itália"]);

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function requireApprovedArticle(draft) {
  if (draft.status !== "approved" || draft.review?.approved !== true)
    throw new Error("O rascunho precisa ser revisado e marcado como aprovado.");
  if (!draft.review.reviewer?.trim() || !Number.isFinite(Date.parse(draft.review.approvedAt || "")))
    throw new Error("Registre o nome do revisor e a data de aprovação.");
  if (!Array.isArray(draft.reviewPoints) || draft.reviewPoints.length)
    throw new Error("Resolva e remova todos os pontos pendentes de revisão.");
  const safeSlug = slugifyArticleTitle(draft.title || "");
  if (!safeSlug || draft.slug !== safeSlug) throw new Error("Slug do artigo inválido.");
  if (draft.title.length > 140) throw new Error("Título inválido.");
  if (!draft.summary?.trim() || draft.summary.length > 320) throw new Error("Resumo inválido.");
  if (!CATEGORIES.has(draft.category)) throw new Error("Categoria editorial inválida.");
  if (!Array.isArray(draft.sources) || draft.sources.length < 2)
    throw new Error("O artigo precisa manter pelo menos duas fontes oficiais.");

  const sourcesById = new Map();
  for (const source of draft.sources) {
    const url = normalizeOfficialUrl(source.url);
    if (!url || !source.id || sourcesById.has(source.id))
      throw new Error("Uma fonte não passou pela validação de segurança.");
    if (!source.title?.trim() || !source.publisher?.trim())
      throw new Error("Cada fonte precisa manter título e órgão responsável.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt || "") || !Number.isFinite(Date.parse(source.accessedAt)))
      throw new Error("Cada fonte precisa manter uma data de consulta válida.");
    sourcesById.set(source.id, { ...source, url });
  }

  if (!Array.isArray(draft.body) || draft.body.length < 4)
    throw new Error("O artigo não tem conteúdo suficiente.");
  let paragraphCount = 0;
  for (const block of draft.body) {
    if (!Array.isArray(block.sourceIds) || block.sourceIds.some((id) => !sourcesById.has(id)))
      throw new Error("Uma citação do texto não aponta para uma fonte aprovada.");
    if (block.type === "paragraph") {
      if (!block.text?.trim() || block.sourceIds.length === 0)
        throw new Error("Cada parágrafo factual precisa de fonte.");
      paragraphCount++;
    }
    if (block.type === "heading" && (!block.text?.trim() || ![2, 3].includes(block.level)))
      throw new Error("Há um subtítulo inválido.");
    if (block.type === "list" && (!Array.isArray(block.items) || !block.items.length || block.sourceIds.length === 0))
      throw new Error("Há uma lista vazia.");
    if (!["paragraph", "heading", "list"].includes(block.type))
      throw new Error("O artigo contém um tipo de bloco não permitido.");
  }
  if (paragraphCount < 3) throw new Error("O artigo precisa manter três parágrafos referenciados.");
  return sourcesById;
}

function citationLinks(ids, sourcesById) {
  if (!ids.length) return "";
  const links = ids.map((id) => {
    const source = sourcesById.get(id);
    return `<a href="${escapeHtml(source.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(id)}</a>`;
  });
  return ` <span class="article-citations" aria-label="Fontes citadas">Fontes: ${links.join(", ")}</span>`;
}

function renderBody(body, sourcesById) {
  return body
    .map((block) => {
      const citations = citationLinks(block.sourceIds, sourcesById);
      if (block.type === "heading")
        return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
      if (block.type === "list")
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${citations}`;
      return `<p>${escapeHtml(block.text)}${citations}</p>`;
    })
    .join("\n");
}

function renderPage(draft, sourcesById, origin) {
  const sources = [...sourcesById.values()]
    .map((source) => {
      const date = source.datePublished ? ` · Publicado em ${escapeHtml(source.datePublished)}` : "";
      return `<li><a href="${escapeHtml(source.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(source.title)}</a><span> — ${escapeHtml(source.publisher)}${date}; consultada em ${escapeHtml(source.accessedAt)}.</span></li>`;
    })
    .join("\n");
  const publishedDate = new Date(draft.review.approvedAt).toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(draft.title)} | PINCIO Assessoria Internacional</title>
  <meta name="description" content="${escapeHtml(draft.summary)}">
  <meta name="robots" content="noindex,nofollow">
  <link rel="canonical" href="${origin}/artigos/${draft.slug}.html">
  <link rel="stylesheet" href="/site.css">
  <link rel="icon" href="/assets/logo-mark-pincio.svg" type="image/svg+xml">
</head>
<body>
  <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
  <header class="site-header"><div class="shell header-inner">
    <a class="brand" href="/" aria-label="PINCIO — página inicial"><img src="/assets/logo-pincio.svg" alt="PINCIO Assessoria Internacional" width="380" height="96"></a>
    <button id="menu-toggle" class="menu-toggle" type="button" aria-label="Abrir menu" aria-controls="main-nav" aria-expanded="false"><span aria-hidden="true">☰</span></button>
    <nav id="main-nav" class="main-nav" aria-label="Navegação principal"><a href="/servicos.html#italia">Itália</a><a href="/servicos.html#brasil">Brasil</a><a href="/conteudos.html" aria-current="page">Conteúdos</a><a href="/#processo">Como funciona</a><a href="/#contato">Contato</a></nav>
    <a class="header-cta" href="/#contato">Solicitar análise</a>
  </div></header>
  <main id="conteudo" class="article-main shell" tabindex="-1">
    <nav class="article-breadcrumb" aria-label="Trilha de navegação"><a href="/conteudos.html">Conteúdos</a><span aria-hidden="true">/</span><span>${escapeHtml(draft.category)}</span></nav>
    <article class="editorial-article">
      <header class="article-heading"><p class="eyebrow eyebrow--dark">${escapeHtml(draft.category)}</p><h1>${escapeHtml(draft.title)}</h1><p class="article-summary">${escapeHtml(draft.summary)}</p><p class="article-meta">Equipe PINCIO · Atualizado em <time datetime="${publishedDate}">${publishedDate}</time></p></header>
      <div class="article-body">${renderBody(draft.body, sourcesById)}</div>
      <section class="article-sources" aria-labelledby="sources-title"><h2 id="sources-title">Fontes consultadas</h2><ol>${sources}</ol><p>Conteúdo informativo, sujeito a mudanças e às regras aplicáveis a cada caso. Consulte os canais oficiais para confirmar a orientação atual.</p></section>
    </article>
  </main>
  <footer class="site-footer"><div class="shell footer-inner"><a class="brand brand--footer" href="/" aria-label="PINCIO — página inicial"><img src="/assets/logo-pincio-white.svg" alt="PINCIO Assessoria Internacional" width="380" height="96"></a><p>Assessoria administrativa e documental<br>no Brasil e na Itália.</p><nav aria-label="Navegação do rodapé"><a href="/conteudos.html">Conteúdos</a><a href="/privacidade.html">Privacidade</a><a href="/termos.html">Termos de uso</a></nav></div><p class="footer-photo-credit"><a href="/creditos.html">Fotografia e créditos</a></p></footer>
  <script src="/site.js" defer></script>
</body>
</html>
`;
}

function renderCard(draft, publishedDate) {
  return `<article class="editorial-card"><p class="eyebrow eyebrow--dark">${escapeHtml(draft.category)} · ${publishedDate}</p><h3><a href="/artigos/${draft.slug}.html">${escapeHtml(draft.title)}</a></h3><p>${escapeHtml(draft.summary)}</p><a class="editorial-card-link" href="/artigos/${draft.slug}.html">Ler artigo</a></article>`;
}

async function ensureAbsent(path) {
  try {
    await access(path, constants.F_OK);
    throw new Error("O artigo já existe e não será sobrescrito.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function publishEditorialDraft({ draftPath, repoRoot, env = process.env } = {}) {
  if (env.PINCIO_EDITORIAL_PUBLISH_ENABLED !== "true")
    throw new Error("Publicação editorial desativada. Nenhum arquivo foi alterado.");
  if (!draftPath) throw new Error("Informe o caminho do rascunho aprovado.");
  const root = resolve(repoRoot || fileURLToPath(new URL("..", import.meta.url)));
  const draftsDir = resolve(root, "docs/pincio/editorial/drafts");
  const resolvedDraft = resolve(root, draftPath);
  if (!resolvedDraft.startsWith(`${draftsDir}${sep}`) || !resolvedDraft.endsWith(".json"))
    throw new Error("O arquivo precisa estar dentro da pasta de rascunhos editoriais.");
  const draft = JSON.parse(await readFile(resolvedDraft, "utf8"));
  const sourcesById = requireApprovedArticle(draft);
  const origin = (env.PINCIO_PUBLIC_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, "");
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== "https:" || parsedOrigin.pathname !== "/")
    throw new Error("A origem pública precisa ser uma URL HTTPS de domínio, sem caminho.");

  const indexPath = resolve(root, "landing/conteudos.html");
  const sitemapPath = resolve(root, "landing/sitemap.xml");
  const articlePath = resolve(root, `landing/artigos/${draft.slug}.html`);
  await ensureAbsent(articlePath);
  const [index, sitemap] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(sitemapPath, "utf8"),
  ]);
  const startIndex = index.indexOf(START);
  const endIndex = index.indexOf(END);
  if (startIndex < 0 || endIndex <= startIndex)
    throw new Error("A área de listagem de artigos não está preparada no site.");
  const url = `${origin}/artigos/${draft.slug}.html`;
  if (sitemap.includes(`<loc>${url}</loc>`)) throw new Error("O artigo já consta no sitemap.");
  const publishedDate = new Date(draft.review.approvedAt).toISOString().slice(0, 10);
  const card = renderCard(draft, publishedDate);
  let currentCards = index.slice(startIndex + START.length, endIndex).trim();
  const emptyStart = currentCards.indexOf(EMPTY_START);
  const emptyEnd = currentCards.indexOf(EMPTY_END);
  if (emptyStart >= 0 && emptyEnd > emptyStart)
    currentCards = `${currentCards.slice(0, emptyStart)}${currentCards.slice(emptyEnd + EMPTY_END.length)}`.trim();
  const nextIndex = `${index.slice(0, startIndex + START.length)}\n${card}\n${currentCards}\n${index.slice(endIndex)}`;
  const nextSitemap = sitemap.replace("</urlset>", `<url><loc>${escapeHtml(url)}</loc></url>\n</urlset>`);
  if (nextSitemap === sitemap) throw new Error("Sitemap inválido; faltou o fechamento de urlset.");
  const page = renderPage(draft, sourcesById, origin);

  const writes = [
    [articlePath, page],
    [indexPath, nextIndex],
    [sitemapPath, nextSitemap],
  ];
  const temporary = [];
  try {
    for (const [path, content] of writes) {
      await mkdir(dirname(path), { recursive: true });
      const tempPath = `${path}.${process.pid}.tmp`;
      await writeFile(tempPath, content, { flag: "wx", mode: 0o644 });
      temporary.push([tempPath, path]);
    }
    await ensureAbsent(articlePath);
    for (const [tempPath, path] of temporary) await rename(tempPath, path);
  } catch (error) {
    await Promise.all(temporary.map(([tempPath]) => unlink(tempPath).catch(() => {})));
    throw error;
  }
  return { articlePath, indexPath, sitemapPath };
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const path = process.argv[2];
    const result = await publishEditorialDraft({ draftPath: path });
    console.log(`Artigo adicionado ao código do site: ${result.articlePath}`);
    console.log("A publicação pública ainda depende de revisão do diff e deploy autorizado.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
