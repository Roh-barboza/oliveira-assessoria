import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

// Read-only preflight. Never POST a lead, read a response body or use credentials.
export async function checkLeadCors(fetcher = fetch) {
  const origin = "https://pincio-assessoria.vercel.app";
  const report = {
    at: new Date().toISOString(),
    origin,
    method: "OPTIONS",
    leadSubmitted: false,
    receiptConfirmed: false,
  };
  try {
    const response = await fetcher(
      "https://chaoticcow-n8n.cloudfy.live/webhook/oliveira-leads",
      {
        method: "OPTIONS",
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(12000),
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      },
    );
    const read = (name) => response.headers.get(name) || "";
    const allowedOrigin = read("access-control-allow-origin");
    const methods = read("access-control-allow-methods")
      .toUpperCase()
      .split(",")
      .map((x) => x.trim());
    const headers = read("access-control-allow-headers")
      .toLowerCase()
      .split(",")
      .map((x) => x.trim());
    Object.assign(report, {
      httpStatus: response.status,
      allowedOrigin,
      allowedMethods: methods,
      allowedHeaders: headers,
    });
    report.status =
      response.ok &&
      [origin, "*"].includes(allowedOrigin) &&
      (methods.includes("POST") || methods.includes("*")) &&
      (headers.includes("content-type") || headers.includes("*"))
        ? "passed"
        : "failed";
  } catch (e) {
    report.status = "unreachable";
    report.errorType = e.name || "TransportError";
    const code = e.cause?.code;
    const safeCodes = [
      "ENOTFOUND",
      "EAI_AGAIN",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "UND_ERR_CONNECT_TIMEOUT",
      "CERT_HAS_EXPIRED",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    ];
    report.transportCode = safeCodes.includes(code) ? code : "UNCLASSIFIED";
  }
  return report;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await checkLeadCors();
  const output = process.argv[process.argv.indexOf("--output") + 1];
  if (process.argv.includes("--output")) {
    if (!output) throw Error("Caminho de saída necessário");
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  }
  console.log("PINCIO_CORS_REPORT " + JSON.stringify(report));
  // External reachability is evidence, not a substitute for the mandatory offline security tests.
}
