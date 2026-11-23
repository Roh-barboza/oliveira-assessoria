const error = (status, message) => Object.assign(new Error(message), { status });
const SANDBOX_SIGNER_NAME = "Cliente Demonstração";
import { uuid } from "../security.mjs";

const origin = "https://sandbox.clicksign.com";
const jsonApi = "application/vnd.api+json";
export const maxPdfBytes = 3 * 1024 * 1024;

export async function readBytes(stream, maximum) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream ?? []) {
    size += chunk.length;
    if (size > maximum) throw error(413, "Conteúdo acima do limite permitido.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, size);
}

export function clicksign(env, fetcher = fetch) {
  async function request(method, path, data) {
    const response = await fetcher(`${origin}/api/v3${path}`, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(7500),
      headers: {
        Authorization: env.CLICKSIGN_ACCESS_TOKEN,
        Accept: jsonApi,
        "Content-Type": jsonApi,
      },
      body: data ? JSON.stringify({ data }) : undefined,
    });
    if (!response.ok) throw new Error(`Clicksign HTTP ${response.status}`);
    return method === "POST" && path.endsWith("/notifications")
      ? null
      : (await response.json()).data;
  }

  async function create(path, type, attributes, relationships) {
    const data = await request("POST", path, {
      type,
      attributes,
      relationships,
    });
    if (!uuid(data?.id))
      throw new Error("Clicksign retornou um identificador inválido");
    return data.id;
  }

  return {
    available: Boolean(
      env.CLICKSIGN_SANDBOX_EXPLICIT_TEST === "1" &&
      env.CLICKSIGN_ACCESS_TOKEN &&
      /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(
        env.CLICKSIGN_TEST_EMAIL ?? "",
      ),
    ),
    embedded: env.CLICKSIGN_EMBEDDED_SANDBOX === "1",
    async probe() {
      // Read-only test: no envelope, signer, document or e-mail is created.
      if (env.CLICKSIGN_SANDBOX_EXPLICIT_TEST !== "1" ||
          !env.CLICKSIGN_ACCESS_TOKEN)
        return { reachable: false, code: "not_configured" };
      try {
        const response = await fetcher(origin + "/api/v3/envelopes?page%5Bsize%5D=1", {
          method: "GET", redirect: "error", signal: AbortSignal.timeout(7500),
          headers: { Authorization: env.CLICKSIGN_ACCESS_TOKEN, Accept: jsonApi },
        });
        if (response.ok) return { reachable: true, code: "authenticated" };
        return { reachable: false, code:
          [401,403,404,422,429,500,503].includes(response.status)
            ? "http_" + response.status : "http_other" };
      } catch {
        return { reachable: false, code: "network_error" };
      }
    },
    async submit(row, pdf, checkpoint) {
      if (
        env.CLICKSIGN_SANDBOX_EXPLICIT_TEST !== "1" ||
        !["embedded", "email"].includes(row.signature_mode) ||
        (row.signature_mode === "email" &&
          env.CLICKSIGN_SANDBOX_EMAIL_EXPLICIT_TEST !== "1")
      )
        throw error(
          503,
          "Sandbox externo desativado; notificações não autorizadas.",
        );
      const embedded = row.signature_mode === "embedded";
      await checkpoint("criar_envelope");
      const envelope = await create("/envelopes", "envelopes", {
        name: `SANDBOX Oliveira ${row.id}`,
        locale: "pt-BR",
        auto_close: true,
        remind_interval: null,
        deadline_partial_signature_action: "canceled",
      });
      const base = `/envelopes/${envelope}`;
      await checkpoint("enviar_documento", { envelope });
      const document = await create(`${base}/documents`, "documents", {
        filename: `minuta-${row.id}.pdf`,
        content_base64: `data:application/pdf;base64,${pdf.toString("base64")}`,
        metadata: { contract_id: row.id },
      });
      await checkpoint("criar_signatario", { document });
      const signer = await create(`${base}/signers`, "signers", {
        name: SANDBOX_SIGNER_NAME,
        email: env.CLICKSIGN_TEST_EMAIL,
        has_documentation: false,
        communicate_events: {
          signature_request: embedded ? "none" : "email",
          signature_reminder: "none",
          document_signed: "none",
        },
      });
      const relationships = {
        document: { data: { type: "documents", id: document } },
        signer: { data: { type: "signers", id: signer } },
      };
      await checkpoint("qualificar_signatario", { signer });
      await create(
        `${base}/requirements`,
        "requirements",
        { action: "agree", role: "sign" },
        relationships,
      );
      await checkpoint("configurar_autenticacao");
      await create(
        `${base}/requirements`,
        "requirements",
        {
          action: "provide_evidence",
          auth: embedded ? "embedded_signature" : "email",
        },
        relationships,
      );
      await checkpoint("ativar_envelope");
      const activated = await request("PATCH", base, {
        id: envelope,
        type: "envelopes",
        attributes: { status: "running" },
      });
      if (
        activated?.id !== envelope ||
        activated.attributes?.status !== "running"
      )
        throw new Error("Ativação não confirmada");
      if (!embedded) {
        // E-mail is never sent by just setting communicate_events.
        // Explicitly notify the sandbox test signatory after activation.
        await checkpoint("notificar_signatario", { envelope, signer });
        await request("POST", `${base}/signers/${signer}/notifications`, {
          type: "notifications",
          attributes: {},
        });
      }
      await checkpoint("enviado");
    },
    async current(row) {
      if (env.CLICKSIGN_SANDBOX_EXPLICIT_TEST !== "1")
        throw error(503, "Sandbox externo desativado.");
      const base = `/envelopes/${row.envelope_id}`;
      const envelope = await request("GET", base);
      if (envelope?.id !== row.envelope_id)
        throw new Error("Envelope divergente");
      if (envelope.attributes?.status === "canceled")
        return { status: "cancelado" };
      if (
        envelope.attributes?.status === "running" &&
        ["embedded", "email"].includes(row.signature_mode)
      )
        return { status: "aguardando_assinatura" };
      if (
        envelope.attributes?.status !== "closed" ||
        !row.document_id ||
        !row.signer_id
      )
        return {};
      const documents = await request("GET", `${base}/documents`);
      const document = documents.find((item) => item.id === row.document_id);
      if (document?.attributes?.status !== "closed") return {};
      const events = await request(
        "GET",
        `${base}/documents/${row.document_id}/events?page%5Bsize%5D=50`,
      );
      if (!events.some((event) => event.attributes?.name === "sign")) return {};
      const link = document.links?.files?.signed;
      if (!link)
        throw error(503, "A Clicksign ainda está preparando o PDF assinado.");
      const url = new URL(link);
      const allowed = new Set([
        "sandbox.clicksign.com",
        "clicksign-content-sandbox.s3.amazonaws.com",
        ...(env.CLICKSIGN_SANDBOX_FILE_HOSTS ?? "")
          .split(",")
          .map((host) => host.trim())
          .filter(Boolean),
      ]);
      if (
        url.protocol !== "https:" ||
        url.port ||
        url.username ||
        url.password ||
        !allowed.has(url.hostname)
      ) {
        throw new Error("Host de arquivo Clicksign não autorizado");
      }
      const response = await fetcher(url, {
        redirect: "error",
        signal: AbortSignal.timeout(7500),
      });
      if (!response.ok) throw new Error("Download Clicksign indisponível");
      const pdf = await readBytes(response.body, maxPdfBytes);
      if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
        throw new Error("Arquivo assinado inválido");
      return { status: "assinado", pdf };
    },
  };
}
