# Evidências de validação

## Resultado local confirmado pelo usuário em 19/11/2026 (Windows)

No clone vinculado ao projeto isolado, o usuário executou `git pull --ff-only`, `node -v` (`v24.15.0`), `npm ci` (**173 pacotes auditados, zero vulnerabilidades reportadas**) e `npm run test:platform` (**28 testes aprovados, zero falhas**, duração de aproximadamente 17 s). Esse resultado **inclui a correção de CAS do Blob e o teste simulado de escrita condicional**, mas **não** inclui o teste adicional de gate serverless nem as adaptações de testes de navegador para Windows commitadas posteriormente. Esses últimos ainda precisam ser executados.

O código de browser agora seleciona Chromium via Playwright em Windows/macOS, preservando o caminho conhecido de execução em Linux. O script Windows de verificação de branch, projeto, Node e testes foi adicionado, mas **não executado pelo assistente**, pois este ambiente não possui PowerShell Windows nem acesso ao clone local. [Guia Windows](GUIA-WINDOWS-TESTES.md).

**Teste remoto com Blob real:** não executado, store ainda não conectado. Os resultados abaixo de Lighthouse/Preview pertencem à implementação anterior e não devem ser tratados como revalidação da nova branch.

## Backend, finanças e segurança

`npm run test:platform`: **28 testes passaram, zero falhas** na execução local de 18/11/2026. Inclui isolamento de dois clientes, RBAC, origem/CSRF, mass assignment, criptografia/tamper, CAS concorrente, persistência SQLite/reabertura, SQL Postgres em PGlite, Blob privado simulado, primeira/segunda revisão, FAST IT invertido, T0 e marcos, revisões, rascunho, autorização, opt-in/deduplicação/pausa/encerramento, PDF/hash/assinatura, pagamentos idempotentes, webhook HMAC, descarte, falha Clicksign mockada, Drive privado mockado, regras WhatsApp e falha segura do adaptador de modelo. Backup/restauração SQLite consistente também executados.

`npm audit --omit=dev`: **zero vulnerabilidades reportadas** após atualizar a dependência transitiva `@vercel/cli-config` para 0.4.0 via override. Esse resultado não substitui revisão de segurança de produção.

## Navegador

`npm run test:platform-ui`: execuções local e no Preview passaram no fluxo completo com quatro identidades. Solicitação → fixture privado → T0 → PDF/convite interno → tarefa de follow-up → cálculo interno → Jennifer → Rodrigo → cliente assinando no simulador → segundo cliente sem acesso ao caso.

Verificados 360, 390, 430, 768, 1366 e 1920 px sem overflow na tela do caso. Axe sem violações nos estados avaliados de caso administrativo, precificação e cliente. Capturas excluem o bloco de credenciais.

Nenhuma chamada aos órgãos oficiais, Drive, Clicksign, LLM, adquirente ou WhatsApp real foi usada como evidência. O formulário n8n existente é interceptado nos testes, sem envio real.

## Regressão pública e rastreabilidade

Preview `https://oliveira-assessoria-c7ata5ejp-barbozaa-s-projects.vercel.app` (`04341e0`): **21 páginas × sete larguras = 147 combinações**, sem falhas. Larguras 360/390/430/768/1024/1366/1920. Inclui axe, busca/categorias, estados vazios, links/âncoras, menu e teclado, página 404, fluxo das fichas, formulário central (validação/sucesso/HTTP500/offline interceptados), rascunho IR e navegação sem JavaScript. A única falha de contraste encontrada no CTA novo foi corrigida antes dessa execução aprovada.

Preview final funcional `https://oliveira-assessoria-ekhw33jq9-barbozaa-s-projects.vercel.app` (`96df056`, deployment `dpl_CPqKDxdwX3mKEFAq8trWPfdQmbW9`): fluxo autenticado integral e capturas refeitos com sucesso. Depois de `04341e0`, houve organização do código e melhoria da consulta de sessão anônima; o conteúdo e os estilos do site público permaneceram iguais. A nova consulta de sessão não gera 401 no primeiro acesso e tem teste próprio. Alterações posteriores do PR anexaram evidências/documentação, sem novas funcionalidades.

História verificada: interface → API HTTPS → repositório cifrado em memória → resposta renderizada, com quatro identidades. Persistência SQLite/reabertura/recuperação foram verificadas localmente; **não** se afirma durabilidade entre instâncias Vercel. O modo temporário pode reiniciar, perder dados e exigir recriar a demonstração.

Os testes de rede privada usam a cadeia de certificados do navegador de testes com `IGNORE_CERT_ERRORS=1` devido ao proxy do executor. Nenhum segredo de bypass ou conta real foi usado. Não é um ensaio independente da cadeia TLS pública. Headers de noindex/no-store/CSP foram conferidos na resposta publicada. O último deployment de produção consultado permanece `dpl_9WmwZYXXnmXQscmwMRATydJKUxNq` (`2adb1af`), anterior a esta implementação.

