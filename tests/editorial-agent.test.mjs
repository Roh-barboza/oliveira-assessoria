import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir, writeFile, stat } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  generateEditorialDraft,
  normalizeOfficialUrl,
  slugifyArticleTitle,
  validateGeneratedArticle,
} from "../scripts/editorial-agent.mjs";
import { publishEditorialDraft } from "../scripts/publish-editorial-draft.mjs";

const sources = [
  {
    id: "S1",
    title: "Orientação oficial brasileira",
    url: "https://www.gov.br/orgaos/orientacao",
    publisher: "Governo Federal",
    datePublished: null,
    supports: ["Confirma o procedimento descrito"],
  },
  {
    id: "S2",
    title: "Orientação oficial italiana",
    url: "https://www.esteri.it/servizi/guida",
    publisher: "Ministero degli Affari Esteri",
    datePublished: "2026-11-20",
    supports: ["Confirma o limite aplicável"],
  },
];

const article = {
  topicFound: "Como conferir uma orientação consular atual",
  title: "Guia <script> seguro",
  summary: "Resumo claro sobre a consulta de fontes oficiais e suas limitações.",
  category: "Serviços consulares",
  body: [
    { type: "paragraph", text: "Confira a informação no canal responsável.", level: null, items: [], sourceIds: ["S1"] },
    { type: "heading", text: "Como verificar", level: 2, items: [], sourceIds: [] },
    { type: "paragraph", text: "As orientações podem variar conforme a circunscrição.", level: null, items: [], sourceIds: ["S1", "S2"] },
    { type: "paragraph", text: "Confirme a data da página antes de iniciar o pedido.", level: null, items: [], sourceIds: ["S2"] },
  ],
  sources,
  reviewPoints: ["Confirmar a aplicação da orientação a cada circunscrição."],
};

function responseFor(value = article, searched = sources) {
  return {
    status: "completed",
    output: [
      { type: "web_search_call", action: { sources: searched.map(({ title, url }) => ({ title, url })) } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] },
    ],
  };
}

test("agente começa bloqueado e não chama a API sem ativação explícita", async () => {
  let called = false;
  await assert.rejects(
    generateEditorialDraft({
      topic: "Orientação consular atualizada",
      env: { OPENAI_API_KEY: "mock-secret" },
      fetchImpl: async () => { called = true; },
    }),
    /desativado/,
  );
  assert.equal(called, false);
});

