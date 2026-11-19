import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { browserExecutablePath } from "../scripts/browser-path.mjs";

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const evidenceDir = "test-results/operational-ui";
await mkdir(evidenceDir, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
async function awaitServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(base + "/operacional.html");
      if (response.status === 200) return;
    } catch {}
    if (server.exitCode !== null) throw new Error("Servidor local encerrou inesperadamente.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Servidor local não iniciou.");
}
async function checkA11y(page) {
  const results = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(results.violations.map(({ id, nodes }) => ({
    id, elements: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  })), []);
  for (const width of [390, 768, 1366]) {
    await page.setViewportSize({ width, height: 820 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
      `Overflow na largura ${width}`);
  }
}
try {
  await awaitServer();
  browser = await chromium.launch({ executablePath: browserExecutablePath(), args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // When the backend has not been mounted, the page must not solicit credentials.
  await page.goto(base + "/operacional.html");
  await page.locator("#unavailable").waitFor({ state: "visible" });
  await page.screenshot({ path: evidenceDir + "/ambiente-indisponivel.png", fullPage: true });
  assert.equal(await page.locator("#login-area").isVisible(), false);
  assert.equal(await page.locator("#dashboard").isVisible(), false);
  await checkA11y(page);

  // Browser contract test. All accounts and cases are synthetic and kept
  // in browser route mocks, never sent to any third-party service.
  let loggedIn = false;
  const user = { id: "11111111-1111-4111-8111-111111111111",
    name: "Operadora de exemplo", email: "equipe@example.test", role: "operator" };
  const cases = [];
  const requestLog = [];
  await page.route("**/api/operacional?**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const op = url.searchParams.get("op");
    requestLog.push(op);
    const body = req.method() === "POST" ? req.postDataJSON() : null;
    let result = {}, status = 200;
    if (op === "session") result = loggedIn ? { authenticated: true, user } : { authenticated: false };
    else if (op === "login") { loggedIn = true; result = { authenticated: true }; }
    else if (op === "logout") { loggedIn = false; result = { authenticated: false }; }
    else if (!loggedIn) { status = 401; result = { error: "Autenticação necessária." }; }
    else if (op === "case-list") result = { cases };
    else if (op === "case-get") result = { case: cases.find((c) => c.id === url.searchParams.get("id")) };
    else if (op === "case-create") {
      const item = { id: "22222222-2222-4222-8222-222222222222",
        title: body.title, service: body.service, notes: body.notes,
        version: 1, status: "triagem" };
      cases.push(item);
      result = { case: item }; status = 201;
    } else if (op === "case-status") {
      const item = cases.find((c) => c.id === body.id);
      item.status = body.nextStatus;
      item.version++;
      result = { case: item };
    } else { status = 404; result = { error: "Não encontrado." }; }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(result) });
  });

  await page.reload();
  await page.locator("#login-area").waitFor({ state: "visible" });
  await page.locator("#email").fill("equipe@example.test");
  await page.locator("#password").fill("SENHA-APENAS-DE-TESTE-123456");
  await page.locator("#code").fill("123456");
  await page.locator("#login-form button").click();
  await page.locator("#dashboard").waitFor({ state: "visible" });
  assert.equal(await page.locator("#password").inputValue(), "");
  assert.equal(await page.locator("#cases-list .case-item").count(), 0);

  const harmlessMarkup = "<img src=x onerror=alert(1)>";
  await page.locator("#case-title").fill(harmlessMarkup);
  await page.locator("#case-service").fill("Documentação sintética");
  await page.locator("#case-form button").click();
  await page.locator("#cases-list .case-item").waitFor();
  assert.match(await page.locator("#cases-list button").getAttribute("aria-label"), /^Detalhes da solicitação:/);
  assert.equal(await page.locator("#cases-list img").count(), 0);
  assert.match(await page.locator("#cases-list .case-item").textContent(), /img src=x/);
  await page.locator("#cases-list button").click();
  await page.locator("#selected-panel").waitFor({ state: "visible" });
  await page.locator("#next-status").selectOption("conferencia");
  await page.locator("#status-form button").click();
  await page.getByText("Etapa atualizada.").waitFor();
  assert.equal(cases[0].status, "conferencia");
  await page.screenshot({ path: evidenceDir + "/painel-sintetico.png", fullPage: true });

  await checkA11y(page);
  await page.locator("#logout").click();
  await page.locator("#login-area").waitFor({ state: "visible" });
  assert.equal(await page.locator("#dashboard").isVisible(), false);
  assert.ok(requestLog.includes("login"));
  assert.ok(requestLog.includes("case-create"));
  assert.ok(requestLog.includes("case-status"));
  assert.ok(requestLog.includes("logout"));
  assert.deepEqual(errors, []);
  console.log("PAINEL OPERACIONAL: indisponibilidade segura, login, solicitações, etapas, logout, acessibilidade e responsividade aprovados.");
} finally {
  if (browser) await browser.close();
  server.kill();
}
