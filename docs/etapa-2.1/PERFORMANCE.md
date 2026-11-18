# Lighthouse — Etapa 2.1

Preview medido: https://oliveira-assessoria-1yoa9gtt2-barbozaa-s-projects.vercel.app/

Vercel READY, ambiente Preview, deployment `dpl_5bDoPp6h9VWs9ounoXrTy7UbyQfe`, implementação `84d2bcee81fdea6204259bb0d17547308d434961`. Três execuções por perfil, em quatro páginas representativas: **24 execuções**, todas preservadas nos relatórios.

Notas em ordem Performance / Acessibilidade / Boas práticas / SEO. Notas são intervalos das três execuções, LCP/TBT são medianas e CLS é o maior valor de cada série (não arredondado para zero).

| Página | Perfil | Notas | LCP | TBT | CLS máximo |
| --- | --- | --- | --- | --- | --- |
| Home | mobile | 99–100 / 100 / 100 / 63 | 1.611 s | 24.0 ms | 0.000000 |
| Home | desktop | 100 / 100 / 100 / 63 | 0.454 s | 0.0 ms | 0.000000 |
| Catálogo | mobile | 100 / 100 / 100 / 63 | 0.852 s | 2.0 ms | 0.000000 |
| Catálogo | desktop | 100 / 100 / 100 / 63 | 0.636 s | 0.0 ms | 0.000000 |
| AIRE | mobile | 100 / 100 / 100 / 63 | 0.925 s | 6.0 ms | 0.000090 |
| AIRE | desktop | 100 / 100 / 100 / 63 | 0.286 s | 0.0 ms | 0.000000 |
| Imposto de Renda | mobile | 100 / 100 / 100 / 63 | 1.275 s | 17.0 ms | 0.000000 |
| Imposto de Renda | desktop | 100 / 100 / 100 / 63 | 0.294 s | 0.0 ms | 0.000808 |

O CLS máximo de todas as séries foi **0.000808**. Não se afirma CLS exatamente zero em todas as execuções. Catálogo, AIRE e IR marcaram 100 de Performance nos dois perfis; a home mobile variou 99–100, desktop 100. Acessibilidade e Boas práticas marcaram 100 nas 24 execuções. O único audit de SEO reprovado foi o bloqueio de indexação do Preview (`X-Robots-Tag: noindex`), mantido; a nota foi 63.

## Comparação com a Etapa 2

Home mobile continua na faixa 99–100, desktop 100. Catálogo mantém 100 nos dois perfis. AIRE e IR foram medidos nesta revisão como amostras específicas das páginas refinadas; a entrega anterior não tinha séries dessas duas páginas para comparação direta. A concisão editorial não foi convertida em alegação de melhoria de todas as métricas. [Resultados anteriores](../etapa-2/PERFORMANCE.md).

## Condições e limites

- Lighthouse 13.6.0, Chromium headless em Linux, estado limpo por execução. Perfis oficiais mobile (412 × 823, CPU 4×, slow 4G simulada) e desktop (1350 × 940, desktop dense 4G). Configurações completas, horários, versão do navegador e avisos nos JSON.
- Execuções sequenciais, após o término da suíte funcional; sem testes de navegador em paralelo às medições. O host e a rede continuam sujeitos a variações. Não foram descartadas execuções 99 nem repetidas séries para selecionar uma nota melhor.
- Flags `--headless --no-sandbox --ignore-certificate-errors`, mantendo a condição das etapas anteriores devido à confiança na CA deste ambiente. O projeto não teve TLS alterado; os testes não certificam TLS.
- São dados de laboratório das páginas medidas. Não são PageSpeed remoto, CrUX, INP de campo ou percentil 75 de Core Web Vitals. TBT não substitui INP. As notas não são uma garantia permanente nem se estendem automaticamente a todas as páginas/dispositivos.
- Nenhuma fonte, imagem, dependência ou biblioteca nova. Busca, formulário e lógica IR preservados; índice de conteúdo usa `details/summary` nativo, sem JavaScript adicional.

## Reproduzir

```sh
npm test
BASE_URL=https://URL-DO-PREVIEW npm test
BASE_URL=https://URL-DO-PREVIEW EVIDENCE_DIR=test-results/home npm run audit
BASE_URL=https://URL-DO-PREVIEW/servicos.html EVIDENCE_DIR=test-results/catalogo npm run audit
BASE_URL=https://URL-DO-PREVIEW/servicos/aire.html EVIDENCE_DIR=test-results/aire npm run audit
BASE_URL=https://URL-DO-PREVIEW/imposto-de-renda.html EVIDENCE_DIR=test-results/ir npm run audit
```

Use `CHROME_PATH` quando necessário. `IGNORE_CERT_ERRORS=1` foi usado apenas pela limitação de CA descrita; por padrão a verificação de certificado fica ativa.

## Evidências

[Home](evidence/lighthouse-home-summary.json) · [Catálogo](evidence/lighthouse-catalogo-summary.json) · [AIRE](evidence/lighthouse-aire-summary.json) · [IR](evidence/lighthouse-ir-summary.json) · [JSON completos em gzip](evidence/lighthouse).

Descompacte os relatórios para abrir no Lighthouse Viewer. A síntese preserva as notas e as métricas reais, incluindo os pequenos deslocamentos de layout observados.
