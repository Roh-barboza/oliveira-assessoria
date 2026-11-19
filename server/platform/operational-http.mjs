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

export function createOperationalHttp({ authentication, accounts, allowedOrigin, networkIdentity }) {
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
      return response({ error: "Operação não encontrada." }, 404);
    } catch {
      return response({ error: "Operação indisponível." }, 503);
    }
  };
}
