# Medições reais — 17/11/2026

Ordem das notas: **Performance / Acessibilidade / Boas práticas / SEO**. LCP, TBT e CLS representam a mediana; os três resultados finais individuais estão nos arquivos JSON de resumo. Todas as três execuções finais tiveram as mesmas notas por categoria.

| Cenário | Perfil | Notas | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Antes local (1 execução) | mobile | 89 / 96 / 100 / 100 | 3.588 s | 0.0 ms | 0.000 |
| Antes local (1 execução) | desktop | 69 / 96 / 100 / 100 | 2.862 s | 0.0 ms | 0.009 |
| Depois local (3 execuções) | mobile | 100 / 100 / 100 / 100 | 1.053 s | 1.5 ms | 0.000 |
| Depois local (3 execuções) | desktop | 100 / 100 / 100 / 100 | 0.487 s | 0.0 ms | 0.000 |
| Preview (3 execuções) | mobile | 100 / 100 / 100 / 63 | 0.928 s | 15.0 ms | 0.000 |
| Preview (3 execuções) | desktop | 100 / 100 / 100 / 63 | 0.619 s | 0.0 ms | 0.000 |

## Condições e reprodutibilidade

- Lighthouse 13.6.0, Chromium headless, Linux, uma navegação por execução, estado limpo. Versão exata do navegador e configurações completas constam nos relatórios brutos.
- Baseline: cópia imutável do commit `2adb1afa`, servida por `python3 -m http.server` em localhost:4173. Depois: mesma arquitetura estática, localhost:4174, sem compressão do servidor Python. As duas medições de baseline carregaram as dependências externas com sucesso (sem erros de console).
- Mobile: emulação padrão Lighthouse (412 × 823 CSS px, slow 4G simulada, CPU 4×). Desktop: configuração oficial lr-desktop-config (1350 × 940 CSS px, desktop dense 4G). Os números completos de latência, throughput e CPU constam em `settings` nos resumos.
- Preview auditado: https://oliveira-assessoria-i7jrm8te6-barbozaa-s-projects.vercel.app/ — deployment `dpl_DQG3Z8k7tjTduJ4kJuXUd8URxGnR`, código `64b5062ea8b60215c393e115958b03408c16fe30`, estado READY, branch da Etapa 1, ambiente Preview.
- Chrome usa `--headless --no-sandbox --ignore-certificate-errors`: a última opção contorna exclusivamente o problema de confiança na CA do ambiente de execução, que inicialmente impedia Google Fonts/Font Awesome na baseline. Mesmas flags para antes/depois/Preview. **Esses testes não certificam TLS do site.** As execuções iniciais com falha de certificado foram descartadas da comparação. Nenhuma alteração de certificado ou configuração TLS foi feita no projeto.
- SEO do Preview: o único audit de SEO reprovado foi `is-crawlable`, pelo cabeçalho automático `X-Robots-Tag: noindex` da Vercel. Mantido de propósito para proteger o Preview da indexação; não é uma regressão do HTML. Localmente, SEO 100.
- São testes de laboratório desta home, com rede/CPU simuladas. Não são PageSpeed Insights remoto, CrUX ou Core Web Vitals de campo. Não há resultado de INP em uso real nem comprovação do percentil 75. TBT é diagnóstico de laboratório, não substituto de INP.
- Baseline tem uma amostra por perfil; variações de latência das fontes externas influenciam seus resultados. As notas não são promessa de pontuação constante e não representam todas as páginas ou dispositivos.

## Executar novamente

```sh
npm ci
npm test
npm run audit
BASE_URL=https://URL-DO-PREVIEW npm run audit
```

Defina `CHROME_PATH` se Chromium estiver em outro caminho. `IGNORE_CERT_ERRORS=1` só foi necessário neste ambiente; o padrão mantém a verificação de certificado. `EVIDENCE_DIR` altera a pasta de saída. Relatórios completos estão em [evidence/lighthouse](evidence/lighthouse), comprimidos com gzip (descompactar e abrir o JSON com Lighthouse Viewer). Resumos legíveis: [baseline](evidence/lighthouse-baseline-summary.json), [depois local](evidence/lighthouse-local-summary.json), [Preview](evidence/lighthouse-preview-summary.json).
