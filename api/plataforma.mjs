import { randomBytes } from "node:crypto";
import { createApp } from "../server/platform/app.mjs";
import {
  StateRepository,
  MemoryStore,
  BlobStore,
  PostgresStore,
} from "../server/platform/store.mjs";
let instance;
async function runtime() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !==
      "feature/plataforma-operacional-preview"
  )
    return createApp({ production: true });
  const mode = process.env.OLIVEIRA_PLATFORM_STORE || "temporario";
  let store,
    key = process.env.OLIVEIRA_DATA_KEY;
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
  } else if (mode === "temporario") {
    store = new MemoryStore();
    key = randomBytes(32).toString("hex");
  } else throw Error("Modo indisponível");
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
