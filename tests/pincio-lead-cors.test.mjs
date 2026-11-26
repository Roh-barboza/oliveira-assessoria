import test from "node:test";
import assert from "node:assert/strict";
import { checkLeadCors } from "../scripts/check-lead-cors.mjs";
test("CORS evidence requires POST/content-type and the PINCIO origin; never submits data", async () => {
  const result = await checkLeadCors(async (url, options) => {
    assert.equal(options.method, "OPTIONS");
    assert.equal(options.body, undefined);
    assert.equal(options.credentials, "omit");
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "https://pincio-assessoria.vercel.app",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      },
    });
  });
  assert.equal(result.status, "passed");
  assert.equal(result.leadSubmitted, false);
  assert.equal(result.receiptConfirmed, false);
  const invalid = await checkLeadCors(
    async () =>
      new Response(null, {
        status: 204,
        headers: { "access-control-allow-origin": "https://old.invalid" },
      }),
  );
  assert.equal(invalid.status, "failed");
  const blocked = await checkLeadCors(async () => {
    throw Error("blocked");
  });
  assert.equal(blocked.status, "unreachable");
});
