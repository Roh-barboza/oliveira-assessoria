import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("every public page uses PINCIO without legacy visible branding", async () => {
  const pages = (await readdir("landing",{recursive:true})).filter(p=>p.endsWith(".html"));
  assert.ok(pages.length >= 20,"expected public, staff and detail pages");
  for (const page of pages) {
    const html=await readFile(resolve("landing",page),"utf8");
    assert.match(html,/PINCIO/,"PINCIO absent in "+page);
    assert.doesNotMatch(html,/Oliveira Assessoria|Oliveira —|Sobre a Oliveira|OLIVEIRA ASSESSORIA|logo-(?:mark-)?oliveira(?:-white)?\.svg/,"legacy branding in "+page);
    assert.doesNotMatch(html,/https:\/\/oliveira-assessoria\.vercel\.app/,"outdated canonical or social url in "+page);
  }
});
test("PINCIO canonical, Italian brand assets and safe technical continuity",async()=>{
  const [index,siteMap,pdf,api]=await Promise.all([
    readFile("landing/index.html","utf8"),
    readFile("landing/sitemap.xml","utf8"),
    readFile("server/platform/pdf.mjs","utf8"),
    readFile("api/operacional.mjs","utf8"),
  ]);
  assert.match(index,/https:\/\/pincio-assessoria\.vercel\.app/);
  assert.match(siteMap,/https:\/\/pincio-assessoria\.vercel\.app/);
  assert.doesNotMatch(siteMap,/oliveira-assessoria\.vercel\.app/);
  assert.match(pdf,/PINCIO ASSESSORIA INTERNACIONAL/);
  assert.match(api,/https:\/\/pincio-assessoria\.vercel\.app/);
  for(const file of ["logo-mark-pincio.svg","logo-pincio.svg","logo-pincio-white.svg"]){
    const svg=await readFile("landing/assets/"+file,"utf8");
    assert.match(svg,/<svg\s/);
    assert.match(svg,/<\/svg>/);
    assert.match(svg,/PINCIO/);
  }
});