test("gera rascunho local com busca simulada, fontes permitidas e aprovação falsa", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "pincio-editorial-"));
  let request;
  try {
    const path = await generateEditorialDraft({
      topic: "Orientação consular atualizada",
      env: { PINCIO_EDITORIAL_AGENT_ENABLED: "true", OPENAI_API_KEY: "mock-secret" },
      repoRoot,
      now: new Date("2026-11-27T12:00:00.000Z"),
      fetchImpl: async (url, options) => {
        request = { url, options, body: JSON.parse(options.body) };
        return { ok: true, json: async () => responseFor() };
      },
    });
    const draft = JSON.parse(await readFile(path, "utf8"));
    const file = await stat(path);
    assert.equal(request.url, "https://api.openai.com/v1/responses");
    assert.equal(request.body.store, false);
    assert.equal(request.body.tools[0].type, "web_search");
    assert.ok(request.body.tools[0].filters.allowed_domains.includes("gov.br"));
    assert.equal(draft.status, "draft");
    assert.deepEqual(draft.review, { approved: false, reviewer: null, approvedAt: null, notes: "" });
    assert.equal(draft.sources[0].accessedAt, "2026-11-27");
    assert.equal(file.mode & 0o777, 0o600);
    assert.equal(request.options.headers.Authorization, "Bearer mock-secret");
    assert.equal(await readFile(path, "utf8").then((v) => v.includes("mock-secret")), false);
    await assert.rejects(
      generateEditorialDraft({
        topic: "Orientação consular atualizada",
        env: { PINCIO_EDITORIAL_AGENT_ENABLED: "true", OPENAI_API_KEY: "mock-secret" },
        repoRoot,
        fetchImpl: async () => ({ ok: true, json: async () => responseFor() }),
      }),
      /EEXIST/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("não salva conteúdo que cita fonte ausente da busca ou domínio não oficial", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "pincio-editorial-invalid-"));
  try {
    await assert.rejects(
      generateEditorialDraft({
        topic: "Orientação consular atualizada",
        env: { PINCIO_EDITORIAL_AGENT_ENABLED: "true", OPENAI_API_KEY: "mock-secret" },
        repoRoot,
        fetchImpl: async () => ({ ok: true, json: async () => responseFor(article, [sources[0]]) }),
      }),
      /não corresponde a uma página oficial encontrada/,
    );
    assert.equal(normalizeOfficialUrl("http://www.gov.br/guia"), null);
    assert.equal(normalizeOfficialUrl("https://example.com/guia"), null);
    assert.equal(slugifyArticleTitle("Guia de cidadania italiana"), "guia-de-cidadania-italiana");
    await assert.rejects(readFile(join(repoRoot, "docs/pincio/editorial/drafts/guia-script-seguro.json")));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("publicador permanece bloqueado sem ativação e sem aprovação editorial", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "pincio-editorial-publish-"));
  try {
    const drafts = join(repoRoot, "docs/pincio/editorial/drafts");
    await mkdir(drafts, { recursive: true });
    const draftPath = "docs/pincio/editorial/drafts/guia-script-seguro.json";
    await writeFile(join(repoRoot, draftPath), JSON.stringify({ ...article, slug: "guia-script-seguro", status: "draft", review: { approved: false } }));
    await assert.rejects(publishEditorialDraft({ draftPath, repoRoot }), /Publicação editorial desativada/);
    await assert.rejects(
      publishEditorialDraft({ draftPath, repoRoot, env: { PINCIO_EDITORIAL_PUBLISH_ENABLED: "true" } }),
      /marcado como aprovado/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("publicador cria HTML escapado, índice e sitemap apenas depois da aprovação", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "pincio-editorial-published-"));
  const draftPath = "docs/pincio/editorial/drafts/guia-script-seguro.json";
  try {
    const drafts = join(repoRoot, "docs/pincio/editorial/drafts");
    const landing = join(repoRoot, "landing");
    await mkdir(drafts, { recursive: true });
    await mkdir(landing, { recursive: true });
    await writeFile(join(landing, "conteudos.html"), `<main>x</main>\n<!-- PINCIO-EDITORIAL-ARTICLES:START -->\n<!-- PINCIO-EDITORIAL-EMPTY:START --><div class="editorial-empty">Em breve</div><!-- PINCIO-EDITORIAL-EMPTY:END -->\n<!-- PINCIO-EDITORIAL-ARTICLES:END -->\n`);
    await writeFile(join(landing, "sitemap.xml"), `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
    const approved = {
      ...article,
      slug: "guia-script-seguro",
      status: "approved",
      reviewPoints: [],
      review: { approved: true, reviewer: "Revisora", approvedAt: "2026-11-27T12:00:00.000Z", notes: "Revisado" },
      sources: sources.map((source) => ({ ...source, accessedAt: "2026-11-27" })),
    };
    await writeFile(join(repoRoot, draftPath), JSON.stringify(approved));
    const result = await publishEditorialDraft({
      draftPath,
      repoRoot,
      env: { PINCIO_EDITORIAL_PUBLISH_ENABLED: "true", PINCIO_PUBLIC_ORIGIN: "https://pincio-assessoria.vercel.app" },
    });
    const page = await readFile(result.articlePath, "utf8");
    const index = await readFile(result.indexPath, "utf8");
    const sitemap = await readFile(result.sitemapPath, "utf8");
    assert.match(page, /&lt;script&gt; seguro/);
    assert.doesNotMatch(page, /<script> seguro/);
    assert.match(page, /aria-label="Fontes citadas"/);
    assert.match(page, /rel="noopener noreferrer" target="_blank"/);
    assert.match(index, /Guia &lt;script&gt; seguro/);
    assert.doesNotMatch(index, /Em breve/);
    assert.match(sitemap, /\/artigos\/guia-script-seguro\.html/);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("validação de artigo impede parágrafo sem fonte", () => {
  const invalid = structuredClone(article);
  invalid.body[0].sourceIds = [];
  const searchedUrls = new Set(sources.map((source) => normalizeOfficialUrl(source.url)));
  assert.throws(() => validateGeneratedArticle(invalid, searchedUrls), /parágrafo factual precisa/);
});

test("página de conteúdos segue a marca, a navegação global e o noindex preservado", async () => {
  const root = resolve("landing");
  const pages = await readdir(root, { recursive: true });
  const htmlFiles = pages.filter((path) => path.endsWith(".html"));
  for (const path of htmlFiles) {
    const html = await readFile(join(root, path), "utf8");
    if (html.includes('id="main-nav"')) assert.match(html, /href="\/conteudos\.html"/i, `${path} omits blog navigation`);
  }
  const blog = await readFile(join(root, "conteudos.html"), "utf8");
  assert.match(blog, /PINCIO Assessoria Internacional/);
  assert.match(blog, /name="robots" content="noindex,nofollow"/);
  const pasta = await readFile(join(root, "servicos/montagem-pasta-processual.html"), "utf8");
  assert.match(pasta, /href="\/servicos\.html#brasil">Brasil/);
  assert.doesNotMatch(pasta, /href="\/servicos\.html#italia">Brasil/);
  const home = await readFile(join(root, "index.html"), "utf8");
  assert.match(home, /service-number">05/);
  assert.doesNotMatch(home, /service-number">08/);
});
