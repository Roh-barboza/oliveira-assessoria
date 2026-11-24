import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

test("public release builds without private pages and collecting forms",async()=>{
  execFileSync(process.execPath,["scripts/build-public-release.mjs"],{stdio:"pipe"});
  const root=join(process.cwd(),"public-release");
  const files=await readdir(root);
  for(const banned of [
    "operacional.html","equipe.html","ativacao.html","contratos.html",
    "solicitar.html","plataforma.html","premium-consular.js","script.js",
  ]) assert.equal(files.includes(banned),false,"Arquivo não público: "+banned);
  for(const needed of ["index.html","servicos.html","privacidade.html",
    "termos.html","404.html","assets","robots.txt"])
    assert.equal(files.includes(needed),true,"Arquivo público ausente: "+needed);
  const home=await readFile(join(root,"index.html"),"utf8");
  const catalog=await readFile(join(root,"servicos.html"),"utf8");
  assert.match(home,/Atendimento em preparação/);
  assert.doesNotMatch(home,/<form id="consular-form"|chaoticcow|n8n\.cloudfy/);
  assert.doesNotMatch(catalog,/\/solicitar\.html|piloto operacional/);
  const robots=await readFile(join(root,"robots.txt"),"utf8");
  assert.match(robots,/Disallow: \/\s/);
  const config=JSON.parse(await readFile("vercel.json","utf8"));
  assert.equal(config.outputDirectory,"public-release");
  assert.equal(config.buildCommand,"node scripts/build-public-release.mjs");
  assert.ok(config.redirects.some(r=>r.source==="/api/:path*"));
  assert.ok(config.redirects.some(r=>r.source==="/operacional.html"));
  assert.ok(config.headers.some(r=>r.headers.some(h=>h.key==="X-Robots-Tag"&&h.value.includes("noindex"))));
});
