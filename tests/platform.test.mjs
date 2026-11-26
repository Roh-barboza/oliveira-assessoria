import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp, auditValid } from "../server/platform/app.mjs";
import {
  MemoryStore,
  StateRepository,
  PostgresStore,
  BlobStore,
} from "../server/platform/store.mjs";
import { SqliteStore } from "../server/platform/sqlite.mjs";
import { calculate } from "../server/platform/pricing.mjs";
import { catalog, fixture, pricingSeed } from "../server/platform/catalog.mjs";
import { encryption, digest } from "../server/platform/security.mjs";
import { PGlite } from "@electric-sql/pglite";
import { clicksign } from "../server/platform/providers/clicksign.mjs";
const key = () => randomBytes(32).toString("hex");
async function environment(options = {}) {
  const store = new MemoryStore(),
    repository = new StateRepository(store, key());
  let now = Date.now();
  const app = createApp({ repository, clock: () => now, ...options });
  const client = () => ({
    cookie: "",
    csrf: "",
    async call(op, body, extra = {}) {
      const response = await app(
        new Request("http://local/api/plataforma?op=" + op, {
          method: body ? "POST" : "GET",
          headers: {
            origin: "http://local",
            cookie: this.cookie,
            "content-type": "application/json",
            "x-platform-csrf": this.csrf,
            ...extra,
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
      if (response.headers.get("set-cookie"))
        this.cookie = response.headers.get("set-cookie").split(";")[0];
      let data;
      if (response.headers.get("content-type")?.includes("application/json"))
        data = await response.json();
      else data = Buffer.from(await response.arrayBuffer());
      if (data.csrf) this.csrf = data.csrf;
      return { status: response.status, data, response };
    },
  });
  const admin = client(),
    created = await admin.call("demo", { acknowledge: true });
  assert.equal(created.status, 201);
  const credentials = created.data.credentials,
    workspace = created.data.workspace;
  const login = async (username) => {
    const c = client();
    const u = credentials.find((u) => u.username === username);
    assert.equal(
      (await c.call("login", { workspace, username, password: u.password }))
        .status,
      200,
    );
    return c;
  };
  const create = async (
    c = admin,
    serviceId = "IT-01",
    variantId = "passaporte-primeira",
  ) => {
    const ownerId = created.data.state.users.find(
      (u) => u.role === "customer",
    ).id;
    const r = await c.call("case-create", {
      serviceId,
      variantId,
      answers: { region: "São Paulo" },
      ...(c === admin ? { ownerId } : {}),
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data.id;
  };
  return {
    app,
    admin,
    login,
    create,
    repository,
    store,
    workspace,
    credentials,
    advance: (ms) => (now += ms),
  };
}
test("AES-GCM isolates workspaces and rejects tampering", () => {
  const c = encryption(key()),
    sealed = c.seal(Buffer.from("private"), "A");
  assert.equal(c.open(sealed, "A").toString(), "private");
  assert.throws(() => c.open(sealed, "B"));
  sealed[sealed.length - 1] ^= 1;
  assert.throws(() => c.open(sealed, "A"));
});
test("Unknown costs never become zero; all 20 rows unapproved", () => {
  const r = calculate({});
  assert.equal(r.complete, false);
  assert.equal(r.contributionCents, null);
  assert.equal(r.suggestedPriceCents, null);
  assert.equal(pricingSeed().length, 20);
  assert.ok(
    pricingSeed().every(
      (r) => !r.approved && Object.keys(r.costs).length === 0,
    ),
  );
});
test("Contribution, reverse margin, installments and external fees", () => {
  const r = calculate({
    costMode: "hours",
    hours: 2,
    hourRate: 25,
    partner: 10,
    otherVariable: 5,
    taxPercent: 10,
    gatewayPercent: 5,
    gatewayFixed: 2,
    price: 100,
    targetMargin: 20,
    installments: 3,
    financePercent: 1,
    officialFees: 500,
  });
  assert.equal(r.variableBaseCents, 6700);
  assert.equal(r.contributionCents, 1800);
  assert.equal(r.suggestedPriceCents, 10308);
  assert.deepEqual(r.installmentsCents, [3367, 3367, 3366]);
  assert.equal(r.officialFeesCents, 50000);
  assert.throws(
    () => calculate({ costMode: "hours", hours: 1, hourRate: 2, operating: 3 }),
    /duplique/,
  );
  assert.throws(() => calculate({ price: -1 }));
});
test("CAS refuses stale writes; concurrent updates preserve audit", async () => {
  const s = new MemoryStore(),
    r = new StateRepository(s, key()),
    id = randomUUID();
  await r.create(id, { n: 0 });
  await Promise.all([r.change(id, (w) => w.n++), r.change(id, (w) => w.n++)]);
  assert.equal((await r.read(id)).value.n, 2);
  assert.equal(await s.cas(id, 1, Buffer.alloc(1)), false);
});
test("SQLite survives reopening; disk does not contain cleartext", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oliveira-")),
    path = join(dir, "test.sqlite"),
    k = key(),
    id = randomUUID();
  try {
    const s = new SqliteStore(path),
      r = new StateRepository(s, k);
    await r.create(id, { secret: "documento-secreto-unico" });
    s.db.close();
    const restored = new SqliteStore(path);
    assert.equal(
      (await new StateRepository(restored, k).read(id)).value.secret,
      "documento-secreto-unico",
    );
    restored.db.close();
    assert.ok(
      !(await readFile(path)).includes(Buffer.from("documento-secreto-unico")),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Postgres migration and CAS execute on real SQL engine (PGlite)", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile("db/platform.sql", "utf8"));
    const r = new StateRepository(new PostgresStore(db), key()),
      id = randomUUID();
    await r.create(id, { n: 1 });
    await r.change(id, (w) => w.n++);
    assert.equal((await r.read(id)).value.n, 2);
  } finally {
    await db.close();
  }
});
test("Blob adapter enforces private CAS across create, update and conflicts", async () => {
  const objects = new Map();
  let etagNumber = 0;
  const error = (name) => Object.assign(new Error(name), { name });
  const store = new BlobStore({
    storeId: "test-private",
    get: async (path, options) => {
      assert.equal(options.storeId, "test-private");
      assert.equal(options.access, "private");
      assert.equal(options.useCache, false);
      const row = objects.get(path);
      return row
        ? {
            statusCode: 200,
            blob: { etag: row.etag },
            stream: new Response(row.data).body,
          }
        : null;
    },
    put: async (path, data, options) => {
      assert.equal(options.storeId, "test-private");
      assert.equal(options.access, "private");
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.contentType, "application/octet-stream");
      const current = objects.get(path);
      if (current && !options.allowOverwrite)
        throw error("BlobAlreadyExistsError");
      if (current && options.ifMatch !== current.etag)
        throw error("BlobPreconditionFailedError");
      if (!current && (options.ifMatch || options.allowOverwrite))
        throw error("BlobPreconditionFailedError");
      objects.set(path, {
        etag: `"etag-${++etagNumber}"`,
        data: Buffer.from(data),
      });
    },
  });
  const repository = new StateRepository(store, key());
  await repository.create("test-id", { n: 1 });
  const initialVersion = (await store.read("test-id")).version;
  assert.equal((await repository.read("test-id")).value.n, 1);

  await repository.change("test-id", (value) => value.n++);
  assert.equal((await repository.read("test-id")).value.n, 2);
  assert.equal(await store.cas("test-id", initialVersion, Buffer.from("old")), false);
  assert.equal(await store.cas("test-id", null, Buffer.from("duplicate")), false);

  await Promise.all([
    repository.change("test-id", (value) => value.n++),
    repository.change("test-id", (value) => value.n++),
  ]);
  assert.equal((await repository.read("test-id")).value.n, 4);
  assert.deepEqual([...objects.keys()], ["oliveira-preview-v1/test-id.enc"]);
});

test("Production runtime refuses all API operations", async () => {
  const app = createApp({ production: true });
  assert.equal(
    (await app(new Request("https://local/api/plataforma"))).status,
    404,
  );
});
test("Serverless Preview gate checks project and branch; remote storage never falls back to memory", async () => {
  const authorizedProject = "prj_M19hHqI7fq25KgKnXWIqUYRXmxhq";
  const authorizedBranch = "feature/plataforma-operacional-preview";
  const envKeys = [
    "VERCEL_ENV",
    "VERCEL_PROJECT_ID",
    "VERCEL_GIT_COMMIT_REF",
    "OLIVEIRA_PLATFORM_STORE",
    "OLIVEIRA_PLATFORM_PREVIEW_ACK",
    "OLIVEIRA_DATA_KEY",
    "BLOB_STORE_ID",
  ];
  const original = new Map(envKeys.map((k) => [k, process.env[k]]));
  let requestCount = 0;
  async function statusFor(config) {
    Object.assign(process.env, config);
    const handler = (await import(`../api/plataforma.mjs?preview-gate-${requestCount++}`))
      .default;
    return handler.fetch(
      new Request("https://preview.example.invalid/api/plataforma?op=config"),
    );
  }
  try {
    process.env.OLIVEIRA_PLATFORM_PREVIEW_ACK = "synthetic-shared-preview";
    const production = await statusFor({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_ID: authorizedProject,
      VERCEL_GIT_COMMIT_REF: authorizedBranch,
      OLIVEIRA_PLATFORM_STORE: "blob",
    });
    assert.equal(production.status, 404);

    const wrongProject = await statusFor({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_ID: "prj_unrelated_project",
      VERCEL_GIT_COMMIT_REF: authorizedBranch,
      OLIVEIRA_PLATFORM_STORE: "blob",
    });
    assert.equal(wrongProject.status, 404);

    const wrongBranch = await statusFor({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_ID: authorizedProject,
      VERCEL_GIT_COMMIT_REF: "main",
      OLIVEIRA_PLATFORM_STORE: "blob",
    });
    assert.equal(wrongBranch.status, 404);

    const missingProjectId = await statusFor({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_ID: "",
      VERCEL_GIT_COMMIT_REF: authorizedBranch,
      OLIVEIRA_PLATFORM_STORE: "blob",
    });
    assert.equal(missingProjectId.status, 404);

    const missingConsent = await statusFor({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_ID: authorizedProject,
      VERCEL_GIT_COMMIT_REF: authorizedBranch,
      OLIVEIRA_PLATFORM_STORE: "blob",
      OLIVEIRA_PLATFORM_PREVIEW_ACK: "",
    });
    assert.equal(missingConsent.status, 404);
    process.env.OLIVEIRA_PLATFORM_PREVIEW_ACK = "synthetic-shared-preview";

    delete process.env.OLIVEIRA_DATA_KEY;
    delete process.env.BLOB_STORE_ID;
    const missingCredentials = await statusFor({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_ID: authorizedProject,
      VERCEL_GIT_COMMIT_REF: authorizedBranch,
      OLIVEIRA_PLATFORM_STORE: "blob",
    });
    assert.equal(missingCredentials.status, 503);
    assert.match(
      (await missingCredentials.json()).error,
      /Persistência indisponível/,
    );

    const absentMode = await statusFor({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_ID: authorizedProject,
      VERCEL_GIT_COMMIT_REF: authorizedBranch,
      OLIVEIRA_PLATFORM_STORE: "temporario",
    });
    assert.equal(absentMode.status, 503);
    assert.match((await absentMode.json()).error, /Persistência indisponível/);
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Authentication, CSRF, cross-origin and mass-assignment guards", async () => {
  const x = await environment(),
    anon = await x.app(new Request("http://local/api/plataforma?op=state"));
  assert.equal(anon.status, 401);
  assert.equal(
    (await x.admin.call("case-create", {}, { origin: "https://evil.invalid" }))
      .status,
    403,
  );
  assert.equal(
    (await x.admin.call("case-create", {}, { "x-platform-csrf": "bad" }))
      .status,
    403,
  );
  assert.equal(
    (
      await x.admin.call("login", {
        workspace: x.workspace,
        username: "rodrigo",
        password: "bad",
      })
    ).status,
    401,
  );
  const a = await x.login("cliente-a");
  assert.equal(
    (
      await a.call("case-create", {
        serviceId: "IT-01",
        variantId: "passaporte-primeira",
        answers: { region: "SP", password: "do-not-store" },
      })
    ).status,
    422,
  );
  assert.equal((await a.call("pricing", { costs: {} })).status, 403);
});
test("Two clients cannot see each other’s cases or documents", async () => {
  const x = await environment(),
    a = await x.login("cliente-a"),
    b = await x.login("cliente-b"),
    id = await x.create(a);
  const uploaded = await a.call("upload", {
    caseId: id,
    name: "teste.txt",
    content: fixture.toString("base64"),
  });
  assert.equal(uploaded.status, 200);
  const list = await b.call("state");
  assert.equal(list.data.state.cases.length, 0);
  assert.equal(
    (await b.call("case-save", { caseId: id, optIn: true })).status,
    404,
  );
  assert.equal(
    (
      await x.app(
        new Request(
          `http://local/api/plataforma?op=download&case=${id}&id=${uploaded.data.id}`,
          { headers: { cookie: b.cookie } },
        ),
      )
    ).status,
    404,
  );
  assert.equal((await a.call("state")).data.state.pricing, undefined);
});
test("Uploads reject real files; reviews require two distinct assigned roles", async () => {
  const x = await environment(),
    id = await x.create(),
    j = await x.login("jennifer");
  assert.equal(
    (
      await x.admin.call("upload", {
        caseId: id,
        name: "real.pdf",
        content: Buffer.from("%PDF-real").toString("base64"),
      })
    ).status,
    422,
  );
  const r = await x.admin.call("requirement", {
    caseId: id,
    label: "Documento de teste",
  });
  const upload = await x.admin.call("upload", {
    caseId: id,
    name: "teste.txt",
    requirementId: r.data.id,
    content: fixture.toString("base64"),
  });
  const review = { caseId: id, documentId: upload.data.id, result: "approved" };
  assert.equal((await x.admin.call("review", review)).status, 403);
  assert.equal((await j.call("review", review)).status, 200);
  assert.equal((await j.call("review", review)).status, 403);
  assert.equal(
    (await x.admin.call("case-status", { caseId: id, status: "preparado" }))
      .status,
    409,
  );
  assert.equal((await x.admin.call("review", review)).status, 200);
  assert.equal(
    (await x.admin.call("case-status", { caseId: id, status: "preparado" }))
      .status,
    200,
  );
  const w = (await x.repository.read(x.workspace)).value;
  assert.ok(auditValid(w.audit));
  assert.equal(w.cases[0].documents[0].reviews.length, 2);
});
test("FAST IT reverses execution/review roles; deferred services rejected", async () => {
  const x = await environment(),
    id = await x.create(x.admin, "IT-03", "fast-it-avulso");
  const doc = await x.admin.call("upload", {
    caseId: id,
    name: "teste.txt",
    content: fixture.toString("base64"),
  });
  assert.equal(
    (
      await x.admin.call("review", {
        caseId: id,
        documentId: doc.data.id,
        result: "approved",
      })
    ).status,
    200,
  );
  const j = await x.login("jennifer");
  assert.equal(
    (
      await j.call("review", {
        caseId: id,
        documentId: doc.data.id,
        result: "approved",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await x.admin.call("case-create", {
        serviceId: "BR-01",
        variantId: "ir",
        answers: { region: "SP" },
      })
    ).status,
    422,
  );
});
test("T0 requires both gates; AIRE protocol sets 180-day window; revisions capped", async () => {
  const x = await environment(),
    id = await x.create(x.admin, "IT-02", "aire-inscricao");
  await x.admin.call("case-status", {
    caseId: id,
    status: "aguardando_documentos",
  });
  assert.equal((await x.admin.call("state")).data.state.cases[0].t0, null);
  const r = await x.admin.call("operations", {
    caseId: id,
    scopeAccepted: true,
    minimumReceived: true,
    protocolDate: new Date(Date.now() - 60000).toISOString(),
  });
  assert.equal(r.status, 200);
  assert.ok(r.data.t0);
  assert.ok(r.data.followUntil);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await x.admin.call("operations", {
          caseId: id,
          round: true,
          note: "Complemento de teste",
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await x.admin.call("operations", {
        caseId: id,
        round: true,
        note: "Outra rodada",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await x.admin.call("operations", {
        caseId: id,
        round: true,
        companyError: true,
        note: "Erro material da equipe",
      })
    ).data.rounds,
    2,
  );
});
test("Draft resumes after login; authorization never asserts official permission", async () => {
  const x = await environment(),
    a = await x.login("cliente-a");
  await a.call("draft-save", {
    serviceId: "IT-03",
    variantId: "fast-it-avulso",
    answers: { region: "SP", difficulty: "Teste" },
  });
  await a.call("logout", {});
  const returned = await x.login("cliente-a");
  assert.equal(
    (await returned.call("state")).data.state.draft.answers.difficulty,
    "Teste",
  );
  const id = await x.create(returned);
  const auth = await returned.call("authorization", {
    caseId: id,
    purpose: "Solicitação autorizada a avaliar",
    recipient: "Órgão de teste",
  });
  assert.equal(auth.data.officialPermissionVerified, false);
});
test("Follow-ups deduplicate, honor opt-out and stop when paused/closed", async () => {
  const x = await environment(),
    id = await x.create();
  await x.admin.call("requirement", {
    caseId: id,
    label: "Documento sintético pendente",
  });
  let r = await x.admin.call("agent", { caseId: id });
  assert.equal(r.data.task.message, null);
  await x.admin.call("case-save", { caseId: id, optIn: true });
  r = await x.admin.call("agent", { caseId: id });
  assert.ok(r.data.task.message);
  assert.equal(r.data.task.sent, false);
  assert.equal(
    (await x.admin.call("agent", { caseId: id })).data.duplicate,
    true,
  );
  await x.admin.call("case-save", { caseId: id, optIn: false });
  assert.ok(
    (await x.admin.call("state")).data.state.tasks.every(
      (t) => t.status === "cancelada",
    ),
  );
  await x.admin.call("case-status", { caseId: id, status: "pausado" });
  assert.equal((await x.admin.call("agent", { caseId: id })).status, 409);
  await x.admin.call("case-status", {
    caseId: id,
    status: "encerrado",
    note: "Teste concluído; sem entrega real; continuidade requer novo aceite.",
  });
  assert.equal((await x.admin.call("agent", { caseId: id })).status, 409);
});
test("Versioned PDF, simulator invitation/signature, signed terminal and ownership", async () => {
  const x = await environment(),
    a = await x.login("cliente-a"),
    id = await x.create(a),
    c = await x.admin.call("contract-create", { caseId: id });
  assert.equal(c.status, 200);
  const body = { caseId: id, contractId: c.data.id, hash: c.data.hash };
  const pdf = await x.app(
    new Request(
      `http://local/api/plataforma?op=contract-pdf&case=${id}&id=${c.data.id}`,
      { headers: { cookie: a.cookie } },
    ),
  );
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.equal(digest(bytes), c.data.hash);
  assert.equal(
    (await a.call("contract-action", { ...body, action: "sign" })).status,
    409,
  );
  assert.equal(
    (await x.admin.call("contract-action", { ...body, action: "invite" })).data
      .externalMessageSent,
    false,
  );
  assert.equal(
    (await x.admin.call("contract-action", { ...body, action: "invite" })).data
      .duplicate,
    true,
  );
  assert.equal(
    (await x.admin.call("contract-action", { ...body, action: "sign" })).status,
    403,
  );
  assert.equal(
    (await a.call("contract-action", { ...body, action: "sign" })).data.status,
    "assinado_simulado",
  );
  assert.equal(
    (await a.call("contract-action", { ...body, action: "cancel" })).status,
    409,
  );
});
test("Payments use idempotency, reject cross-amount reuse and terminal transitions", async () => {
  const x = await environment(),
    id = await x.create(),
    b = {
      caseId: id,
      method: "pix",
      amount: 12345,
      idempotencyKey: "test-only-key-123",
      action: "create",
    };
  assert.equal(
    (await x.admin.call("payment", { ...b, action: "paid" })).status,
    409,
  );
  const r = await x.admin.call("payment", b);
  assert.equal(r.data.realCharge, false);
  assert.equal((await x.admin.call("payment", b)).data.id, r.data.id);
  assert.equal(
    (await x.admin.call("payment", { ...b, amount: 2 })).status,
    409,
  );
  assert.equal(
    (await x.admin.call("payment", { ...b, action: "paid" })).data.status,
    "pago_simulado",
  );
  assert.equal(
    (await x.admin.call("payment", { ...b, action: "cancel" })).status,
    409,
  );
  assert.equal((await x.admin.call("charge", { caseId: id })).status, 403);
});
test("Signed simulated webhook validates HMAC and rejects duplicate/replayed cancel", async () => {
  const secret = key(),
    x = await environment({ webhookSecret: secret }),
    id = await x.create(),
    c = await x.admin.call("contract-create", { caseId: id });
  await x.admin.call("contract-action", {
    caseId: id,
    contractId: c.data.id,
    hash: c.data.hash,
    action: "invite",
  });
  const b = {
      workspace: x.workspace,
      contractId: c.data.id,
      eventId: randomUUID(),
      status: "signed",
    },
    raw = JSON.stringify(b),
    call = (signature) =>
      x.app(
        new Request("http://local/api/plataforma?op=webhook", {
          method: "POST",
          body: raw,
          headers: { "content-hmac": signature },
        }),
      );
  assert.equal((await call("bad")).status, 401);
  const signature =
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal((await call(signature)).status, 200);
  assert.equal((await (await call(signature)).json()).duplicate, true);
});
test("Closed case can dispose content under policy; only admin, tombstone retained", async () => {
  const x = await environment(),
    id = await x.create(),
    doc = await x.admin.call("upload", {
      caseId: id,
      name: "teste.txt",
      content: fixture.toString("base64"),
    });
  await x.admin.call("case-status", {
    caseId: id,
    status: "encerrado",
    note: "Entrega simulada concluída; continuidade depende de novo aceite.",
  });
  const b = {
    caseId: id,
    documentId: doc.data.id,
    policy: "Decisão de teste, sem prazo universal",
    reason: "Encerramento sintético",
  };
  assert.equal(
    (await (await x.login("jennifer")).call("disposal", b)).status,
    403,
  );
  assert.equal((await x.admin.call("disposal", b)).status, 200);
  assert.equal(
    (await x.repository.read(x.workspace)).value.cases[0].documents[0].content,
    "",
  );
});
test("Clicksign adapter fixed sandbox with mocked network; failure sanitized by caller", async () => {
  const urls = [];
  const adapter = clicksign(
    {
      CLICKSIGN_SANDBOX_EXPLICIT_TEST: "1",
      CLICKSIGN_ACCESS_TOKEN: "00000000-0000-4000-8000-000000000098",
      CLICKSIGN_WEBHOOK_SECRET: "mock",
      CLICKSIGN_TEST_EMAIL: "test@example.invalid",
    },
    async (url) => {
      urls.push(String(url));
      return Response.json({ error: "fail" }, { status: 503 });
    },
  );
  assert.equal(adapter.available, true);
  await assert.rejects(
    adapter.submit(
      { id: randomUUID(), signature_mode: "embedded" },
      Buffer.from("%PDF-test"),
      async () => {},
    ),
    /Clicksign HTTP 503/,
  );
  assert.ok(
    urls.every((url) =>
      url.startsWith("https://sandbox.clicksign.com/api/v3/"),
    ),
  );
});

test("Drive refuses public roots; private provisioning mocked with no sharing", async () => {
  const { privateDrive } =
    await import("../server/platform/providers/drive.mjs");
  let created = 0;
  const fetcher = async (url, options) => {
    if (url.includes("permissions"))
      return Response.json({
        permissions: [{ type: "anyone", role: "reader" }],
      });
    created++;
    return Response.json({ id: "folder_test_1234" });
  };
  const d = privateDrive({
    enabled: true,
    rootId: "root_test_1234",
    token: async () => "mock",
    fetcher,
  });
  await assert.rejects(d.provision(randomUUID()), /permissões/);
  assert.equal(created, 0);
  const p = privateDrive({
    enabled: true,
    rootId: "root_test_1234",
    token: async () => "mock",
    fetcher: async (url, options) =>
      url.includes("permissions")
        ? Response.json({ permissions: [{ type: "user", role: "owner" }] })
        : Response.json({ id: "folder_test_1234" }),
  });
  assert.equal(
    (await p.provision(randomUUID())).requiresPermissionReview,
    true,
  );
  await assert.rejects(
    privateDrive({}).provision(randomUUID()),
    /não configurada/,
  );
});
test("WhatsApp never sends, checks opt-in/human approval/24-hour template rule", async () => {
  const { whatsappPlan } =
    await import("../server/platform/providers/whatsapp.mjs");
  assert.equal(whatsappPlan({ optIn: false }).canPrepare, undefined);
  const p = whatsappPlan({
    optIn: true,
    lastInboundAt: new Date().toISOString(),
    humanApproved: true,
  });
  assert.equal(p.canPrepare, true);
  assert.equal(p.allowed, false);
  assert.equal(p.sent, false);
  assert.equal(whatsappPlan({ optIn: true }).requiresTemplate, true);
});
test("Optional AI adapter minimizes input, validates output and fails to human review", async () => {
  const { suggestWithModel } =
    await import("../server/platform/providers/followup.mjs");
  let calls = 0;
  const generate = async (input) => {
    calls++;
    assert.deepEqual(Object.keys(input).sort(), [
      "instructions",
      "pendingCount",
      "service",
    ]);
    return { intent: "reminder" };
  };
  assert.equal(
    (await suggestWithModel({ generate, enabled: true, optIn: false }))
      .suggestion,
    null,
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await suggestWithModel({
        generate,
        enabled: true,
        optIn: true,
        service: "AIRE",
        pendingCount: 1,
      })
    ).sent,
    false,
  );
  assert.equal(
    (
      await suggestWithModel({
        generate: async () => {
          throw Error("offline");
        },
        enabled: true,
        optIn: true,
      })
    ).engine,
    "failed",
  );
});
test("Encrypted SQLite backup/restore-copy recovers state without exporting key", async () => {
  const { execFile } = await import("node:child_process"),
    { promisify } = await import("node:util");
  const exec = promisify(execFile),
    dir = await mkdtemp(join(tmpdir(), "oliveira-backup-"));
  try {
    const source = join(dir, "source.sqlite"),
      snapshot = join(dir, "snapshot.sqlite"),
      restored = join(dir, "restored.sqlite"),
      k = key(),
      id = randomUUID();
    const s = new SqliteStore(source);
    await new StateRepository(s, k).create(id, { marker: "recovery-verified" });
    await exec(process.execPath, [
      "scripts/platform-backup.mjs",
      "backup",
      source,
      snapshot,
    ]);
    s.db.close();
    await exec(process.execPath, [
      "scripts/platform-backup.mjs",
      "restore-copy",
      snapshot,
      restored,
    ]);
    const r = new SqliteStore(restored);
    assert.equal(
      (await new StateRepository(r, k).read(id)).value.marker,
      "recovery-verified",
    );
    r.db.close();
    await assert.rejects(
      exec(process.execPath, [
        "scripts/platform-backup.mjs",
        "restore-copy",
        snapshot,
        restored,
      ]),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Recent client response pauses follow-up and opens human task without outgoing message", async () => {
  const x = await environment(),
    a = await x.login("cliente-a"),
    id = await x.create(a);
  await x.admin.call("requirement", { caseId: id, label: "Teste pendente" });
  await a.call("case-save", { caseId: id, optIn: true });
  await x.admin.call("agent", { caseId: id });
  const r = await a.call("case-note", {
    caseId: id,
    note: "Solicito orientação humana no teste.",
    requestHuman: true,
  });
  assert.equal(r.status, 200);
  const state = (await x.admin.call("state")).data.state;
  assert.ok(state.tasks.some((t) => t.type === "human"));
  assert.ok(
    state.tasks.some((t) => t.type === "followup" && t.status === "pausada"),
  );
  await a.call("case-save", { caseId: id, optIn: false });
});
test("Retired services are not offered or accepted; historical pricing remains intact", async () => {
  const x = await environment();
  assert.equal(pricingSeed().length, 20);
  assert.deepEqual(catalog.map(s => s.id), ["IT-01", "IT-02", "IT-03"]);
  for (const [serviceId,variantId] of [["BR-04","documental-completo"],["IT-08","regularizacao-personalizada"],["IT-05","registro-filhos"]]) {
    assert.equal((await x.admin.call("case-create", {serviceId,variantId,answers:{region:"SP"}})).status,422);
  }
  const saved=(await x.repository.read(x.workspace)).value;
  assert.equal(saved.pricing.length,20);
  const visible=(await x.admin.call("state")).data.state.pricing;
  assert.ok(visible.every(row=>catalog.some(s=>s.id===row.serviceId)));
});
test("Card failures remain terminal; new idempotency key creates safe new simulation", async () => {
  const x = await environment(),
    id = await x.create(),
    b = {
      caseId: id,
      method: "card",
      amount: 23456,
      idempotencyKey: "card-test-only-123",
      action: "create",
    };
  assert.equal((await x.admin.call("payment", b)).data.realCharge, false);
  assert.equal(
    (await x.admin.call("payment", { ...b, action: "failed" })).data.status,
    "falha_simulada",
  );
  assert.equal(
    (await x.admin.call("payment", { ...b, action: "paid" })).status,
    409,
  );
  assert.equal(
    (
      await x.admin.call("payment", {
        ...b,
        idempotencyKey: "card-test-only-456",
      })
    ).data.status,
    "pendente_simulado",
  );
});
test("Anonymous/stale-session probe returns no private data without console-producing 401", async () => {
  const x = await environment();
  for (const cookie of ["", `oliveira-platform=${randomUUID()}.invalid`]) {
    const r = await x.app(
      new Request("http://local/api/plataforma?op=session", {
        headers: { cookie },
      }),
    );
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { authenticated: false });
  }
  assert.equal((await x.admin.call("session")).data.authenticated, true);
});
