import assert from "node:assert/strict";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const evidence = process.env.EVIDENCE_DIR || "test-results";
await mkdir(evidence, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:4175";
let server;
if (!process.env.BASE_URL) ({ server } = await import("../scripts/serve.mjs"));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const pages = (await readdir("landing", { recursive: true })).filter((p) =>
  p.endsWith(".html"),
);
const failures = [],
  results = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};
try {
  for (const width of [360, 390, 768, 1024, 1366, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    let errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const path of pages) {
      const response = await page.goto(`${base}/${path}`);
      await page.evaluate(() => document.fonts.ready);
      check(response.ok(), `${width} ${path}: HTTP ${response.status()}`);
      check(
        (await page.locator("h1").count()) === 1,
        `${path}: exactly one h1`,
      );
      check(
        (await page.locator("main").count()) === 1,
        `${path}: exactly one main`,
      );
      await page.evaluate(() =>
        Promise.all(
          [...document.images].map((i) => {
            i.loading = "eager";
            return i.decode().catch(() => {});
          }),
        ),
      );
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        broken: [...document.images]
          .filter((i) => !i.complete || !i.naturalWidth)
          .map((i) => i.src),
      }));
      check(
        layout.scroll <= width + 1,
        `${width} ${path}: overflow ${layout.scroll}`,
      );
      check(
        layout.broken.length === 0,
        `${width} ${path}: broken images ${layout.broken}`,
      );
      check(errors.length === 0, `${width} ${path}: JS ${errors.join(",")}`);
      errors = [];
      if (width === 390) {
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        const violations = axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        }));
        check(
          violations.length === 0,
          `${path}: axe ${JSON.stringify(violations)}`,
        );
        results.push({ path, width, violations });
        const links = await page
          .locator("a[href]")
          .evaluateAll((as) => as.map((a) => a.href));
        for (const value of new Set(links)) {
          const u = new URL(value);
          if (u.origin !== new URL(base).origin) continue;
          const target = resolve(
            "landing",
            "." +
              decodeURIComponent(
                u.pathname === "/" ? "/index.html" : u.pathname,
              ),
          );
          try {
            const html = await readFile(target, "utf8");
            if (u.hash)
              check(
                html.includes(`id="${decodeURIComponent(u.hash.slice(1))}"`),
                `${path}: missing anchor ${u.pathname}${u.hash}`,
              );
          } catch {
            check(false, `${path}: broken internal link ${u.pathname}`);
          }
        }
      }
    }
    // Menu: open, Escape returns focus, in-page link closes it, no tiny touch targets.
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    const menu = page.locator("#menu-toggle");
    if (width <= 900) {
      check(
        !(await page.locator("#main-nav").isVisible()),
        `${width}: menu starts closed`,
      );
      await menu.click();
      check(
        (await menu.getAttribute("aria-expanded")) === "true",
        `${width}: menu opens`,
      );
      await page.keyboard.press("Escape");
      check(
        (await menu.getAttribute("aria-expanded")) === "false",
        `${width}: Escape closes`,
      );
      check(
        await menu.evaluate((e) => e === document.activeElement),
        `${width}: Escape focus`,
      );
      await menu.click();
      await page.locator("#main-nav a").first().click();
      check(
        (await menu.getAttribute("aria-expanded")) === "false",
        `${width}: menu link closes`,
      );
    } else
      check(
        await page.locator("#main-nav").isVisible(),
        `${width}: desktop navigation visible`,
      );
    await page.screenshot({
      path: `${evidence}/after-home-${width}.png`,
      fullPage: true,
    });
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // No request reaches n8n: verify original payload contract, 2xx, 500 and offline responses.
  let payload,
    mode = "success",
    sent = 0;
  await page.route("**/webhook/oliveira-leads", async (route) => {
    sent++;
    payload = route.request().postDataJSON();
    assert.equal(route.request().method(), "POST");
    assert.equal(route.request().headers()["content-type"], "application/json");
    if (mode === "network") return route.abort("failed");
    await route.fulfill({
      status: mode === "success" ? 200 : 500,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto(base + "/?servico=AIRE#contato");
  assert.equal(await page.locator('[name="servico"]').inputValue(), "AIRE");
  const fill = async () => {
    await page.locator('[name="nome"]').fill("Teste Oliveira");
    await page.locator('[name="whatsapp"]').fill("11999999999");
    await page.locator('[name="servico"]').selectOption("AIRE");
    await page
      .locator('[name="mensagem"]')
      .fill("Teste controlado, sem envio real.");
  };
  await page.locator("#consular-form button").click();
  assert.equal(sent, 0, "required fields block invalid submission");
  for (mode of ["success", "error", "network"]) {
    await fill();
    await page.locator("#consular-form button").click();
    await page.waitForFunction(
      () => document.querySelector("#form-status").textContent.length > 0,
    );
    assert.deepEqual(payload, {
      nome: "Teste Oliveira",
      whatsapp: "11999999999",
      area: "Assessoria Brasil e Itália",
      mensagem: "[AIRE] Teste controlado, sem envio real.",
    });
    if (mode === "success") {
      assert.match(await page.locator("#form-status").innerText(), /Recebemos/);
      assert.equal(await page.locator('[name="nome"]').inputValue(), "");
    } else {
      assert.match(
        await page.locator("#form-status").innerText(),
        /Não foi possível/,
      );
      assert.equal(
        await page.locator('[name="nome"]').inputValue(),
        "Teste Oliveira",
      );
    }
    assert.equal(await page.locator("#consular-form button").isEnabled(), true);
  }
  await page.goto(base);
  await page.locator('[data-service="INSS e benefícios"]').click();
  assert.equal(
    await page.locator('[name="servico"]').inputValue(),
    "INSS e benefícios",
  );
  // IR wizard's local persistence and conditional blocks remain operational.
  await page.goto(base + "/ir/formulario.html");
  await page.locator('[name="securityAck"]').check();
  await page.locator('[name="accuracyAck"]').check();
  await page.locator("#next-step").click();
  await page.locator('[name="nomeCompleto"]').fill("Rascunho fictício");
  await page.waitForTimeout(600);
  await page.reload();
  assert.equal(
    await page.locator('[name="nomeCompleto"]').inputValue(),
    "Rascunho fictício",
  );
  await page.close();
  const nojs = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  await nojs.goto(base);
  assert.equal(await nojs.locator("#main-nav").isVisible(), true);
  await nojs.close();
  await writeFile(
    `${evidence}/validation.json`,
    JSON.stringify(
      {
        base,
        pages: pages.length,
        widths: [360, 390, 768, 1024, 1366, 1920],
        checks: pages.length * 6,
        axe: results,
        failures,
        form: "intercepted only: valid/invalid/success/HTTP500/offline; no real lead sent",
        ir: "local draft persistence",
        date: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  assert.equal(failures.length, 0, failures.join("\n"));
  console.log(
    `PASS: ${pages.length} pages × 6 widths; internal links; axe; menu; lead contract; local IR draft; no-JS navigation.`,
  );
} finally {
  await browser.close();
  server?.close();
}
