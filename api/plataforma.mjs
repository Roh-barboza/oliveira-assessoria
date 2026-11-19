import { createApp } from "../server/platform/app.mjs";
import {
  StateRepository,
  BlobStore,
  PostgresStore,
} from "../server/platform/store.mjs";

// A preview deployment from the original site must never access this store.
// The project ID is a second application-level gate, not a Blob IAM restriction.
const PREVIEW_PROJECT_ID = "prj_IB4FPuQ8CWkSS0VjZvIQsq3kE2Ie";
const PREVIEW_BRANCH = "feature/plataforma-operacional-preview";
let instance;
async function runtime() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_PROJECT_ID !== PREVIEW_PROJECT_ID ||
    process.env.VERCEL_GIT_COMMIT_REF !== PREVIEW_BRANCH
  )
    return createApp({ production: true });
  const mode = process.env.OLIVEIRA_PLATFORM_STORE;
  const key = process.env.OLIVEIRA_DATA_KEY;
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
    throw Error("Persistência remota obrigatória no projeto isolado");
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
