# Validação local da Oliveira Assessoria no Windows (sem Work)

**Atualizado em 19/11/2026.** Este procedimento testa a plataforma, mas **não** conecta o Blob, não cria deployment, não modifica produção e não utiliza dados reais.

## Ambiente autorizado

- Repositório: `Roh-barboza/oliveira-assessoria`
- Branch: `feature/plataforma-operacional-preview`
- Projeto Vercel isolado: `oliveira-plataforma-preview` (`prj_IB4FPuQ8CWkSS0VjZvIQsq3kE2Ie`)
- Equipe: `barbozaa-s-projects` (`team_SzgCrqKBL9o0MvVqzmsA1ji0`)
- Diretório local: `C:\Users\venda\oliveira-preview-src`
- Node.js: `24.x`
- A pasta foi vinculada com `npx vercel link`; `.vercel/project.json` pode ser inspecionado por ID, mas **não** publicar `.env.local`, token OIDC ou outros segredos.

## Execução completa (PowerShell 5.1)

Abra um PowerShell normal no computador em que o clone foi criado:

```powershell
cd C:\Users\venda\oliveira-preview-src
git pull --ff-only
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verificar-oliveira-preview.ps1 -Navegador -SitePublico -Lighthouse -Auditoria
```

O script primeiro confere a branch, URL do Git remoto, ID de projeto/equipe presentes no vínculo local e Node 24. Se algum desses campos não corresponder exatamente, **interrompe antes de executar** os testes.

Em seguida:

1. Executa `npm run test:platform` e interrompe se algum teste falhar.
2. Executa `npm audit --omit=dev` se `-Auditoria` foi informado. É uma leitura da árvore de dependências, sem deploy.
3. Com `-Navegador`, instala o Chromium gerenciado pelo Playwright se necessário, sobe temporariamente a API em `127.0.0.1:4176`, testa a jornada autenticada e encerra o processo criado pelo script. Não liga nenhuma integração externa.
4. Com `-SitePublico`, verifica as páginas públicas em múltiplas larguras e acessibilidade.
5. Com `-Lighthouse`, executa uma coleta por dispositivo no site local, sem substituir medições remotas anteriores.

**Os testes de navegador exigem download de navegador pelo Playwright e podem demorar.** Falhas de rede, navegador ou máquina devem ser registradas como falhas/limites locais; não interpretar como funcionamento correto do ambiente remoto.

### Execução mais rápida, sem abrir navegador

```powershell
cd C:\Users\venda\oliveira-preview-src
git pull --ff-only
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verificar-oliveira-preview.ps1
```

### Se `node_modules` não existir ou o pacote mudar

Adicionar `-AtualizarDependencias` ao script; isso executa `npm ci` antes da suíte. O script não chama `npm install` sem solicitação explícita.

## Coleta e relato de resultados

Copiar apenas o resumo dos testes: quantidade de testes, falhas, erros de navegação e pontuações. Arquivos de teste são colocados em `test-results/` (ignorado pelo Git); não publicar screenshots caso tenham sido alterados para conter informações reais. Nunca enviar o conteúdo de `.env.local`, `.vercel` com tokens, cookies, tokens OIDC, ou `data.key`.

**Referência validada pelo usuário (19/11):** com Node `v24.15.0`, `npm ci` reportou zero vulnerabilidades e `npm run test:platform` passou **28 de 28 testes** após a correção Blob CAS. O teste adicional do gate serverless e os testes de navegador compatíveis com Windows foram commitados **depois** dessa validação. Seus resultados ainda são pendentes.

## Diagnóstico dedicado de desempenho mobile (Lighthouse)

A última bateria local registrou mobile **67/100**, desktop **100/100**, com TBT mobile **3559,5 ms** em uma única coleta; por isso a próxima etapa é **diagnosticar variabilidade**, não alterar UI sem evidência. Execute após `git pull --ff-only`, preferencialmente sem testes ou downloads concorrentes:

```powershell
cd C:\Users\venda\oliveira-preview-src
git pull --ff-only
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verificar-oliveira-preview.ps1 -Lighthouse -LighthouseRodadas 3
```

O script agora executa três coletas sequenciais em mobile e desktop, calcula medianas e lista as tarefas longas, scripts e categorias da thread principal que o Lighthouse registrar. Os relatórios individuais e o diagnóstico ficam em `test-results/lighthouse/` (ignorado pelo Git). O resumo exibido no PowerShell é suficiente para compartilhar, sem enviar segredos locais.

Também foi adicionado o workflow `.github/workflows/oliveira-preview-checks.yml`, limitado a `npm ci`, `npm run test:platform` e `npm audit --omit=dev`. Ele não faz deploy, não usa credenciais e não substitui testes de navegador Windows. A primeira execução de CI precisa ser observada antes de alegar aprovação.
## Resultado da repetição registrada em 19/11/2026

O usuário executou três medições sequenciais no Windows e concluiu todos os 29 testes de backend. A mediana mobile foi **94/100** (rodadas 83, 98 e 94), a mediana desktop **100/100** (100, 100 e 100). O TBT mobile mediano foi **232 ms**, consideravelmente abaixo do resultado isolado anterior de 3.559,5 ms. O diagnóstico registrou algumas tarefas `Unattributable` e trabalho de layout, sem causa raiz identificada. Não otimizar/remover recursos da página apenas com base em um score isolado.

O CI em GitHub Actions também tem um job de navegador para o site público e o fluxo autenticado sintético. A execução dessa ampliação precisa ser conferida. Os testes locais não autorizam deploy nem conexão de dados reais.

## Operação real segue bloqueada

O projeto novo já foi criado e vinculado localmente, mas o Blob privado continua desconectado. Não executar `vercel deploy`, `vercel git connect`, criação de secrets, nem conectar armazenamento ao projeto original como solução improvisada. A primeira implantação de um projeto vazio pode assumir alvo Production: é necessário resolver essa limitação antes de qualquer publicação, pois a autorização recebida exclui deployment Production mesmo no projeto isolado. Contratos, cobranças, WhatsApp, n8n e atendimento com dados reais permanecem desativados.
