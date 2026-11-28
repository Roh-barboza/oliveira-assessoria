import { createLeadHandler } from "../leads/intake.mjs";
import { sheetsCall, sheetsConfigured } from "./sheets.mjs";

export function handlePublicIntake(request, env, allowedOrigins) {
  const enabled = env.PINCIO_LEADS_ENABLED === "1" && sheetsConfigured(env);
  const store = enabled ? {
    async save(payload) {
      try {
        return await sheetsCall({ actor: "public", action: "intake", data: payload }, env);
      } catch (error) {
        if (error.status === 429) return { limited: true };
        throw error;
      }
    },
  } : null;
  return createLeadHandler({ store, allowedOrigins })(request);
}
