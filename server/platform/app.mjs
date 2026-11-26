import { randomBytes, randomUUID } from "node:crypto";
import {
  passwordHash,
  equalHex,
  digest,
  randomToken,
  validWebhook,
  uuid,
} from "./security.mjs";
import {
  catalog,
  pricingSeed,
  serviceFor,
  cleanText,
  validateAnswers,
  fixture,
  error,
} from "./catalog.mjs";
import { calculate } from "./pricing.mjs";
import { renderPdf } from "./pdf.mjs";

const closed = new Set(["encerrado", "cancelado"]);
const states = [
  "triagem",
  "aguardando_documentos",
  "conferencia",
  "pendencias",
  "preparado",
  "acompanhamento",
  "pausado",
  "encerrado",
  "cancelado",
];
const nowISO = (clock) => new Date(clock()).toISOString();
const cookieName = (secure) =>
  secure ? "__Host-oliveira-platform" : "oliveira-platform";
const headers = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const staff = (user) => ["jennifer", "rodrigo"].includes(user.role);
const pdfSafe = (text) =>
  String(text)
    .replace(/[–—→]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, " ");
function audit(w, user, action, caseId = null, detail = {}) {
  const event = {
    id: randomUUID(),
    at: new Date().toISOString(),
    actor: user?.id || "system",
    role: user?.role || "system",
    action,
    caseId,
    detail,
    previous: w.audit.at(-1)?.hash || "genesis",
  };
  event.hash = digest(JSON.stringify(event));
  w.audit.push(event);
}
export function auditValid(events) {
  let previous = "genesis";
  for (const event of events) {
    const { hash, ...body } = event;
    if (body.previous !== previous || digest(JSON.stringify(body)) !== hash)
      return false;
    previous = hash;
  }
  return true;
}
function allowCase(w, actor, id) {
  const c = w.cases.find((x) => x.id === id);
  if (
    !c ||
    (!staff(actor) && c.ownerId !== actor.id) ||
    (actor.role === "jennifer" &&
      c.assignedTo !== actor.id &&
      c.reviewerId !== actor.id)
  )
    throw error(404, "Atendimento não encontrado.");
  return c;
}
const requireStaff = (actor) => {
  if (!staff(actor)) throw error(403, "Ação restrita à equipe.");
};
const requireAdmin = (actor) => {
  if (actor.role !== "rodrigo")
    throw error(403, "Ação restrita à administração.");
};
const requireOpen = (c) => {
  if (closed.has(c.status))
    throw error(
      409,
      "Atendimento encerrado; abra uma continuidade com novo aceite.",
    );
};
function fieldset(input, allowed) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !allowed.includes(k))
  )
    throw error(422, "Campos não permitidos.");
}
function sessionFor(w, token, clock) {
  const session = w.sessions.find(
    (x) => x.hash === digest(token) && x.expiresAt > clock(),
  );
  const user = session && w.users.find((x) => x.id === session.userId);
  if (!user)
    throw error(
      401,
      "Entre novamente. O ambiente temporário pode ter reiniciado.",
    );
  return { session, user };
}
function publicState(w, user) {
  const cases = w.cases
    .filter((c) =>
      staff(user)
        ? user.role === "rodrigo" ||
          c.assignedTo === user.id ||
          c.reviewerId === user.id
        : c.ownerId === user.id,
    )
    .map((c) => ({
      ...c,
      documents: c.documents.map(({ content, ...metadata }) => metadata),
      contracts: c.contracts.map(({ pdf, signedPdf, ...x }) => x),
    }));
  const ids = new Set(cases.map((c) => c.id));
  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      username: user.username,
    },
    workspace: w.id,
    cases,
    draft: w.drafts?.[user.id] || null,
    users: w.users
      .filter((u) => staff(user) || u.id === user.id || staff(u))
      .map(({ id, name, role }) => ({ id, name, role })),
    tasks: w.tasks.filter(
      (t) => ids.has(t.caseId) && (staff(user) || t.customerVisible),
    ),
    audit: w.audit.filter((a) => staff(user) || ids.has(a.caseId)).slice(-150),
    pricing: staff(user) ? w.pricing : undefined,
    controls: {
      environment: "simulação",
      realContracts: false,
      realPayments: false,
      realMessages: false,
      actualCommercialApproval: false,
    },
    integrations: {
      clicksign: "simulador; credenciais novas pendentes",
      payments: "simulador sem provedor",
      whatsapp: "sugestões; número e integração pendentes",
      drive: "adaptador testável; conta empresarial pendente",
    },
  };
}
function newSession(w, user, clock) {
  const token = randomToken();
  const csrf = randomToken();
  w.sessions = w.sessions.filter((s) => s.expiresAt > clock()).slice(-29);
  w.sessions.push({
    hash: digest(token),
    csrf,
    userId: user.id,
    expiresAt: clock() + 3600000,
  });
  return { token: w.id + "." + token, csrf };
}
async function parseBody(req) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw error(415, "Use JSON.");
  let length = 0;
  const chunks = [];
  for await (const chunk of req.body || []) {
    length += chunk.length;
    if (length > 210000) throw error(413, "Requisição muito grande.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw error(400, "JSON inválido.");
  }
}

