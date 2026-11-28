import { handleCrm } from "./http.mjs";
import { handlePublicIntake } from "./public-intake.mjs";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/crm") return handleCrm(request, env);
    if (pathname === "/api/leads") return handlePublicIntake(request, env, new Set([env.PINCIO_CRM_ORIGIN]));
    if (pathname.startsWith("/api/")) return new Response(null, { status: 404 });
    const asset = pathname === "/" ? new Request(new URL("/index.html", request.url), request) : request;
    const response = await env.ASSETS.fetch(asset);
    if (pathname !== "/crm.html") return response;
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store, private");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
    return new Response(response.body, { status: response.status, headers });
  },
};
