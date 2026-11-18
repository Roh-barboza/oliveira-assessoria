# Lighthouse — finalização da Etapa 2

Preview: https://oliveira-assessoria-90onhrh0b-barbozaa-s-projects.vercel.app/servicos.html. Deployment `dpl_HHNqoPNd6pPYNDBqVTmc8e9aoVrG`, READY, ambiente Preview (`target: null`), implementação `5d40796efc9e3934005993a32196f28a109bbbab`.

Três execuções por perfil em cinco páginas: **30 execuções**. Ordem: Performance / Acessibilidade / Boas práticas / SEO. Notas em intervalos, LCP/TBT medianos e CLS máximo de cada série. Nenhuma execução descartada.

| Página | Perfil | Notas | LCP mediano | TBT mediano | CLS máximo |
| --- | --- | --- | --- | --- | --- |
| Home | mobile | 100 / 100 / 100 / 63 | 1.576 s | 19.5 ms | 0.005492 |
| Home | desktop | 100 / 100 / 100 / 63 | 0.396 s | 0.0 ms | 0.000000 |
| Catálogo | mobile | 100 / 100 / 100 / 63 | 0.957 s | 3.5 ms | 0.000000 |
| Catálogo | desktop | 100 / 100 / 100 / 63 | 0.298 s | 0.0 ms | 0.000000 |
| AIRE | mobile | 100 / 100 / 100 / 63 | 0.943 s | 10.0 ms | 0.000000 |
| AIRE | desktop | 100 / 100 / 100 / 63 | 0.298 s | 0.0 ms | 0.000000 |
| Imposto de Renda | mobile | 100 / 100 / 100 / 63 | 0.913 s | 0.5 ms | 0.033962 |
| Imposto de Renda | desktop | 100 / 100 / 100 / 63 | 0.339 s | 0.0 ms | 0.000599 |
| Organização Documental | mobile | 99–100 / 100 / 100 / 63 | 0.946 s | 0.5 ms | 0.000000 |
| Organização Documental | desktop | 100 / 100 / 100 / 63 | 0.312 s | 0.0 ms | 0.000000 |

## Condições, comparação e limites

Lighthouse 13.6.0 e Chromium headless em Linux. Perfis oficiais mobile/desktop; configurações, horários e avisos preservados nos JSON. Execuções sequenciais, após a suíte funcional e as capturas, sem navegação automatizada concorrente. Host/rede compartilhados podem variar.

Foi observada `ERR_CERT_AUTHORITY_INVALID` no Chromium deste ambiente. Medições e testes remotos usam `IGNORE_CERT_ERRORS=1`, com as flags headless/no-sandbox do harness existente. Não foi alterado TLS, cabeçalho ou certificado do site, nem se certifica segurança TLS por estes testes. `curl` acessou o Preview por HTTPS e confirmou HTTP 200/noindex.

O noindex automático do Preview foi preservado. Os relatórios brutos mostram os audits de SEO e quaisquer outros itens reprovados; não se deve interpretar a nota como aprovação de indexação em produção.

[Baseline da Etapa 2.1](../etapa-2.1/PERFORMANCE.md): home mobile 99–100, demais amostras de Performance 100. As séries atuais devem ser comparadas com suas faixas reais; não se atribui diferença pequena exclusivamente à edição de conteúdo. Organização Documental é uma página nova, sem baseline anterior.

São medições de laboratório nas cinco páginas, não CrUX, INP de campo ou garantia de nota permanente. TBT não substitui INP. Acessibilidade automatizada não substitui revisão manual completa. Não foram adicionadas dependências ou alterados estilos, fontes e imagens.

## Reproduzir

```sh
BASE_URL=https://URL-DO-PREVIEW EVIDENCE_DIR=test-results/preview npm test
BASE_URL=https://URL-DO-PREVIEW/servicos.html EVIDENCE_DIR=test-results/catalogo npm run audit
```

Repetir o audit para home, AIRE, IR e Organização Documental. Só usar `IGNORE_CERT_ERRORS=1` se ocorrer a limitação de confiança de CA registrada; o padrão mantém a verificação. Cada chamada do script existente executa três rodadas mobile e três desktop.

## Relatórios

[Home](evidence/lighthouse-home-summary.json) · [Catálogo](evidence/lighthouse-catalogo-summary.json) · [AIRE](evidence/lighthouse-aire-summary.json) · [IR](evidence/lighthouse-ir-summary.json) · [Organização Documental](evidence/lighthouse-organizacao-summary.json). [JSON completos em gzip](evidence/lighthouse); descompactar para abrir no Lighthouse Viewer.
