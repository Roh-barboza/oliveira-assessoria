import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (name) => readFileSync(join(root, name), "utf8");
const findings = [];
function check(name, pass, explanation) {
  findings.push({ name, pass: Boolean(pass), explanation });
}

const ignore = read(".vercelignore");
check("Excluir resultados de teste do upload", /^test-results\s*$/m.test(ignore), "A pasta test-results deve ficar fora do pacote.");
check("Excluir dados locais do upload", /^\.local-platform\s*$/m.test(ignore), "Dados locais não podem ser publicados.");
check("Excluir evidências do upload", /^docs\/\*\*\/evidence\s*$/m.test(ignore), "Relatórios e capturas não são arquivos do runtime.");

const app = read("server/platform/app.mjs");
const api = read("api/plataforma.mjs");
check("Autenticação real de usuários", !/op === "demo"/.test(app) && !/Cliente Demonstração/.test(app), "O aplicativo ainda cria contas e credenciais fictícias.");
check("Operação sem expiração sintética", !/86400000/.test(app) && !/synthetic-only/.test(app), "O ambiente ainda expira logicamente após 24 horas e declara modo sintético.");
check("Documentos reais autorizados", !/documento-sintetico-oliveira|fixture/.test(app), "O upload e a conferência dependem do documento sintético.");
check("Contratos e pagamentos reais homologados", !/realContracts: false|realPayments: false/.test(app), "Assinatura e pagamentos reais estão desativados.");
check("Mensagens reais homologadas", !/realMessages: false/.test(app), "Envio real ainda desativado.");
check("Runtime sem fallback para memória", /Persistência remota obrigatória/.test(api), "Persistência remota deve falhar de forma segura.");
check("API permitida fora de Preview", !/VERCEL_ENV !== "preview"/.test(api), "A API atual só autoriza o projeto Preview.");
check("Chave e armazenamento de produção", false, "Credenciais e armazenamento de produção devem ser configurados e validados fora do repositório.");
check("LGPD, minutas e escopos aprovados", false, "Aprovações documental, jurídica e comercial exigem evidência externa.");

console.log("\nOLIVEIRA ASSESSORIA | AUDITORIA DE PRONTIDÃO OPERACIONAL\n");
for (const f of findings) {
  console.log(`${f.pass ? "OK" : "BLOQUEADO"} | ${f.name}\n  ${f.explanation}`);
}
console.log(`\n${findings.filter((f) => f.pass).length}/${findings.length} verificações atendidas.`);
console.log("Nenhuma credencial foi lida, nenhum dado foi enviado e nenhum deployment foi criado.");
if (findings.some((f) => !f.pass)) {
  console.error("\nRELEASE REAL BLOQUEADO: não publique dados de clientes nem cobre valores pela plataforma atual.");
  process.exitCode = 1;
}