export function createApp({
  repository,
  storageMode = "temporario",
  clock = Date.now,
  webhookSecret = null,
  production = false,
}) {
  const rate = new Map();
  function throttle(key, limit) {
    const bucket = Math.floor(clock() / 3600000);
    const entry = rate.get(key);
    const count = entry?.bucket === bucket ? entry.count + 1 : 1;
    rate.set(key, { bucket, count });
    if (rate.size > 2000) rate.clear();
    if (count > limit)
      throw error(429, "Limite de tentativas atingido; tente mais tarde.");
  }
  async function handler(req) {
    const requestId = randomUUID();
    const url = new URL(req.url);
    const secure = url.protocol === "https:";
    const json = (data, status = 200, extra = {}) =>
      Response.json(data, {
        status,
        headers: { ...headers, "X-Request-Id": requestId, ...extra },
      });
    const setCookie = (token) =>
      `${cookieName(secure)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${secure ? "; Secure" : ""}`;
    try {
      if (production)
        throw error(404, "Plataforma de teste indisponível em produção.");
      const op = url.searchParams.get("op") || "config";
      const method = req.method;
      if (!["GET", "POST", "PATCH", "DELETE"].includes(method))
        throw error(405, "Método não permitido.");
      if (method !== "GET" && op !== "webhook") {
        const origin = req.headers.get("origin");
        if (
          origin !== url.origin ||
          req.headers.get("sec-fetch-site") === "cross-site"
        )
          throw error(403, "Origem não permitida.");
      }
      if (op === "config" && method === "GET")
        return json({
          catalog,
          mode: "synthetic-only",
          storage: storageMode,
          enabled: true,
          note:
            storageMode === "temporario"
              ? "Demonstração temporária: pode reiniciar. Não use dados reais."
              : "Ambiente de teste persistente; somente arquivos sintéticos.",
          realTransactions: false,
        });
      if (op === "fixture" && method === "GET")
        return new Response(fixture, {
          headers: {
            ...headers,
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="documento-sintetico-pincio.txt"',
          },
        });
      if (op === "demo" && method === "POST") {
        throttle(
          "demo:" +
            (req.headers.get("x-forwarded-for") || "local").split(",")[0],
          6,
        );
        const b = await parseBody(req);
        fieldset(b, ["acknowledge"]);
        if (b.acknowledge !== true)
          throw error(422, "Confirme o uso exclusivo de dados sintéticos.");
        const id = randomUUID();
        const w = {
          id,
          createdAt: clock(),
          expiresAt: clock() + 86400000,
          users: [],
          sessions: [],
          cases: [],
          tasks: [],
          audit: [],
          pricing: pricingSeed(),
          events: [],
        };
        const credentials = [];
        for (const [role, name, username] of [
          ["rodrigo", "Rodrigo · simulado", "rodrigo"],
          ["jennifer", "Jennifer · simulada", "jennifer"],
          ["customer", "Cliente Demonstração A", "cliente-a"],
          ["customer", "Cliente Demonstração B", "cliente-b"],
        ]) {
          const password = randomBytes(15).toString("base64url"),
            salt = randomBytes(16).toString("hex");
          const user = {
            id: randomUUID(),
            role,
            name,
            username,
            salt,
            password: await passwordHash(password, salt),
          };
          w.users.push(user);
          credentials.push({ name, username, password });
        }
        audit(w, w.users[0], "demo.created");
        const session = newSession(w, w.users[0], clock);
        await repository.create(id, w);
        return json(
          {
            workspace: id,
            credentials,
            csrf: session.csrf,
            state: publicState(w, w.users[0]),
            notice:
              "Credenciais individuais desta demonstração. Guarde-as para retomar; não são contas reais da equipe.",
          },
          201,
          { "Set-Cookie": setCookie(session.token) },
        );
      }
      if (op === "login" && method === "POST") {
        throttle(
          "login:" +
            (req.headers.get("x-forwarded-for") || "local").split(",")[0],
          30,
        );
        const b = await parseBody(req);
        fieldset(b, ["workspace", "username", "password"]);
        if (
          !uuid(b.workspace) ||
          typeof b.username !== "string" ||
          typeof b.password !== "string" ||
          b.password.length > 200
        )
          throw error(401, "Credenciais inválidas.");
        const record = await repository.read(b.workspace);
        const u = record?.value.users.find((x) => x.username === b.username);
        const candidate = await passwordHash(
          b.password,
          u?.salt || "00000000000000000000000000000000",
        );
        if (!u || !equalHex(candidate, u.password))
          throw error(401, "Credenciais inválidas ou ambiente reiniciado.");
        const result = await repository.change(b.workspace, (w) => {
          if (w.expiresAt < clock())
            throw error(401, "Ambiente sintético expirado.");
          const user = w.users.find((x) => x.id === u.id);
          const session = newSession(w, user, clock);
          audit(w, user, "auth.login");
          return { session, state: publicState(w, user) };
        });
        return json({ csrf: result.session.csrf, state: result.state }, 200, {
          "Set-Cookie": setCookie(result.session.token),
        });
      }
      if (op === "webhook" && method === "POST") {
        // Provider callbacks are deliberately disabled without a separately configured secret.
        if (!webhookSecret)
          throw error(503, "Webhook de sandbox não configurado.");
        const raw = Buffer.from(await req.arrayBuffer());
        if (
          raw.length > 32000 ||
          !validWebhook(raw, req.headers.get("content-hmac"), webhookSecret)
        )
          throw error(401, "Assinatura inválida.");
        let b;
        try {
          b = JSON.parse(raw);
        } catch {
          throw error(400, "Evento inválido.");
        }
        if (
          !uuid(b.workspace) ||
          !uuid(b.contractId) ||
          typeof b.eventId !== "string" ||
          b.eventId.length > 120 ||
          !["signed", "canceled", "failed"].includes(b.status)
        )
          throw error(422, "Evento inválido.");
        return json(
          await repository.change(b.workspace, (w) => {
            const eventKey = digest("clicksign:" + b.eventId);
            if (w.events.includes(eventKey)) return { duplicate: true };
            const c = w.cases.find((c) =>
              c.contracts.some((x) => x.id === b.contractId),
            );
            const contract = c?.contracts.find((x) => x.id === b.contractId);
            if (
              !contract ||
              contract.provider !== "simulator" ||
              !contract.envelopeId
            )
              throw error(404, "Envelope não encontrado.");
            if (
              (contract.status === "cancelado_simulado" &&
                b.status === "signed") ||
              (contract.status === "assinado_simulado" && b.status !== "signed")
            )
              throw error(409, "Evento tardio de envelope cancelado.");
            w.events.push(eventKey);
            contract.status =
              b.status === "signed"
                ? "assinado_simulado"
                : b.status === "canceled"
                  ? "cancelado_simulado"
                  : "falha_simulada";
            audit(w, null, "webhook.simulated", c.id, {
              eventKey,
              status: contract.status,
            });
            return { status: contract.status, simulated: true };
          }),
        );
      }
      const cookie = (req.headers.get("cookie") || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(cookieName(secure) + "="))
        ?.split("=")
        .slice(1)
        .join("=");
      if (op === "session" && method === "GET" && !cookie)
        return json({ authenticated: false });
      const [workspace, token] = cookie?.split(".") || [];
      if (!uuid(workspace) || !token)
        throw error(401, "Autenticação necessária.");
      const record = await repository.read(workspace);
      if (!record || record.value.expiresAt < clock())
        throw error(401, "Ambiente expirado ou reiniciado.");
      const { user, session } = sessionFor(record.value, token, clock);
      if (
        method !== "GET" &&
        req.headers.get("x-platform-csrf") !== session.csrf
      )
        throw error(403, "Token de sessão inválido. Recarregue a página.");
      throttle("account:" + user.id, 500);
      if (["state", "session"].includes(op) && method === "GET")
        return json({
          authenticated: true,
          csrf: session.csrf,
          state: publicState(record.value, user),
          storage: storageMode,
        });
      if (op === "download" && method === "GET") {
        const c = allowCase(record.value, user, url.searchParams.get("case"));
        const doc = c.documents.find(
          (x) => x.id === url.searchParams.get("id"),
        );
        if (!doc || doc.deleted) throw error(404, "Documento não encontrado.");
        await repository.change(workspace, (w) => {
          allowCase(w, user, c.id);
          audit(w, user, "document.downloaded", c.id, { documentId: doc.id });
        });
        return new Response(Buffer.from(doc.content, "base64"), {
          headers: {
            ...headers,
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="documento-sintetico.txt"',
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        });
      }
      if (op === "contract-pdf" && method === "GET") {
        const c = allowCase(record.value, user, url.searchParams.get("case"));
        const contract = c.contracts.find(
          (x) => x.id === url.searchParams.get("id"),
        );
        if (!contract) throw error(404, "Minuta não encontrada.");
        return new Response(
          Buffer.from(contract.signedPdf || contract.pdf, "base64"),
          {
            headers: {
              ...headers,
              "Content-Type": "application/pdf",
              "Content-Disposition":
                'attachment; filename="minuta-simulada.pdf"',
            },
          },
        );
      }
      if (op === "pricing" && method === "POST") {
        requireStaff(user);
        const b = await parseBody(req);
        fieldset(b, ["id", "costs", "terms", "save"]);
        const result = calculate(b.costs);
        if (b.terms) {
          fieldset(b.terms, ["period", "additional"]);
          for (const v of Object.values(b.terms)) if (v) cleanText(v, 600);
        }
        if (b.save)
          await repository.change(workspace, (w) => {
            sessionFor(w, token, clock);
            const row = w.pricing.find((x) => x.id === b.id);
            if (!row) throw error(404, "Modalidade não encontrada.");
            row.costs = b.costs;
            if (b.terms) row.terms = b.terms;
            row.version++;
            row.approved = false;
            audit(w, user, "pricing.draft.saved", null, {
              id: row.id,
              version: row.version,
            });
          });
        return json({ calculation: result, approved: false });
      }
      const b = await parseBody(req);
      let generatedPdf;
      if (op === "contract-create") {
        const c = allowCase(record.value, user, b.caseId);
        const { service, variant } = serviceFor(c.serviceId, c.variantId);
        generatedPdf = await renderPdf(
          [
            [
              "Minuta de teste - sem validade juridica",
              "Documento gerado para simulacao. Sem assinatura, cobranca ou preco aprovado.",
            ],
            [
              "Partes",
              `PINCIO Assessoria Internacional - dados empresariais pendentes de revisao. Cliente: ${record.value.users.find((x) => x.id === c.ownerId).name}. Identidade sintetica.`,
            ],
            ["Objeto", `${service.name} - ${variant.name}`],
            ["Entregas", variant.deliveries.map(pdfSafe).join("\n")],
            ["Limites", variant.exclusions.map(pdfSafe).join("\n")],
            ["Vigencia privada", pdfSafe(variant.period)],
            [
              "Valor e forma de pagamento",
              "PENDENTES DE APROVACAO. Nenhum valor e devido por esta simulacao. Taxas oficiais e terceiros separados.",
            ],
            [
              "Dados e encerramento",
              "Contas e atos pessoais permanecem com o titular. Regras sujeitas a revisao juridica; nenhum prazo universal de guarda. Relatorio final e continuidade somente mediante nova avaliacao.",
            ],
          ],
          new Date(clock()),
        );
      }
      const result = await repository.change(workspace, (w) => {
        const { user: actor } = sessionFor(w, token, clock); // re-authorize against the committed state
        if (op === "logout") {
          w.sessions = w.sessions.filter((s) => s.hash !== digest(token));
          audit(w, actor, "auth.logout");
          return { logout: true };
        }
        if (op === "draft-save") {
          fieldset(b, ["serviceId", "variantId", "answers"]);
          serviceFor(b.serviceId, b.variantId);
          validateAnswers(b.answers, { partial: true });
          w.drafts ??= {};
          w.drafts[actor.id] = { ...b, savedAt: nowISO(clock) };
          audit(w, actor, "draft.saved");
          return { saved: true };
        }
        if (op === "case-create") {
          fieldset(b, ["serviceId", "variantId", "answers", "ownerId"]);
          const { service, variant } = serviceFor(b.serviceId, b.variantId);
          const answers = validateAnswers(b.answers);
          if (w.cases.length >= 10)
            throw error(409, "Limite de dez casos sintéticos deste ambiente.");
          const ownerId = staff(actor) ? b.ownerId : actor.id;
          const owner = w.users.find(
            (x) => x.id === ownerId && x.role === "customer",
          );
          if (!owner) throw error(422, "Selecione um cliente deste ambiente.");
          const j = w.users.find((x) => x.role === "jennifer"),
            ro = w.users.find((x) => x.role === "rodrigo");
          const days =
            b.serviceId === "IT-01"
              ? b.variantId === "passaporte-primeira"
                ? 180
                : 60
              : service.days;
          const c = {
            id: randomUUID(),
            ownerId,
            serviceId: service.id,
            variantId: variant.id,
            answers,
            status: "triagem",
            assignedTo: service.id === "IT-03" ? ro.id : j.id,
            reviewerId: service.id === "IT-03" ? j.id : ro.id,
            createdAt: nowISO(clock),
            t0: null,
            days,
            dueAt: null,
            documents: [],
            requirements: [],
            authorizations: [],
            contracts: [],
            payments: [],
            optIn: false,
            nextFollowup: null,
            triage:
              answers.region.toLocaleLowerCase("pt-BR").includes("são paulo") ||
              answers.region.toUpperCase() === "SP"
                ? "Revisão humana de escopo/permissões pendente"
                : "Fora de SP: avaliação antes de aceitação",
            commercialReleased: false,
          };
          if (w.drafts) delete w.drafts[actor.id];
          w.cases.push(c);
          audit(w, actor, "case.created", c.id, { serviceId: c.serviceId });
          return { id: c.id };
        }
        const c = allowCase(w, actor, b.caseId);
        if (op !== "disposal") requireOpen(c);
        if (op === "case-save") {
          fieldset(b, ["caseId", "answers", "optIn"]);
          if (b.answers) {
            c.answers = {
              ...c.answers,
              ...validateAnswers(b.answers, { partial: true }),
            };
            if (["preparado", "acompanhamento"].includes(c.status))
              c.status = "pendencias";
          }
          if (b.optIn !== undefined) {
            if (typeof b.optIn !== "boolean")
              throw error(422, "Opt-in inválido.");
            c.optIn = b.optIn;
            c.optInAt = nowISO(clock);
            if (!b.optIn)
              for (const t of w.tasks.filter(
                (t) => t.caseId === c.id && t.type === "followup",
              ))
                t.status = "cancelada";
          }
          audit(w, actor, "case.saved", c.id, { optIn: c.optIn });
          return { id: c.id };
        }
        if (op === "case-note") {
          fieldset(b, ["caseId", "note", "requestHuman"]);
          const note = {
            id: randomUUID(),
            actor: actor.id,
            at: nowISO(clock),
            text: cleanText(b.note, 400),
            requestHuman: b.requestHuman === true,
          };
          c.responses ??= [];
          if (c.responses.length >= 40)
            throw error(409, "Limite de registros deste teste.");
          c.responses.push(note);
          if (!staff(actor)) {
            c.lastCustomerAt = nowISO(clock);
            for (const task of w.tasks.filter(
              (t) =>
                t.caseId === c.id &&
                t.type === "followup" &&
                t.status === "aberta",
            ))
              task.status = "pausada";
          }
          if (note.requestHuman)
            w.tasks.push({
              id: randomUUID(),
              caseId: c.id,
              title: "Cliente solicita atendimento humano",
              assignedTo: c.assignedTo,
              type: "human",
              status: "aberta",
              customerVisible: true,
            });
          audit(w, actor, "case.note.recorded", c.id, {
            requestHuman: note.requestHuman,
          });
          return { id: note.id };
        }
        if (op === "case-status") {
          requireStaff(actor);
          fieldset(b, ["caseId", "status", "note"]);
          if (!states.includes(b.status)) throw error(422, "Estado inválido.");
          if (b.status === "acompanhamento" && c.status !== "preparado")
            throw error(409, "Prepare o dossiê antes do acompanhamento.");
          if (
            b.status === "preparado" &&
            (c.requirements.some(
              (r) =>
                !c.documents.some(
                  (d) =>
                    d.requirementId === r.id &&
                    !d.deleted &&
                    d.second?.result === "approved",
                ),
            ) ||
              !c.documents.length ||
              c.documents.some(
                (d) => !d.deleted && d.second?.result !== "approved",
              ))
          )
            throw error(
              409,
              "Conclua pendências e duas conferências antes de preparar.",
            );
          if (closed.has(b.status) && !b.note?.trim())
            throw error(
              422,
              "Registre entregas, pendências e próximos passos no encerramento.",
            );
          c.status = b.status;
          if (closed.has(c.status) || c.status === "pausado")
            for (const task of w.tasks.filter(
              (t) => t.caseId === c.id && t.status !== "concluida",
            ))
              task.status = "pausada";
          c.closure = b.note ? cleanText(b.note, 800) : c.closure;
          audit(w, actor, "case.status", c.id, { status: c.status });
          return { status: c.status };
        }
        if (op === "operations") {
          requireStaff(actor);
          fieldset(b, [
            "caseId",
            "scopeAccepted",
            "minimumReceived",
            "protocolDate",
            "externalBatchDate",
            "round",
            "companyError",
            "note",
          ]);
          if (b.scopeAccepted === true) c.scopeAcceptedAt = nowISO(clock);
          if (b.minimumReceived === true) c.minimumReceivedAt = nowISO(clock);
          if (!c.t0 && c.scopeAcceptedAt && c.minimumReceivedAt) {
            c.t0 = nowISO(clock);
            c.dueAt = new Date(clock() + c.days * 86400000).toISOString();
          }
          for (const field of ["protocolDate", "externalBatchDate"])
            if (b[field]) {
              if (
                !Number.isFinite(Date.parse(b[field])) ||
                Date.parse(b[field]) > clock()
              )
                throw error(422, "Data informada inválida.");
              if (field === "protocolDate" && c.serviceId !== "IT-02")
                throw error(
                  422,
                  "Protocolo de acompanhamento reservado ao AIRE.",
                );
              if (
                field === "externalBatchDate" &&
                c.variantId !== "documental-completo"
              )
                throw error(
                  422,
                  "Lote externo reservado à organização completa.",
                );
              c[field] = new Date(b[field]).toISOString();
              c.followUntil = new Date(
                Date.parse(b[field]) +
                  (field === "protocolDate" ? 180 : 60) * 86400000,
              ).toISOString();
            }
          if (b.round) {
            if (!b.note) throw error(422, "Descreva a rodada.");
            if (!b.companyError && (c.rounds || 0) >= 2)
              throw error(
                409,
                "Revisões do mesmo escopo esgotadas; avaliar continuidade.",
              );
            if (!b.companyError) c.rounds = (c.rounds || 0) + 1;
          }
          audit(w, actor, "operations.recorded", c.id, {
            rounds: c.rounds || 0,
            companyError: b.companyError === true,
            note: b.note ? cleanText(b.note, 400) : "",
          });
          return {
            t0: c.t0,
            dueAt: c.dueAt,
            followUntil: c.followUntil,
            rounds: c.rounds || 0,
          };
        }
        if (op === "requirement") {
          requireStaff(actor);
          fieldset(b, ["caseId", "label"]);
          if (c.requirements.length >= 20)
            throw error(409, "Limite de pendências.");
          const requirement = {
            id: randomUUID(),
            label: cleanText(b.label, 100),
            createdAt: nowISO(clock),
          };
          c.requirements.push(requirement);
          audit(w, actor, "requirement.added", c.id, { id: requirement.id });
          return requirement;
        }
        if (op === "upload") {
          fieldset(b, ["caseId", "name", "content", "requirementId"]);
          if (typeof b.content !== "string" || b.content.length > 90000)
            throw error(413, "Arquivo acima do limite.");
          const bytes = Buffer.from(b.content, "base64");
          if (!bytes.equals(fixture))
            throw error(
              422,
              "Ambiente sintético: utilize somente o arquivo de teste fornecido. Documentos reais estão bloqueados.",
            );
          if (c.documents.length >= 15)
            throw error(409, "Limite de documentos de teste.");
          if (
            b.requirementId &&
            !c.requirements.some((x) => x.id === b.requirementId)
          )
            throw error(422, "Pendência inválida.");
          const doc = {
            id: randomUUID(),
            name: cleanText(b.name, 80),
            hash: digest(bytes),
            content: bytes.toString("base64"),
            requirementId: b.requirementId || null,
            status: "recebido",
            first: null,
            second: null,
            createdAt: nowISO(clock),
            folder: `${w.id}/${c.id}/recebidos`,
            deleted: false,
          };
          if (["preparado", "acompanhamento"].includes(c.status))
            c.status = "conferencia";
          c.documents.push(doc);
          audit(w, actor, "document.received", c.id, {
            documentId: doc.id,
            hash: doc.hash,
          });
          return { id: doc.id };
        }
        if (op === "review") {
          requireStaff(actor);
          fieldset(b, ["caseId", "documentId", "result", "note"]);
          const doc = c.documents.find(
            (x) => x.id === b.documentId && !x.deleted,
          );
          if (!doc) throw error(404, "Documento não encontrado.");
          if (!["approved", "correction"].includes(b.result))
            throw error(422, "Resultado inválido.");
          const firstRole = c.serviceId === "IT-03" ? "rodrigo" : "jennifer",
            secondRole = c.serviceId === "IT-03" ? "jennifer" : "rodrigo";
          const review = {
            actor: actor.id,
            role: actor.role,
            at: nowISO(clock),
            result: b.result,
            note: b.note ? cleanText(b.note, 400) : "",
          };
          if (!doc.first || doc.first.result === "correction") {
            if (actor.role !== firstRole)
              throw error(403, "Primeira conferência pelo executor definido.");
            doc.first = review;
            doc.second = null;
            doc.status =
              b.result === "approved" ? "aguardando_segunda" : "correcao";
          } else {
            if (actor.role !== secondRole || doc.first.actor === actor.id)
              throw error(
                403,
                "Segunda conferência exige outra pessoa, no papel definido.",
              );
            doc.second = review;
            doc.status = b.result === "approved" ? "conferido" : "correcao";
            if (b.result === "correction") {
              doc.first = null;
              doc.second = null;
            }
          }
          (doc.reviews ??= []).push(review);
          audit(w, actor, "document.reviewed", c.id, {
            documentId: doc.id,
            result: b.result,
            role: actor.role,
          });
          return { status: doc.status };
        }
        if (op === "authorization") {
          fieldset(b, ["caseId", "purpose", "recipient"]);
          const a = {
            id: randomUUID(),
            purpose: cleanText(b.purpose, 180),
            recipient: cleanText(b.recipient, 100),
            actor: actor.id,
            at: nowISO(clock),
            status: "registrada_para_revisao",
            officialPermissionVerified: false,
          };
          c.authorizations.push(a);
          audit(w, actor, "authorization.recorded", c.id, { id: a.id });
          return a;
        }
        if (op === "disposal") {
          requireAdmin(actor);
          fieldset(b, ["caseId", "documentId", "policy", "reason"]);
          const doc = c.documents.find((x) => x.id === b.documentId);
          if (!doc) throw error(404, "Documento não encontrado.");
          const policy = cleanText(b.policy, 100),
            reason = cleanText(b.reason, 200);
          doc.content = "";
          doc.deleted = true;
          doc.status = "eliminado";
          doc.disposal = { policy, reason, actor: actor.id, at: nowISO(clock) };
          audit(w, actor, "document.disposed", c.id, {
            documentId: doc.id,
            policy,
          });
          return { deleted: true };
        }
        if (op === "task-create") {
          requireStaff(actor);
          fieldset(b, ["caseId", "title", "assignedTo", "dueAt"]);
          if (w.tasks.length >= 100) throw error(409, "Limite de tarefas.");
          if (!w.users.some((x) => x.id === b.assignedTo && staff(x)))
            throw error(422, "Responsável inválido.");
          const task = {
            id: randomUUID(),
            caseId: c.id,
            title: cleanText(b.title, 120),
            assignedTo: b.assignedTo,
            dueAt:
              b.dueAt && Number.isFinite(Date.parse(b.dueAt))
                ? new Date(b.dueAt).toISOString()
                : null,
            status: "aberta",
            type: "manual",
            customerVisible: false,
          };
          w.tasks.push(task);
          audit(w, actor, "task.created", c.id, { taskId: task.id });
          return task;
        }
        if (op === "task-update") {
          requireStaff(actor);
          fieldset(b, ["caseId", "taskId", "status"]);
          const task = w.tasks.find(
            (x) => x.id === b.taskId && x.caseId === c.id,
          );
          if (!task) throw error(404, "Tarefa não encontrada.");
          if (!["aberta", "concluida", "pausada"].includes(b.status))
            throw error(422, "Estado inválido.");
          task.status = b.status;
          audit(w, actor, "task.updated", c.id, {
            taskId: task.id,
            status: task.status,
          });
          return task;
        }
        if (op === "agent") {
          requireStaff(actor);
          if (c.status === "pausado" || closed.has(c.status))
            throw error(
              409,
              "Sem follow-up para atendimento pausado/encerrado.",
            );
          const pending = c.requirements.filter(
            (r) =>
              !c.documents.some(
                (d) =>
                  d.requirementId === r.id &&
                  !d.deleted &&
                  d.second?.result === "approved",
              ),
          );
          const key = digest(
            [
              c.id,
              Math.floor(
                clock() /
                  ((c.serviceId === "IT-02" && c.protocolDate
                    ? 30
                    : c.variantId === "passaporte-renovacao" ||
                        c.serviceId === "IT-03"
                      ? 7
                      : 15) *
                    86400000),
              ),
              pending.map((x) => x.id).join(","),
              c.optIn,
            ].join(":"),
          );
          const previous = w.tasks.find((x) => x.dedupKey === key);
          if (previous) return { task: previous, duplicate: true };
          const recentlyAnswered =
            c.lastCustomerAt &&
            clock() - Date.parse(c.lastCustomerAt) < 86400000;
          const contact = c.optIn && pending.length > 0 && !recentlyAnswered;
          const owner = w.users.find((x) => x.id === c.ownerId);
          const task = {
            id: randomUUID(),
            caseId: c.id,
            title: recentlyAnswered
              ? "Revisar resposta recente do cliente"
              : !pending.length
                ? "Revisar conclusão e próximos passos"
                : contact
                  ? "Revisar sugestão de follow-up"
                  : "Revisar pendências e autorização de contato",
            assignedTo: c.assignedTo,
            dueAt: nowISO(clock),
            type: "followup",
            status: "aberta",
            customerVisible: false,
            dedupKey: key,
            message: contact
              ? `Olá, ${owner.name}. Seu atendimento tem ${pending.length} pendência(s) documental(is). Confira a lista pelo canal autenticado. Não envie senhas ou códigos.`
              : null,
            engine: "regras locais; sem chamada a LLM",
            humanReviewRequired: true,
            sent: false,
          };
          w.tasks.push(task);
          audit(w, actor, "agent.suggested", c.id, {
            taskId: task.id,
            pending: pending.length,
            optIn: c.optIn,
          });
          return { task, duplicate: false };
        }
        if (op === "contract-create") {
          fieldset(b, ["caseId"]);
          if (c.contracts.length >= 5)
            throw error(409, "Limite de minutas por demonstração.");
          const contract = {
            id: randomUUID(),
            caseId: c.id,
            status: "minuta_simulada",
            provider: "simulator",
            templateVersion: "platform-v1-juridico-pendente",
            scopeVersion: c.variantId,
            amountCents: null,
            pdf: generatedPdf.toString("base64"),
            hash: digest(generatedPdf),
            createdAt: nowISO(clock),
            envelopeId: null,
          };
          c.contracts.push(contract);
          audit(w, actor, "contract.draft", c.id, {
            contractId: contract.id,
            hash: contract.hash,
          });
          return { id: contract.id, hash: contract.hash };
        }
        if (op === "contract-action") {
          fieldset(b, ["caseId", "contractId", "action", "hash"]);
          const contract = c.contracts.find((x) => x.id === b.contractId);
          if (!contract) throw error(404, "Minuta não encontrada.");
          if (contract.status === "assinado_simulado" && b.action !== "sign")
            throw error(
              409,
              "Assinatura simulada já concluída; histórico preservado.",
            );
          if (b.hash !== contract.hash)
            throw error(
              409,
              "A versão da minuta mudou. Confira o PDF novamente.",
            );
          if (b.action === "invite") {
            if (contract.status === "aguardando_assinatura_simulada")
              return { duplicate: true, status: contract.status };
            if (contract.status !== "minuta_simulada")
              throw error(409, "Estado não permite convite.");
            contract.envelopeId = randomUUID();
            contract.status = "aguardando_assinatura_simulada";
            contract.invitation = {
              mode: "internal-simulator",
              emailSent: false,
            };
          } else if (b.action === "sign") {
            if (actor.id !== c.ownerId)
              throw error(
                403,
                "Somente o cliente do caso simula sua assinatura.",
              );
            if (contract.status !== "aguardando_assinatura_simulada")
              throw error(409, "Simule o convite antes da assinatura.");
            contract.status = "assinado_simulado";
          } else if (b.action === "cancel") {
            if (contract.status === "assinado_simulado")
              throw error(409, "Minuta já assinada no simulador.");
            contract.status = "cancelado_simulado";
          } else if (b.action === "fail") {
            requireStaff(actor);
            contract.status = "falha_simulada";
          } else throw error(422, "Ação de assinatura inválida.");
          audit(w, actor, "contract." + b.action + ".simulated", c.id, {
            contractId: contract.id,
            hash: contract.hash,
          });
          return {
            status: contract.status,
            simulated: true,
            externalMessageSent: false,
          };
        }
        if (op === "payment") {
          requireStaff(actor);
          fieldset(b, [
            "caseId",
            "method",
            "amount",
            "action",
            "idempotencyKey",
          ]);
          if (
            !["pix", "card"].includes(b.method) ||
            !["create", "paid", "failed", "cancel"].includes(b.action)
          )
            throw error(422, "Simulação inválida.");
          if (
            typeof b.idempotencyKey !== "string" ||
            b.idempotencyKey.length < 12 ||
            b.idempotencyKey.length > 100
          )
            throw error(422, "Informe identificador idempotente.");
          const amount = Number(b.amount);
          if (!Number.isInteger(amount) || amount <= 0 || amount > 100000000)
            throw error(
              422,
              "Valor de teste em centavos obrigatório; não é preço aprovado.",
            );
          let payment = c.payments.find((x) => x.key === b.idempotencyKey);
          if (
            payment &&
            (payment.amountCents !== amount || payment.method !== b.method)
          )
            throw error(409, "Chave já usada para outra simulação.");
          if (!payment && b.action !== "create")
            throw error(409, "Crie a simulação antes de mudar seu estado.");
          if (
            payment &&
            ["cancelado_simulado", "falha_simulada"].includes(payment.status)
          )
            throw error(409, "Simulação terminal; crie uma nova tentativa.");
          if (!payment) {
            payment = {
              id: randomUUID(),
              key: b.idempotencyKey,
              amountCents: amount,
              method: b.method,
              status: "pendente_simulado",
              createdAt: nowISO(clock),
              source: "valor de teste manual; não é preço do catálogo",
              realCharge: false,
            };
            c.payments.push(payment);
          }
          if (payment.status === "pago_simulado" && b.action !== "paid")
            throw error(409, "Pagamento simulado conciliado é terminal.");
          if (b.action === "paid") payment.status = "pago_simulado";
          if (b.action === "failed") payment.status = "falha_simulada";
          if (b.action === "cancel") payment.status = "cancelado_simulado";
          audit(w, actor, "payment." + b.action + ".simulated", c.id, {
            paymentId: payment.id,
            status: payment.status,
          });
          return {
            ...payment,
            receipt:
              payment.status === "pago_simulado"
                ? `COMPROVANTE DE SIMULACAO ${payment.id} - SEM COBRANCA REAL`
                : null,
          };
        }
        if (op === "send" || op === "release" || op === "charge")
          throw error(
            403,
            "Envios, liberação comercial e cobranças reais estão bloqueados no servidor.",
          );
        throw error(404, "Operação não encontrada.");
      });
      if (result.logout)
        return json({ ok: true }, 200, {
          "Set-Cookie": `${cookieName(secure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`,
        });
      return json(result);
    } catch (e) {
      if (
        e.status === 401 &&
        req.method === "GET" &&
        url.searchParams.get("op") === "session"
      )
        return json({ authenticated: false });
      const status = e.status || 503;
      if (!e.status)
        console.error(
          JSON.stringify({ requestId, error: "platform_operation_failed" }),
        );
      return json(
        {
          error: e.status
            ? e.message
            : "Operação indisponível. Recarregue e tente novamente.",
          requestId,
        },
        status,
      );
    }
  }
  return handler;
}
