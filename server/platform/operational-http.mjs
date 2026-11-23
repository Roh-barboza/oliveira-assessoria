// Isolated operational HTTP transport. No demo accounts or client records.
// Never expose this without a dedicated database, validated reverse proxy,
// HTTPS, production configuration and rehearsed recovery.
const COOKIE_NAME = "__Host-oliveira-ops";
const baseHeaders = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};
const genericError = { error: "Credenciais inválidas ou acesso indisponível." };
const validCookie = (token) => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

function cookieFrom(request) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [key, ...pieces] = part.trim().split("=");
    if (key === COOKIE_NAME) return pieces.join("=");
  }
  return null;
}
function response(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { ...baseHeaders, ...extra } });
}
function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Secure; HttpOnly; Path=/; SameSite=Strict; Max-Age=3600`;
}
function clearCookie() {
  return `${COOKIE_NAME}=; Secure; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`;
}
async function readBody(req) {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return null;
  const contentLength = req.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 4096))
    return null;
  let size = 0;
  const parts = [];
  for await (const part of req.body || []) {
    size += part.length;
    if (size > 4096) return null;
    parts.push(part);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function createOperationalHttp({ authentication, accounts, cases = null, contracts = null, allowedOrigin, networkIdentity }) {
  if (!authentication?.login || !accounts?.getSession || !accounts?.revoke ||
      typeof networkIdentity !== "function" ||
      typeof allowedOrigin !== "string" ||
      !/^https:\/\/[^/]+$/.test(allowedOrigin))
    throw new Error("Transporte operacional não configurado.");
  return async function handler(request) {
    try {
      const url = new URL(request.url);
      const op = url.searchParams.get("op") || "session";
      if (url.origin !== allowedOrigin)
        return response({ error: "Origem não autorizada." }, 403);
      if (request.method !== "GET" && request.method !== "POST")
        return response({ error: "Método não permitido." }, 405);
      if (request.method === "POST" &&
        (request.headers.get("origin") !== allowedOrigin ||
         request.headers.get("sec-fetch-site") === "cross-site"))
        return response({ error: "Origem não autorizada." }, 403);
      if (op === "session" && request.method === "GET") {
        const token = cookieFrom(request);
        const account = validCookie(token) ? await accounts.getSession(token) : null;
        return response(account
          ? { authenticated: true, user: {
              id: account.id, name: account.name, email: account.email, role: account.role,
            } }
          : { authenticated: false });
      }
      if (op === "login" && request.method === "POST") {
        const body = await readBody(request);
        if (!body || Object.keys(body).some((key) => !["email","password","code"].includes(key)) ||
            typeof body.email !== "string" || typeof body.password !== "string" ||
            typeof body.code !== "string" || body.email.length > 254 ||
            body.password.length > 1024 || !/^\d{6}$/.test(body.code))
          return response(genericError, 401);
        // Network identity MUST be provided by a trusted Vercel proxy adapter,
        // not taken from a client-controlled header.
        const network = networkIdentity(request);
        if (typeof network !== "string" || !network || network.length > 128)
          return response({ error: "Proteção de acesso indisponível." }, 503);
        const outcome = await authentication.login({
          email: body.email, password: body.password, code: body.code,
          trustedNetworkAddress: network,
        });
        if (!outcome.authenticated) return response(genericError,
          outcome.retryAfterSeconds ? 429 : 401,
          outcome.retryAfterSeconds ? { "Retry-After": String(outcome.retryAfterSeconds) } : {});
        return response({ authenticated: true },
          200, { "Set-Cookie": sessionCookie(outcome.session.token) });
      }
      if (op === "logout" && request.method === "POST") {
        const token = cookieFrom(request);
        if (validCookie(token)) await accounts.revoke(token);
        return response({ authenticated: false }, 200, { "Set-Cookie": clearCookie() });
      }
      if (["contract-ready", "contract-connection", "contract-install", "contract-list",
           "contract-create", "contract-preview", "contract-approve",
           "contract-send", "contract-refresh"].includes(op)) {
        if (!contracts?.ready || !contracts?.setup || !contracts?.create ||
            !contracts?.approve || !contracts?.send || !contracts?.refresh)
          return response({ error: "Contratos indisponíveis." }, 503);
        const token = cookieFrom(request);
        const account = validCookie(token) ? await accounts.getSession(token) : null;
        if (!account) return response({ error: "Autenticação necessária." }, 401);
        if (account.role !== "admin")
          return response({ error: "Acesso negado." }, 403);
        if (op === "contract-ready" && request.method === "GET")
          return response({ contracts: await contracts.ready(account.id) });
        if (op === "contract-connection" && request.method === "GET")
          return response({ check: await contracts.connection(account.id) });
        if (op === "contract-install" && request.method === "POST") {
          const body = await readBody(request);
          if (body?.acknowledge !== "SANDBOX_SOMENTE" ||
              Object.keys(body).length !== 1)
            return response({ error: "Confirmação de ambiente necessária." }, 422);
          return response({ contracts: await contracts.setup(account.id) });
        }
        if (op === "contract-list" && request.method === "GET")
          return response({ contracts: await contracts.list(
            account.id, url.searchParams.get("caseId")) });
        if (op === "contract-preview" && request.method === "GET")
          return response({ document: await contracts.pdf(
            account.id,url.searchParams.get("id"),url.searchParams.get("signed")==="1") });
        if (request.method !== "POST")
          return response({ error: "Método não permitido." }, 405);
        const body = await readBody(request);
        if (!body || typeof body !== "object")
          return response({ error: "Campos inválidos." }, 422);
        const expectedFields = {
          "contract-create":["caseId"],
          "contract-approve":["id","version"],
          "contract-send":["id","version","confirm"],
          "contract-refresh":["id"],
        }[op];
        if (!expectedFields || Object.keys(body).some(k=>!expectedFields.includes(k)) ||
            expectedFields.some(k=>!(k in body)))
          return response({ error: "Campos inválidos." }, 422);
        if (op === "contract-create")
          return response({ contract: await contracts.create(account.id,body.caseId) }, 201);
        if (op === "contract-approve")
          return response({ contract: await contracts.approve(
            account.id,body.id,body.version) });
        if (op === "contract-send")
          return response({ contract: await contracts.send(
            account.id,body.id,body.version,body.confirm) });
        return response({ contract: await contracts.refresh(account.id,body.id) });
      }
      if (["case-list", "case-get", "case-create", "case-status"].includes(op)) {
        // Case endpoints are opt-in and unavailable until attached to the dedicated
        // production database. No synthetic account or anonymous access is accepted.
        if (!cases?.list || !cases?.get || !cases?.create || !cases?.changeStatus)
          return response({ error: "Atendimentos indisponíveis." }, 503);
        const token = cookieFrom(request);
        const account = validCookie(token) ? await accounts.getSession(token) : null;
        if (!account) return response({ error: "Autenticação necessária." }, 401);
        if (op === "case-list" && request.method === "GET") {
          const limitValue = url.searchParams.get("limit");
          if (limitValue !== null && !/^[1-9][0-9]{0,2}$/.test(limitValue))
            return response({ error: "Limite inválido." }, 422);
          const limit = limitValue === null ? 50 : Number(limitValue);
          if (limit > 100) return response({ error: "Limite inválido." }, 422);
          return response({ cases: await cases.list(account.id, { limit }) });
        }
        if (op === "case-get" && request.method === "GET") {
          const id = url.searchParams.get("id");
          const item = await cases.get(account.id, id);
          return item ? response({ case: item }) :
            response({ error: "Solicitação não encontrada." }, 404);
        }
        if (op === "case-create" && request.method === "POST") {
          const body = await readBody(request);
          if (!body || Object.keys(body).some((key) =>
            !["title","service","notes","assignedTo"].includes(key)))
            return response({ error: "Campos inválidos." }, 422);
          const item = await cases.create(account.id, body);
          return response({ case: item }, 201);
        }
        if (op === "case-status" && request.method === "POST") {
          const body = await readBody(request);
          if (!body || Object.keys(body).some((key) =>
            !["id","nextStatus","expectedVersion"].includes(key)) ||
            typeof body.id !== "string")
            return response({ error: "Campos inválidos." }, 422);
          const item = await cases.changeStatus(account.id, body.id, body);
          return response({ case: item });
        }
        return response({ error: "Método não permitido." }, 405);
      }
      return response({ error: "Operação não encontrada." }, 404);
    } catch (error) {
      // Do not disclose database or cryptographic details in HTTP responses.
      const status = [403, 404, 409, 422].includes(error?.status) ? error.status : 503;
      return response({ error: status === 503 ? "Operação indisponível." :
        status === 403 ? "Acesso negado." :
        status === 404 ? "Solicitação não encontrada." :
        status === 409 ? "Conflito de atualização." : "Dados inválidos." }, status);
    }
  };
}
