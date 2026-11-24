import { cp, mkdir, readdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { resolve, join, dirname, relative } from "node:path";

const root=process.cwd();
const src=resolve(root,"landing");
const out=resolve(root,"public-release");
const htmlPages=[
  "index.html","servicos.html","italia.html","servicos-consulares.html",
  "privacidade.html","termos.html","404.html",
  "servicos/aire.html","servicos/fast-it.html","servicos/passaporte-italiano.html",
  "servicos/regularizacao-consular.html","servicos/organizacao-documental.html",
  "servicos/estado-civil.html","servicos/certidoes-italianas.html",
  "servicos/carta-identita.html","servicos/registro-filhos.html",
  "servicos/imposto-de-renda.html",
];
const styles=[
  "consular.css","premium-consular.css","site.css","service-page.css",
  "catalogo.css","style.css",
];
const scripts=["site.js","catalogo.js"];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(join(src,"assets"),join(out,"assets"),{recursive:true});
let count=0;
for(const entry of [...htmlPages,...styles,...scripts]){
  const from=join(src,entry),to=join(out,entry);
  try{if(!(await stat(from)).isFile())continue;}catch(e){if(e.code==="ENOENT")continue;throw e;}
  await mkdir(dirname(to),{recursive:true});
  let body=await readFile(from,"utf8");
  if(entry.endsWith(".html")){
    // Remove unapproved internal operational scopes/team instructions.
    body=body.replace(/<section aria-labelledby="modelo-operacional">[\s\S]*?<\/section>/g,"");
    // Hide internal beta launch labels from public visitors, not service limitations.
    body=body.replace(/Cinco linhas selecionadas para o piloto operacional em São Paulo\.[\s\S]*?Nenhuma liberação comercial é presumida\./g,
      "Informações de serviços para consulta. Escopo, elegibilidade e condições sujeitos a avaliação individual.");
    body=body.replace(/<p><a class="btn btn-gold" href="\/solicitar\.html">[\s\S]*?<\/a><\/p>/g,"");
    body=body.replace(/Em validação comercial · Selecionado para o piloto/g,"Atendimento sob avaliação");
    body=body.replace(/Catálogo em revisão: os escopos e responsáveis ainda dependem de[\s\S]*?<\/p>/g,
      "Serviços apresentados de forma informativa. Condições de contratação dependem de avaliação e disponibilidade.</p>");
    body=body.replace(/href="\/solicitar\.html"/g,'href="/#contato"');
    body=body.replace(/href="\/ir\/formulario\.html"/g,'href="/#contato"');
    body=body.replace(/href="\/operacional\.html"/g,'href="/#contato"');
    body=body.replace(/href="\/plataforma\.html"/g,'href="/#contato"');
    if(entry==="index.html"){
      const form=/<form id="consular-form" class="consular-form">[\s\S]*?<\/form>/;
      if(!form.test(body))throw new Error("Formulário de contato não encontrado. Bloqueio de envio não verificado.");
      body=body.replace(form,
        '<div class="consular-form" role="note" style="padding:32px;min-height:180px;display:flex;flex-direction:column;justify-content:center;gap:12px"><h3>Atendimento em preparação</h3><p>Nosso novo site está aberto para apresentação pública. O formulário de solicitações ficará disponível após a homologação dos canais de atendimento. Não envie dados pessoais por esta página.</p><a class="button button--outline" href="/servicos.html">Conheça os serviços</a></div>');
    }
    // Suppress unverified lead transports in the public release.
    body=body.replace(/<script src="premium-consular\.js" defer><\/script>/g,"");
    body=body.replace(/<script src="\/script\.js" defer><\/script>/g,"");
    body=body.replace(/<script src="script\.js" defer><\/script>/g,"");
    body=body.replace(/href="\/imposto-de-renda\.html"/g,'href="/servicos.html#brasil"');
    body=body.replace(/href="\/ir\/laboratorio\.html"/g,'href="/servicos.html#brasil"');
    if(/(?:Jennifer|Rodrigo|preparar solicitação no ambiente de teste)/i.test(body))
      throw new Error("Conteúdo interno ainda presente na página pública: "+entry);
    if(/<form\b[^>]*id="(?:consular-form|leads-form)"/.test(body))
      throw new Error("Formulário de coleta não homologado: "+entry);
    if(/\/solicitar\.html|\/operacional\.html|\/ativacao\.html|\/contratos\.html|\/plataforma\.html/.test(body))
      throw new Error("Link interno detectado: "+entry);
  }
  await writeFile(to,body);
  count++;
}
// Public visitors may open the temporary URL, but search indexing waits until
// the final trade name/domain and privacy notices have been approved.
await writeFile(join(out,"robots.txt"),"User-agent: *\nDisallow: /\n");
await writeFile(join(out,"sitemap.xml"),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://oliveira-assessoria.vercel.app/</loc></url></urlset>');
console.log("Release pública estática preparada: "+count+" arquivos de página/estilo/script, sem funções e formulários internos.");
