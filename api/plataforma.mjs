import { createApp } from "../server/platform/app.mjs";
import {
  StateRepository,
  BlobStore,
  PostgresStore,
} from "../server/platform/store.mjs";

// Synthetic simulator is isolated by Preview environment and branch even
// when hosted in the existing Vercel project. Never enable it in production.
const SITE_PROJECT_ID = "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
const PREVIEW_BRANCH = "feature/plataforma-operacional-preview";
let instance;
async function runtime() {
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
