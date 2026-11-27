import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OFFICIAL_DOMAINS = Object.freeze([
  "gov.br",
  "esteri.it",
  "interno.gov.it",
  "giustizia.it",
  "gazzettaufficiale.it",
  "europa.eu",
  "inps.it",
  "agenziaentrate.gov.it",
  "anpr.interno.it",
  "lavoro.gov.it",
]);

const CATEGORIES = [
  "Serviços consulares",
  "Documentação",
  "Brasil",
  "Itália",
];

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topicFound", "title", "summary", "category", "body", "sources", "reviewPoints"],
  properties: {
    topicFound: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    category: { type: "string", enum: CATEGORIES },
    body: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "level", "items", "sourceIds"],
        properties: {
          type: { type: "string", enum: ["paragraph", "heading", "list"] },
          text: { type: "string" },
          level: { type: ["integer", "null"] },
          items: { type: "array", items: { type: "string" } },
          sourceIds: { type: "array", items: { type: "string" } },
        },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "url", "publisher", "datePublished", "supports"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          publisher: { type: "string" },
          datePublished: { type: ["string", "null"] },
          supports: { type: "array", items: { type: "string" } },
        },
      },
    },
    reviewPoints: { type: "array", items: { type: "string" } },
  },
};

function fail(message) {
  throw new Error(message);
}

