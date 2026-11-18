import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:4176",
  dir = process.env.EVIDENCE_DIR || "test-results/platform-ui";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    ...(process.env.IGNORE_CERT_ERRORS === "1"
      ? ["--ignore-certificate-errors"]
      : []),
  ],
});
const results = [],
  errors = [];
try {
  const ctx = await browser.newContext({
      ignoreHTTPSErrors: process.env.IGNORE_CERT_ERRORS === "1",
      viewport: { width: 1366, height: 900 },
    }),
    page = await ctx.newPage();
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(base + "/plataforma.html");
  await page
    .locator("#environment")
    .filter({ hasText: /sintétic|Demonstração/ })
    .waitFor();
  await page.screenshot({ path: dir + "/desktop-entry.png", fullPage: true });
  await page.locator("#demo input").check();
  const response = page.waitForResponse(
    (r) => r.url().includes("op=demo") && r.status() === 201,
  );
  await page
    .getByRole("button", { name: "Criar demonstração privada" })
    .click();
  const credentials = await (await response).json();
  await page.locator("#workspace").waitFor({ state: "visible" });
  await page
    .getByRole("button", { name: "Já guardei, ocultar acessos" })
    .click();
  await page
    .getByRole("button", { name: "Nova solicitação", exact: true })
    .click();
  await page.locator("select[name=serviceId]").selectOption("IT-02");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("[name=region]").fill("São Paulo / SP");
  await page.locator("[name=consulate]").fill("São Paulo — teste");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("[name=confirm]").check();
  await page
    .getByRole("button", { name: "Enviar solicitação de teste" })
    .click();
  await page
    .getByRole("heading", { name: "Documentos e pendências" })
    .waitFor();
  await page
    .locator("form[data-op=requirement] input[name=label]")
    .fill("Comprovante sintético");
  await page.locator("form[data-op=requirement] button").click();
  await page
    .getByText("Comprovante sintético · Pendente", { exact: true })
    .waitFor();
  await page.getByText("Enviar arquivo sintético", { exact: true }).click();
  const fixture = Buffer.from(
    await page.evaluate(async () =>
      Array.from(
        new Uint8Array(
          await (await fetch("/api/plataforma?op=fixture")).arrayBuffer(),
        ),
      ),
    ),
  );
  await page
    .locator("#upload select")
    .selectOption({ label: "Comprovante sintético" });
  await page
    .locator("#upload input[type=file]")
    .setInputFiles({
      name: "documento-sintetico.txt",
      mimeType: "text/plain",
      buffer: fixture,
    });
  await page.locator("#upload button").click();
  await page.getByRole("link", { name: "Baixar documento de teste" }).waitFor();
  await page.locator("form[data-op=operations] [name=scopeAccepted]").check();
  await page.locator("form[data-op=operations] [name=minimumReceived]").check();
  await page.locator("form[data-op=operations] button").click();
  await page.waitForTimeout(150);
  await page
    .getByRole("button", { name: "Gerar minuta de teste em PDF" })
    .click();
  await page
    .getByRole("link", { name: "Baixar PDF da minuta simulada" })
    .waitFor();
  await page.locator("form[data-op=contract-action] button").click();
  await page
    .getByText("aguardando assinatura simulada", { exact: true })
    .waitFor();
  await page.locator("form[data-op=case-save] [name=optIn]").check();
  await page.locator("form[data-op=case-save] button").click();
  await page
    .getByRole("button", { name: "Gerar sugestão de follow-up" })
    .click();
  await page.getByText("Sugestão não enviada", { exact: true }).waitFor();
  for (const width of [360, 390, 430, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `overflow ${width}`,
    );
    if ([390, 1366].includes(width)) {
      const axe = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
      );
      await page.screenshot({
        path: `${dir}/${width === 390 ? "mobile" : "desktop"}-case.png`,
        fullPage: true,
      });
    }
    results.push({ view: "case", width, overflow: false });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page
    .getByRole("button", { name: "Precificação interna", exact: true })
    .click();
  await page.locator("#price-row").waitFor();
  assert.equal(await page.locator("#price-row option").count(), 20);
  for (const [k, v] of Object.entries({
    operating: "50",
    partner: "0",
    otherVariable: "0",
    taxPercent: "0",
    gatewayPercent: "0",
    gatewayFixed: "0",
    price: "100",
    targetMargin: "30",
    installments: "3",
    financePercent: "0",
  }))
    await page.locator(`#pricing [name=${k}]`).fill(v);
  await page
    .getByRole("button", { name: "Calcular e salvar rascunho" })
    .click();
  await page.waitForTimeout(250);
  console.log(
    "pricing response:",
    await page.locator("#feedback").textContent(),
  );
  await page.getByRole("heading", { name: "Resultado interno" }).waitFor();
  assert.match(await page.locator("#price-result").textContent(), /50,00/);
  await page.screenshot({ path: dir + "/desktop-pricing.png", fullPage: true });
  const axe = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    axe.violations.map((v) => v.id),
    [],
  );
  async function login(username) {
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.locator("#login [name=workspace]").fill(credentials.workspace);
    await page.locator("#login [name=username]").fill(username);
    await page
      .locator("#login [name=password]")
      .fill(
        credentials.credentials.find((c) => c.username === username).password,
      );
    await page.locator("#login button").click();
    await page.locator("#workspace").waitFor({ state: "visible" });
  }
  await login("jennifer");
  await page.getByRole("button", { name: "Atendimentos", exact: true }).click();
  await page.getByRole("button", { name: "Abrir atendimento" }).click();
  await page.locator("form[data-op=review] button").click();
  await page.getByText("aguardando segunda", { exact: true }).waitFor();
  await login("rodrigo");
  await page.getByRole("button", { name: "Atendimentos", exact: true }).click();
  await page.getByRole("button", { name: "Abrir atendimento" }).click();
  await page.locator("form[data-op=review] button").click();
  await page.getByText("conferido", { exact: true }).waitFor();
  await page
    .locator("form[data-op=case-status] select")
    .selectOption("preparado");
  await page.locator("form[data-op=case-status] button").click();
  await page
    .locator(".badge")
    .filter({ hasText: /^preparado$/ })
    .waitFor();
  await login("cliente-a");
  await page.getByRole("button", { name: "Atendimentos", exact: true }).click();
  await page.getByRole("button", { name: "Abrir atendimento" }).click();
  assert.equal(await page.locator("form[data-op=review]").count(), 0);
  await page
    .locator("form[data-op=contract-action] select")
    .selectOption("sign");
  await page.locator("form[data-op=contract-action] button").click();
  await page.getByText("assinado simulado", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: dir + "/mobile-customer.png", fullPage: true });
  assert.deepEqual(
    (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
    [],
  );
  await login("cliente-b");
  await page.getByRole("button", { name: "Atendimentos", exact: true }).click();
  await page
    .getByText("Nenhuma solicitação neste espaço.", { exact: false })
    .waitFor();
  assert.equal(await page.locator("[data-view=pricing]").isVisible(), false);
  assert.deepEqual(errors, []);
  results.push({
    flow: "admin → request → upload → PDF → followup → pricing → Jennifer review → Rodrigo review → client signature → second client isolation",
    status: "passed",
    axe: "zero violations in checked states",
  });
  await writeFile(
    dir + "/results.json",
    JSON.stringify(
      { base, results, errors, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ status: "passed", screenshots: 5, results }, null, 2),
  );
} finally {
  await browser.close();
}
