import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("every public page uses PINCIO without legacy visible branding", async () => {
  const pages = (await readdir("landing", { recursive: true })).filter((p) =>
    p.endsWith(".html"),
  );
  assert.ok(pages.length >= 20, "expected public, staff and detail pages");
  for (const page of pages) {
    const html = await readFile(resolve("landing", page), "utf8");
    assert.match(html, /PINCIO/, "PINCIO absent in " + page);
    assert.doesNotMatch(
      html,
      /Oliveira Assessoria|Oliveira —|Sobre a Oliveira|OLIVEIRA ASSESSORIA|logo-(?:mark-)?oliveira(?:-white)?\.svg/,
      "legacy branding in " + page,
    );
    assert.doesNotMatch(
      html,
      /https:\/\/oliveira-assessoria\.vercel\.app/,
      "outdated canonical or social url in " + page,
    );
  }
});
test("PINCIO canonical, Italian brand assets and safe technical continuity", async () => {
  const [index, siteMap, pdf, api] = await Promise.all([
    readFile("landing/index.html", "utf8"),
    readFile("landing/sitemap.xml", "utf8"),
    readFile("server/platform/pdf.mjs", "utf8"),
    readFile("api/operacional.mjs", "utf8"),
  ]);
  assert.match(index, /https:\/\/pincio-assessoria\.vercel\.app/);
  assert.match(siteMap, /https:\/\/pincio-assessoria\.vercel\.app/);
  assert.doesNotMatch(siteMap, /oliveira-assessoria\.vercel\.app/);
  assert.match(pdf, /PINCIO ASSESSORIA INTERNACIONAL/);
  assert.match(api, /https:\/\/pincio-assessoria\.vercel\.app/);
  for (const file of [
    "logo-mark-pincio.svg",
    "logo-pincio.svg",
    "logo-pincio-white.svg",
  ]) {
    const svg = await readFile("landing/assets/" + file, "utf8");
    assert.match(svg, /<svg\s/);
    assert.match(svg, /<\/svg>/);
    assert.match(svg, /PINCIO/);
  }
});

test("documentary Pincio photograph has source, license, local derivatives and visible credits", async () => {
  const { createHash } = await import("node:crypto");
  const license = JSON.parse(
    await readFile("landing/assets/pincio-fotografia-licenca.json", "utf8"),
  );
  assert.equal(license.author, "Krzysztof Golik");
  assert.equal(license.license, "CC-BY-SA-4.0");
  assert.match(
    license.source,
    /commons\.wikimedia\.org\/wiki\/File:Piazza_del_Popolo_in_Rome_01\.jpg/,
  );
  assert.equal(license.derivatives.length, 6);
  for (const derivative of license.derivatives) {
    const bytes = await readFile(derivative.file);
    assert.equal(bytes.length, derivative.bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      derivative.sha256,
    );
  }
  for (const name of ["index.html", "servicos-consulares.html"]) {
    const html = await readFile("landing/" + name, "utf8");
    assert.match(html, /image\/avif/);
    assert.match(html, /pincio-roma-640/);
    assert.match(html, /Krzysztof Golik/);
    assert.match(html, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
    assert.doesNotMatch(html, /<img[^>]+src="[^\"]*hero-consular/s);
  }
});
test("legacy logo URLs display PINCIO; monochrome logos and generated test content have current identity", async () => {
  const { fixture } = await import("../server/platform/catalog.mjs");
  assert.match(fixture.toString(), /PINCIO Assessoria Internacional/);
  assert.doesNotMatch(fixture.toString(), /Oliveira/i);
  for (const name of [
    "logo-oliveira.svg",
    "logo-oliveira-white.svg",
    "logo-mark-oliveira.svg",
    "logo-pincio-mono-escuro.svg",
    "logo-pincio-mono-claro.svg",
  ]) {
    const svg = await readFile("landing/assets/" + name, "utf8");
    assert.match(svg, /PINCIO/);
    assert.doesNotMatch(svg, /Oliveira|data:font|base64/);
  }
  const schema = JSON.parse(
    await readFile("landing/ir/schema-v1.json", "utf8"),
  );
  assert.match(schema.title, /PINCIO/);
  assert.equal(
    schema.$id,
    "https://oliveira-assessoria.vercel.app/ir/schema-v1.json",
    "legacy schema identity must remain compatible",
  );
});
test("first passport emission stays documentary while appointment support is renewal-only", async () => {
  const { catalog } = await import("../server/platform/catalog.mjs");
  const passport = catalog.find((s) => s.id === "IT-01");
  const first = passport.variants.find((v) => v.id === "passaporte-primeira");
  const renewal = passport.variants.find(
    (v) => v.id === "passaporte-renovacao",
  );
  assert.doesNotMatch(first.scope.join(" "), /agendamento/i);
  assert.match(
    first.exclusions.join(" "),
    /Assessoria de agendamento para primeira emissão/,
  );
  assert.match(renewal.scope.join(" "), /agendamento de renovação/);
});

test("public synthetic catalog does not display the former brand",async()=>{
  const {catalog}=await import("../server/platform/catalog.mjs");
  assert.doesNotMatch(JSON.stringify(catalog),/\bOliveira\b/i);
});