## Capturas e relatórios

Todas as identidades, valores preenchidos e documentos nas imagens são **sintéticos**. Valores da calculadora não representam preços propostos ou aprovados. Nenhuma captura inclui o bloco de senhas.

- [Entrada desktop](evidence/desktop-entry.png), [caso desktop](evidence/desktop-case.png) e [caso mobile](evidence/mobile-case.png).
- [Precificação interna desktop](evidence/desktop-pricing.png) e [portal do cliente mobile](evidence/mobile-customer.png).
- [Página inicial desktop](evidence/desktop-home.png) e [mobile](evidence/mobile-home.png).
- [Catálogo desktop](evidence/desktop-catalog.png) e [mobile](evidence/mobile-catalog.png).
- [Backend: saída dos 28 testes](evidence/backend-tests.txt), [fluxo de navegador](evidence/platform-ui.json), [147 combinações públicas](evidence/public-validation.json).
- [Auditoria de execução](evidence/npm-audit-runtime.json) e [auditoria de todas as dependências](evidence/npm-audit-all.json): ambas com zero vulnerabilidades reportadas.

Comandos de reprodução: `npm run test:platform`; `BASE_URL=<preview> IGNORE_CERT_ERRORS=1 npm run test:platform-ui`; `BASE_URL=<preview> IGNORE_CERT_ERRORS=1 npm test`; `BASE_URL=<pagina> IGNORE_CERT_ERRORS=1 npm run audit`. Para uma medição por dispositivo, `LIGHTHOUSE_RUNS=1`; o padrão segue três por dispositivo.

## Lighthouse no Preview

Lighthouse **13.6.0**, URLs imutáveis acima, medições sequenciais sem os testes de navegador concorrentes. Página inicial: mediana de três execuções em cada dispositivo. Catálogo e entrada da plataforma: uma execução em cada dispositivo; não são medições estatísticas de tráfego real nem ensaio de toda a área autenticada.

| Página | Dispositivo | Execuções | Desempenho | Acessibilidade | Boas práticas | SEO |
|---|---|---:|---:|---:|---:|---:|
| Página inicial | mobile | 3 | 100 | 100 | 100 | 69 |
| Página inicial | desktop | 3 | 100 | 100 | 100 | 69 |
| Entrada da plataforma | mobile | 1 | 100 | 100 | 92 | 66 |
| Entrada da plataforma | desktop | 1 | 100 | 100 | 92 | 66 |
| Catálogo | mobile | 1 | 100 | 100 | 100 | 69 |
| Catálogo | desktop | 1 | 100 | 100 | 100 | 69 |

A pontuação SEO reduzida é intencional: `noindex` no Preview; a área privada também é excluída em robots. Não removemos essa proteção para melhorar a nota. Na plataforma, boas práticas 92 decorre do **bloqueio pela CSP do script de feedback da Vercel (`vercel.live`) injetado pelo próprio Preview**. A política permanece restrita a scripts da aplicação; não foi aberta permissão para terceiro em páginas de atendimento apenas para melhorar o Lighthouse. Os fluxos de aplicação passaram e não registraram exceções JavaScript; o aviso de segurança da toolbar continua identificado.

Dados de cada execução: [inicial](evidence/lighthouse-home.json), [catálogo](evidence/lighthouse-catalog.json), [plataforma](evidence/lighthouse-platform.json). Os JSON completos estão anexados em `evidence/lighthouse-*.json.gz`; incluem métricas, auditorias e URLs de cada coleta. CLS da página inicial e catálogo ficou em zero nas coletas registradas. As evidências não representam aprovação de G3 ou de integração externa.

## Alterações de 19/11/2026 ainda não reexecutadas

Correção no `server/platform/store.mjs`: gravação condicional do Blob exige **`allowOverwrite: true` + `ifMatch`** na atualização de um objeto existente. A criação inicial permanece com `allowOverwrite: false`. O teste `Blob adapter enforces private CAS across create, update and conflicts` foi ampliado para checar que uma segunda gravação é permitida somente com ETag válido, que versões antigas e criação duplicada retornam conflito, e que duas atualizações concorrentes preservam o estado cifrado.

**Status: alteração commitada, ainda sem execução dos testes desta rodada.** Os 28 testes e os resultados Lighthouse listados acima pertencem às versões anteriores e não foram revalidados após a correção. A conexão Blob real permanece desligada; nenhuma evidência de persistência remota foi produzida.

Reprodução no ambiente local adequado (Node 24.x): `npm ci` e `npm run test:platform`. Somente após obter autorização e isolamento de implantação Preview, repetir testes de navegador e cenários remotos sintéticos de reinício, concorrência, acesso e recuperação.
