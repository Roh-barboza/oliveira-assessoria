# Performance real — comparação Etapa 1 → 1.1

Três execuções de Lighthouse por perfil no Preview atualizado. Ordem das notas: Performance / Acessibilidade / Boas práticas / SEO. Métricas representam medianas; notas foram idênticas nas três execuções de cada perfil.

| Versão | Perfil | Notas | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Etapa 1 | mobile | 100 / 100 / 100 / 63 | 0.928 s | 15.0 ms | 0.000 |
| Etapa 1 | desktop | 100 / 100 / 100 / 63 | 0.619 s | 0.0 ms | 0.000 |
| Etapa 1.1 | mobile | 100 / 100 / 100 / 63 | 1.635 s | 14.0 ms | 0.000 |
| Etapa 1.1 | desktop | 100 / 100 / 100 / 63 | 0.393 s | 0.0 ms | 0.000 |

As notas do Preview foram preservadas. O SEO permanece 63 exclusivamente pelo cabeçalho `X-Robots-Tag: noindex` automático da Vercel; essa proteção não foi desativada.

## Leitura das métricas

O LCP mobile subiu de 0,928 s para 1,635 s nesta série, permanecendo abaixo de 2,5 s e com Performance 100. Os relatórios identificam uma mudança do elemento LCP: na Etapa 1 era o `h1`; na Etapa 1.1 passa a ser a fotografia, que aparece mais cedo na primeira dobra após a compactação dos CTAs. A fotografia, srcset, sizes e prioridade alta permanecem iguais. O audit de descoberta da imagem confirma prioridade alta, URL no HTML inicial e ausência de lazy loading para o LCP. Não se trata de afirmar que todas as métricas melhoraram: há essa diferença registrada, além de variabilidade de rede entre execuções.

Desktop apresentou LCP mediano de 0,393 s, antes 0,619 s; CLS 0 nas seis execuções atuais. TBT é diagnóstico de laboratório e não comprova INP de usuários reais.

## Ambiente e reprodução

- Preview atual: https://oliveira-assessoria-k0k74uy2g-barbozaa-s-projects.vercel.app/
- Vercel READY, ambiente Preview, deployment `dpl_3C391U5jjTCTwfw39Q8yFXw2tMUh`, commit de implementação `f7a618cf842fa63d9171e42401025b8531d8ddcc`.
- Lighthouse 13.6.0, Chromium headless em Linux. Perfis oficiais mobile (412 × 823, CPU 4×, rede slow 4G simulada) e desktop (1350 × 940, desktop dense 4G). Configurações, horários e valores brutos preservados nos relatórios.
- Mesmas flags usadas na comparação anterior: `--headless --no-sandbox --ignore-certificate-errors`. A exceção de certificado é necessária pela confiança na CA do ambiente de execução; não houve alteração de TLS no projeto e os testes não certificam TLS.
- Estado limpo por execução. São medições de laboratório da home, não dados CrUX, PageSpeed remoto ou CWV/INP no percentil 75. Resultados de rede e CPU variam; as notas não são garantia permanente.
- Recursos de logo, fotografia, fontes, ícones, contrato n8n, dependências e configuração de hospedagem sem alterações em relação à Etapa 1.

Comandos reproduzíveis:

```sh
npm test
BASE_URL=https://URL-DO-PREVIEW npm test
BASE_URL=https://URL-DO-PREVIEW npm run audit
```

Use `CHROME_PATH` se o navegador estiver em outro caminho e `EVIDENCE_DIR` para o destino das evidências. Neste ambiente foi usado `IGNORE_CERT_ERRORS=1`; por padrão essa exceção fica desligada.

[Resumo das seis medições atuais](evidence/lighthouse-preview-summary.json). [Relatórios completos em JSON gzip](evidence/lighthouse) — descompactar e abrir com Lighthouse Viewer. [Medições anteriores](../etapa-1/evidence/lighthouse-preview-summary.json).

## Série local complementar

Também foram realizadas três execuções por perfil em `http://127.0.0.1:4177`, servidor estático sem compressão HTTP da Vercel. Mobile: **99 / 100 / 100 / 100** em todas as execuções; desktop: **100 / 100 / 100 / 100**. LCP mediano mobile 2,258 s, desktop 0,491 s; CLS 0. Em relação à Etapa 1 local, a Performance mobile ficou um ponto abaixo (99 vs 100), com a imagem agora identificada como LCP; essa diferença não foi ocultada. O Preview atualizado manteve 100 de Performance em todas as seis execuções.

Um ensaio adicional de preload responsivo manteve a nota local em 99 e não demonstrou benefício; o carregamento existente foi preservado no código final. Nenhum recurso foi atrasado ou ocultado para manipular métricas. [Resumo local](evidence/lighthouse-local-summary.json); relatórios brutos na mesma pasta gzip.
