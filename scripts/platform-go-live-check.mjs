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
const invitations = read("server/platform/operational-invitations.mjs");
const documents = read("server/platform/operational-documents.mjs");
const backup = read("scripts/operations-backup.mjs");
check("Convite e recuperação com MFA no código",
  /async invite/.test(invitations) && /async reset/.test(invitations) &&
  /async redeem/.test(invitations) && /async confirm/.test(invitations) &&
  /staff-invite/.test(transport) && /invite-confirm/.test(transport),
  "Fluxo protegido por migração e flag; ainda requer homologação no Neon.");
check("Documentos cifrados com verificação obrigatória no código",
  /sealed_bytes/.test(documents) && /scanner\.scan/.test(documents) &&
  /doc-upload/.test(transport) && /OLIVEIRA_OPS_DOCUMENTS_PREVIEW/.test(api),
  "Scanner externo e aprovação LGPD ainda ausentes; upload real bloqueado.");
check("Backup independente criptografado preparado",
  /pg_dump/.test(backup) && /pg_restore/.test(backup) &&
  /OLIVEIRA_OPS_RESTORE_ACK/.test(backup),
  "Script preparado; execução, restauração e cofre externos ainda não comprovados.");
check("Transporte restrito a sessão, origem e método",
  /accounts.getSession/.test(transport) &&
  /sec-fetch-site/.test(transport) &&
  /SameSite=Strict/.test(transport),
  "Revalidar controles em CI, testes de navegador e testes reais.");

for (const [name, explanation] of [
  ["Backup independente e restauração",
    "A ferramenta de backup cifrado existe, mas exige execução real, cofre privado e restauração comprovada em banco isolado."],
  ["LGPD e segurança documental",
    "Armazenamento cifrado preparado com scanner obrigatório; aprovar antivírus real, retenção, descarte, finalidade, responsáveis e transporte. Upload real bloqueado."],
  ["Convites e recuperação no Neon",
    "Fluxo no código; falta migração aditiva, flag específica, ensaio real privado, canal seguro de entrega dos tokens e política de recuperação."],
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
