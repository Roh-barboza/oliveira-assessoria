# Lighthouse — Etapa 2

Medições reais do Preview no commit `222faf3e414607fb4b550741a09d1bf5c71e1920`, deployment `dpl_GF72yGrUaGCqjV2kvGZv6pTcC7JP`, estado READY, ambiente Preview. Três execuções por perfil na home e três por perfil no catálogo: **12 execuções**. As notas representam o intervalo das execuções; métricas são medianas.

Ordem: Performance / Acessibilidade / Boas práticas / SEO.

| Página | Perfil | Notas | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Home | mobile | 99–100 / 100 / 100 / 63 | 1.575 s | 76.0 ms | 0.000 |
| Home | desktop | 100 / 100 / 100 / 63 | 0.428 s | 0.0 ms | 0.000 |
| Catálogo | mobile | 100 / 100 / 100 / 63 | 0.850 s | 6.0 ms | 0.000 |
| Catálogo | desktop | 100 / 100 / 100 / 63 | 0.275 s | 0.0 ms | 0.000 |

## Comparação com a Etapa 1.1

Na Etapa 1.1 a home do Preview registrou 100 / 100 / 100 / 63 nos dois perfis, com LCP mobile mediano 1,635 s e desktop 0,393 s. Na série atual, Performance mobile varia entre 99 e 100 (mediana 99); desktop mantém 100. LCP mobile mediano 1,575 s e desktop 0,428 s; CLS continua 0. A diferença de até um ponto e a variação de TBT são registradas, sem afirmar 100 em todas as execuções. A meta solicitada de desempenho próximo de 100 foi mantida; os dados não garantem nota constante.

O catálogo novo marcou 100 / 100 / 100 / 63 nas seis execuções. Seu LCP mediano é 0,850 s mobile e 0,275 s desktop, com CLS 0.

SEO 63 decorre exclusivamente do `X-Robots-Tag: noindex` automático do Preview. A proteção não foi desativada. O catálogo não existia antes, portanto não há baseline dessa URL. [Resultados da Etapa 1.1](../etapa-1.1/PERFORMANCE.md).

## Condições e limites

- Lighthouse 13.6.0, Chromium headless em Linux, estado limpo por execução. Configurações oficiais mobile (412 × 823, CPU 4×, slow 4G simulada) e desktop (1350 × 940, desktop dense 4G). Valores completos, versão do navegador e horários estão nos relatórios brutos.
- Ambiente de execução compartilhado. A série da home coincidiu com testes funcionais do navegador; diferenças pequenas de TBT/CPU não podem ser atribuídas isoladamente ao código. Não foram descartadas as notas 99 nem escolhidos somente os melhores resultados. A série do catálogo foi realizada após o término desses testes.
- Flags: `--headless --no-sandbox --ignore-certificate-errors`, como na comparação anterior, devido à confiança na CA deste ambiente. Não houve alteração de TLS no projeto; estas medições não certificam TLS.
- Não são PageSpeed Insights remoto, CrUX ou CWV/INP no percentil 75. TBT é diagnóstico de laboratório; não comprova INP real. As notas se referem às duas páginas medidas, não automaticamente a cada página do site.
- Sem novas dependências, imagem ou fonte. A home continua carregando apenas seus estilos próprios e a base compartilhada; o CSS/JS do catálogo é restrito às páginas que precisam dele. A busca não usa backend.

## Reproduzir

```sh
npm ci
npm test
BASE_URL=https://URL-DO-PREVIEW EVIDENCE_DIR=test-results/home npm run audit
BASE_URL=https://URL-DO-PREVIEW/servicos.html EVIDENCE_DIR=test-results/catalogo npm run audit
```

Defina `CHROME_PATH` conforme o ambiente. `IGNORE_CERT_ERRORS=1` só foi usado pela limitação de CA descrita; o padrão verifica o certificado.

[Resumo da home](evidence/lighthouse-home-summary.json) · [Resumo do catálogo](evidence/lighthouse-catalog-summary.json) · [JSON completos em gzip](evidence/lighthouse). Descompacte e abra em Lighthouse Viewer para inspeção.
