# Antes e depois — Etapa 1 → 1.1

Capturas reais em Chromium, fontes locais carregadas, viewport de 900 px de altura. Antes: `3c29cca`. Depois: `f7a618c`. A comparação considera o mesmo conteúdo e todos os serviços.

## Redução objetiva de altura no mobile

Medidas CSS reais das grades de serviços e do documento inteiro; nenhuma descrição foi removida ou truncada.

| Largura | Grade italiana | Grade brasileira | Home inteira |
| --- | --- | --- | --- |
| 360 px | 2084 → 1242 px (−40.4%) | 1041 → 773 px (−25.8%) | 8595 → 7423 px (−13.6%) |
| 390 px | 2060 → 1221 px (−40.7%) | 1018 → 728 px (−28.5%) | 8432 → 7241 px (−14.1%) |
| 430 px | 2013 → 1179 px (−41.4%) | 945 → 686 px (−27.4%) | 8186 → 7032 px (−14.1%) |

Em desktop (1366 px), a altura da home e das duas grades permanece igual. Os dois CTAs mobile medem 48 px de altura, com larguras iguais entre si. Dados brutos: [layout-comparison.json](evidence/layout-comparison.json).

## Capturas

| Página | Antes mobile 390 px | Depois mobile 390 px | Antes desktop 1366 px | Depois desktop 1366 px |
| --- | --- | --- | --- | --- |
| Primeira dobra | [Abrir](evidence/before-hero-390.webp) | [Abrir](evidence/after-hero-390.webp) | [Abrir](evidence/before-hero-1366.webp) | [Abrir](evidence/after-hero-1366.webp) |
| Home completa | [Abrir](evidence/before-home-390.webp) | [Abrir](evidence/after-home-390.webp) | [Abrir](evidence/before-home-1366.webp) | [Abrir](evidence/after-home-1366.webp) |
| AIRE | [Abrir](evidence/before-aire-390.webp) | [Abrir](evidence/after-aire-390.webp) | [Abrir](evidence/before-aire-1366.webp) | [Abrir](evidence/after-aire-1366.webp) |

Capturas completas de desktop foram redimensionadas a 1000 px apenas para facilitar leitura no arquivo; primeiras dobras e mobile preservam a resolução original. A alteração principal do AIRE é comportamental: seu CTA passa de dois cliques a um, diretamente ao formulário central com AIRE selecionado.

Antes — primeira dobra mobile:

![Antes](evidence/before-hero-390.webp)

Depois — primeira dobra mobile:

![Depois](evidence/after-hero-390.webp)

Depois — home mobile completa:

![Home refinada](evidence/after-home-390.webp)