export function normalizeOfficialUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!OFFICIAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`)))
    return null;
  url.hash = "";
  return url.href;
}

export function slugifyArticleTitle(title) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

function extractText(response) {
  const text = (response.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
  if (typeof text !== "string" || !text.trim())
    fail("A pesquisa não retornou um rascunho estruturado.");
  return text;
}

function extractSearchSources(response) {
  const sources = new Set();
  for (const item of response.output || []) {
    for (const source of item.action?.sources || []) {
      const normalized = normalizeOfficialUrl(source.url);
      if (normalized) sources.add(normalized);
    }
    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        const normalized = normalizeOfficialUrl(annotation.url);
        if (normalized) sources.add(normalized);
      }
    }
  }
  return sources;
}

export function validateGeneratedArticle(article, searchedUrls) {
  if (!article || typeof article !== "object") fail("Formato de artigo inválido.");
  const title = article.title?.trim();
  const summary = article.summary?.trim();
  if (!title || title.length > 140) fail("O título precisa ter até 140 caracteres.");
  if (!summary || summary.length > 320) fail("O resumo precisa ter até 320 caracteres.");
  if (!CATEGORIES.includes(article.category)) fail("Categoria editorial inválida.");
  if (!Array.isArray(article.body) || article.body.length < 4)
    fail("O artigo precisa conter ao menos quatro blocos de conteúdo.");
  if (!Array.isArray(article.sources) || article.sources.length < 2)
    fail("A pesquisa precisa registrar pelo menos duas fontes oficiais.");

  const ids = new Set();
  for (const source of article.sources) {
    const url = normalizeOfficialUrl(source.url);
    if (!url || !searchedUrls.has(url))
      fail("Uma fonte do artigo não corresponde a uma página oficial encontrada na pesquisa.");
    if (!/^S\d{1,2}$/.test(source.id) || ids.has(source.id))
      fail("Identificadores de fonte ausentes ou duplicados.");
    if (!source.title?.trim() || !source.publisher?.trim())
      fail("Cada fonte precisa ter título e órgão responsável.");
    if (!Array.isArray(source.supports) || source.supports.length === 0)
      fail("Cada fonte precisa indicar quais informações apoia.");
    ids.add(source.id);
  }

  let paragraphs = 0;
  for (const block of article.body) {
    if (!block || !["paragraph", "heading", "list"].includes(block.type))
      fail("O artigo contém um bloco de conteúdo inválido.");
    if (!Array.isArray(block.sourceIds) || block.sourceIds.some((id) => !ids.has(id)))
      fail("Uma referência do texto não aponta para uma fonte registrada.");
    if (block.type === "paragraph") {
      if (!block.text?.trim() || block.sourceIds.length === 0)
        fail("Cada parágrafo factual precisa de texto e referência a uma fonte.");
      paragraphs++;
    } else if (block.type === "heading") {
      if (!block.text?.trim() || ![2, 3].includes(block.level))
        fail("Título de seção inválido.");
    } else if (!Array.isArray(block.items) || block.items.length === 0) {
      fail("Uma lista do artigo está vazia.");
    }
  }
  if (paragraphs < 3) fail("O artigo precisa ter ao menos três parágrafos referenciados.");
  if (!Array.isArray(article.reviewPoints)) fail("Pontos para revisão estão ausentes.");
  return article;
}

export async function generateEditorialDraft({
  topic,
  discover = false,
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
  repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url))),
} = {}) {
  if (env.PINCIO_EDITORIAL_AGENT_ENABLED !== "true")
    fail("Agente editorial desativado. Nenhuma pesquisa foi iniciada.");
  if (!env.OPENAI_API_KEY)
    fail("Configure OPENAI_API_KEY em um secret do servidor para usar o agente.");
  if (discover !== true && (typeof topic !== "string" || topic.trim().length < 8 || topic.trim().length > 240))
    fail("Informe uma pauta entre 8 e 240 caracteres ou use a opção de descoberta.");

  const instructions = [
    "Você é o agente editorial da PINCIO Assessoria Internacional.",
    "Pesquise antes de escrever. Use exclusivamente páginas primárias e oficiais dentro dos domínios permitidos.",
    "Escreva em português brasileiro, com tom profissional, claro e didático para pessoas no Brasil interessadas em procedimentos documentais e consulares entre Brasil e Itália.",
    "Não invente requisitos, prazos, valores, garantias, decisões, datas de publicação nem links.",
    "Diferencie informação confirmada de orientação geral, destaque variações por consulado, município ou caso individual e registre incertezas em reviewPoints.",
    "Use apenas fontes que a ferramenta web_search realmente encontrou. Associe a cada parágrafo factual os IDs das fontes que o sustentam.",
    "A saída é somente um rascunho. Não declare aprovação, não publique e não prometa contratação.",
    "Se não encontrar duas fontes oficiais suficientes, explique a limitação em reviewPoints e não complete lacunas com suposições.",
    ...(discover
      ? ["Identifique uma mudança ou orientação oficial recente, relevante para brasileiros em assuntos documentais/consulares entre Brasil e Itália. Priorize novidade prática, confirme a data nas fontes e não use notícias de assessorias."]
      : []),
  ].join(" ");

  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: env.PINCIO_EDITORIAL_MODEL || "gpt-6.2-astra",
      store: false,
      tools: [
        {
          type: "web_search",
          search_context_size: "high",
          filters: { allowed_domains: OFFICIAL_DOMAINS },
        },
      ],
      include: ["web_search_call.action.sources"],
      instructions,
      input: discover
        ? "Pesquise uma pauta atual e relevante para o público da PINCIO, selecione a mais útil e prepare um artigo com as fontes oficiais que comprovam a informação."
        : `Pesquise e prepare um artigo sobre esta pauta: ${topic.trim()}`,
      text: {
        format: {
          type: "json_schema",
          name: "pincio_editorial_draft",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) fail(`O provedor de pesquisa respondeu HTTP ${response.status}.`);
  const result = await response.json();
  if (result.status && result.status !== "completed")
    fail("A geração não foi concluída; o rascunho não foi salvo.");
  const searchedUrls = extractSearchSources(result);
  const article = validateGeneratedArticle(JSON.parse(extractText(result)), searchedUrls);
  if (typeof article.topicFound !== "string" || article.topicFound.trim().length < 8)
    fail("A pauta pesquisada não foi identificada no rascunho.");
  const slug = slugifyArticleTitle(article.title);
  if (!slug) fail("Não foi possível criar um endereço seguro para o artigo.");

  const day = now.toISOString().slice(0, 10);
  const draft = {
    ...article,
    requestedTopic: discover ? "Descoberta editorial de pauta recente" : topic.trim(),
    slug,
    createdAt: now.toISOString(),
    status: "draft",
    sources: article.sources.map((source) => ({
      ...source,
      url: normalizeOfficialUrl(source.url),
      datePublished: source.datePublished || null,
      accessedAt: day,
    })),
    review: { approved: false, reviewer: null, approvedAt: null, notes: "" },
  };
  const directory = resolve(repoRoot, "docs/pincio/editorial/drafts");
  await mkdir(directory, { recursive: true });
  const outputPath = resolve(directory, `${slug}.json`);
  await writeFile(outputPath, `${JSON.stringify(draft, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return outputPath;
}

function parseTopicArg(argv) {
  const index = argv.indexOf("--topic");
  return { topic: index >= 0 ? argv[index + 1] : null, discover: argv.includes("--discover") };
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const output = await generateEditorialDraft(parseTopicArg(process.argv.slice(2)));
    console.log(`Rascunho salvo em ${output}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
