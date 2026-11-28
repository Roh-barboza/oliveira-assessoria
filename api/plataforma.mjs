import { createApp } from "../server/platform/app.mjs";
import {
  StateRepository,
  BlobStore,
  PostgresStore,
  MemoryStore,
} from "../server/platform/store.mjs";
import { randomBytes } from "node:crypto";

// Synthetic simulator is isolated by project and explicitly approved release.
// Real operational data is never accessible through this API.
const SITE_PROJECT_ID = "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
const PREVIEW_BRANCH = "feature/plataforma-operacional-preview";
let instance;
async function runtime() {
  // Explicit, short-lived PUBLIC DEMO on the approved production release.
  // Synthetic data only; no database, Blob, real document intake or provider calls.
  // Every serverless instance holds independent volatile state and may reset.
  if ((process.env.VERCEL_ENV === "production" ||
       (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "release/pincio-sem-n8n-2026-11-28")) &&
      process.env.VERCEL_PROJECT_ID === SITE_PROJECT_ID &&
      ["release/site-integral-online-2026-11-24",
       "release/catalogo-servicos-2026-11-25",
       "release/pincio-identidade-2026-11-25",
       "release/pincio-sem-n8n-2026-11-28"].includes(process.env.VERCEL_GIT_COMMIT_REF)) {
    const repository = new StateRepository(
      new MemoryStore(), randomBytes(32).toString("hex"));
    return createApp({ repository, storageMode: "temporario" });
  }
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_PROJECT_ID !== SITE_PROJECT_ID ||
    process.env.VERCEL_GIT_COMMIT_REF !== PREVIEW_BRANCH ||
    process.env.OLIVEIRA_PLATFORM_PREVIEW_ACK !== "synthetic-shared-preview"
  )
    return createApp({ production: true });
  const mode = process.env.OLIVEIRA_PLATFORM_STORE;
  const key = process.env.OLIVEIRA_DATA_KEY;
  // Simulator and operational database must not share credentials.
  if (process.env.OLIVEIRA_PREVIEW_DATABASE_URL &&
      process.env.OLIVEIRA_PREVIEW_DATABASE_URL === process.env.OLIVEIRA_OPS_DATABASE_URL)
    throw Error("Bancos operacionais e sintéticos não podem compartilhar credenciais.");
  let store;
  if (mode === "blob") {
    const { get, put } = await import("@vercel/blob");
    if (!key || !process.env.BLOB_STORE_ID)
      throw Error("Persistência não configurada");
    store = new BlobStore({ get, put, storeId: process.env.BLOB_STORE_ID });
  } else if (mode === "postgres") {
    if (!key || !process.env.OLIVEIRA_PREVIEW_DATABASE_URL)
      throw Error("Persistência não configurada");
    const { Pool } = await import("pg");
    store = new PostgresStore(
      new Pool({
        connectionString: process.env.OLIVEIRA_PREVIEW_DATABASE_URL,
        max: 2,
      }),
    );
  } else {
    // Never silently create ephemeral, per-instance state on a remote Preview.
    throw Error("Persistência remota obrigatória no Preview");
  }
  return createApp({
    repository: new StateRepository(store, key),
    storageMode: store.mode,
  });
}
export default {
  async fetch(request) {
    try {
      instance ??= runtime().catch((e) => {
        instance = undefined;
        throw e;
      });
      return await (
        await instance
      )(request);
    } catch {
      return Response.json(
        {
          error:
            "Persistência indisponível. Nenhum dado foi enviado a outro provedor.",
        },
        {
          status: 503,
          headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
        },
      );
    }
  },
};
