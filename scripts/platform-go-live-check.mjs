import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (name) => readFileSync(join(root, name), "utf8");
const findings = [];
function check(name, pass, explanation, { external = false } = {}) {
  findings.push({ name, pass: Boolean(pass), explanation, external });
}

// The synthetic `/plataforma` app is intentionally NOT the real operational
// backend. Assess the isolated `/api/operacional` implementation separately.
// Static checks are presence checks, not a substitute for runtime tests.
const ignore = read(".vercelignore");
check("Dados locais excluídos do upload",
  /^\.local-platform\s*$/m.test(ignore) && /^test-results\s*$/m.test(ignore),
  "Dados temporários e evidências não podem ser publicados.");
const api = read("api/operacional.mjs");
const accounts = read("server/platform/operational-accounts.mjs");
const cases = read("server/platform/operational-cases.mjs");
const transport = read("server/platform/operational-http.mjs");
const runtime = read("server/platform/operational-runtime.mjs");
check("API operacional isolada no Preview",
  /VERCEL_ENV\s*===\s*"preview"/.test(api) &&
  /VERCEL_GIT_COMMIT_REF/.test(api) &&
  /VERCEL_PROJECT_ID/.test(api) &&
  /OLIVEIRA_OPS_ENABLED/.test(api),
  "A habilitação requer ambiente, projeto e branch correspondentes.");
check("Banco dedicado sem fallback de memória",
  /OLIVEIRA_OPS_STORE\s*===\s*"postgres"/.test(api) &&
  /operationalDatabaseUrl/.test(api) &&
  /Administrador ainda não ativado/.test(api),
  "Verificação do PostgreSQL e da conta administrativa antes de atender.");
check("MFA e sessões revogáveis",
  /OperationalMfa/.test(runtime) &&
  /createSession/.test(accounts) && /revokeAll/.test(accounts) &&
  /a.status='active'/.test(accounts),
  "Senhas/MFA e bloqueio de conta devem ser verificados nos testes.");
check("Atendimentos criptografados e atualizações CAS",
  /this.cipher.seal/.test(cases) && /version=version\+1/.test(cases) &&
  /recentEvents/.test(cases),
  "Histórico recente protegido, vinculado à versão do atendimento.");
check("Revogação de acesso administrativo implementada",
  /disableStaff/.test(accounts) && /staff-disable/.test(transport) &&
  /role IN \('operator','reviewer'\)/.test(accounts),
  "Bloqueio dos membros não administrativos, sem autoexclusão do admin.");
check("Transporte restrito a sessão, origem e método",
  /accounts.getSession/.test(transport) &&
  /sec-fetch-site/.test(transport) &&
  /SameSite=Strict/.test(transport),
  "Revalidar controles em CI, testes de navegador e testes reais.");

for (const [name, explanation] of [
  ["Backup independente e restauração",
    "Exigir evidência de dump cifrado e restauração em banco separado. Não é possível inferir sucesso pelo código."],
  ["LGPD e segurança documental",
    "Aprovar retenção, descarte, finalidade, responsáveis e transporte de arquivos; upload real permanece bloqueado."],
  ["Cadastro/recuperação de novos funcionários",
    "O primeiro admin com MFA existe; faltam convites seguros, recuperação e gestão completa de credenciais."],
  ["Revisão jurídica e liberação comercial",
    "Aprovar individualmente as cinco ofertas, limites, termos, competências e valores reais."],
  ["Homologação externa de formulários",
    "O teste atual de webhook n8n/Cloudfy usa mocks; comprovar recebimento e rastreabilidade reais."],
  ["Release autorizado, domínio e recuperação",
    "Exigir aprovação expressa, testes finais e estratégia de reversão. Manter produção inalterada."],
]) check(name, false, explanation, { external: true });

console.log("\nOLIVEIRA ASSESSORIA | PRONTIDÃO OPERACIONAL | SEM EXPOSIÇÃO DE SEGREDOS\n");
for (const item of findings) {
  const qualifier = item.external ? "EVIDÊNCIA PENDENTE" :
    item.pass ? "CONTROLE NO CÓDIGO" : "FALHA NO CÓDIGO";
  console.log(`${qualifier} | ${item.name}\n  ${item.explanation}`);
}
console.log(`\n${findings.filter(x=>x.pass).length}/${findings.length} itens verificados no repositório.`);
console.log("Os controles no código não equivalem a go-live. Não foram usadas credenciais ou dados reais.");
if (findings.some(x=>!x.pass)) {
  console.error("\nGO-LIVE BLOQUEADO: não aceitar dados reais ou cobrar pela plataforma antes do aceite.");
  process.exitCode=1;
}
