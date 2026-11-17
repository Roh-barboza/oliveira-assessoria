# Etapa 1.1 — refinamento de UX e performance

Base: `3c29cca` da Etapa 1. Mesma branch `feature/etapa-1-premium-responsiva` e PR #5. Etapa restrita a acabamento visual e navegação, sem merge ou publicação em produção.

- Cartões horizontais compactos na home a até 560 px, preservando todos os títulos, descrições, serviços e links. Sem carrossel, truncamento ou conteúdo oculto; apenas a numeração decorativa é omitida no celular.
- CTAs “Explorar serviços” e “Solicitar análise” visíveis como botões, lado a lado no mobile, com área de toque de 48 px e cores existentes.
- CTAs de análise dos oito serviços consulares, cabeçalhos e barras laterais levam diretamente a `/?servico=...#contato`. Seleção automática original preservada, sem mudanças no webhook, payload ou credenciais.
- IR recebe CTA principal de análise com serviço pré-selecionado; o checklist local continua acessível como ação separada.
- Hub consular e Itália levam diretamente ao contato central. As âncoras de contato antigas continuam disponíveis para links externos existentes.
- Expressões de segurança absoluta e ausência de burocracia substituídas por conferência documental e orientação em cada etapa. Textos legais, regras de serviços e preços existentes preservados.
- Mesmos arquivos de logo, fotografia, fontes WOFF2 e ícones SVG. Nenhuma dependência nova.

Validação local concluída: 17 páginas × 7 larguras (360, 390, 430, 768, 1024, 1366, 1920), menu, links, axe, teclado, foco, CTA direto de cada serviço, seleção automática, HTTP 404 e formulário com respostas interceptadas (sucesso, erro HTTP e falha de rede). Nenhum pedido fictício atingiu o n8n.

## Entrega para revisão

- **PR existente atualizado:** https://github.com/Roh-barboza/oliveira-assessoria/pull/5
- **Preview validado:** https://oliveira-assessoria-k0k74uy2g-barbozaa-s-projects.vercel.app/
- Vercel READY, ambiente Preview, deployment `dpl_3C391U5jjTCTwfw39Q8yFXw2tMUh`, implementação `f7a618cf842fa63d9171e42401025b8531d8ddcc`. Commits posteriores desta entrega apenas acrescentam relatórios e evidências.
- [Capturas atualizadas e comparação antes/depois](VISUAL.md).
- [Lighthouse e comparação com a Etapa 1](PERFORMANCE.md).
- [Arquivos modificados nesta revisão](ARQUIVOS.md).
- [Checklist de Jennifer e Rodrigo](APROVACAO.md).

## Resultados

- A 390 px, grade italiana de 2060 para 1221 px (−40,7%); grade brasileira de 1018 para 728 px (−28,5%). Home de 8432 para 7241 px (−14,1%). Sem remoção de descrições ou opções. Desktop mantém as alturas das grades e da home.
- `npm test` passou **localmente e no Preview**: 17 páginas × 7 larguras, total de 119 combinações por ambiente; axe WCAG 2/2.1 A/AA sem violações automáticas nas apresentações iniciais a 390 px, menu, links/âncoras, teclado/foco, overflow, imagens e ausência de erros JS.
- Teclado: skip link, foco visível, ativação por Enter dos oito CTAs principais, Escape e retorno de foco no menu.
- CTAs de cada serviço: verificados destinos do hero, barra lateral, cabeçalho e contato; clique principal via teclado navega diretamente à home, âncora `#contato`, e seleciona o valor exato. IR também verificado com opção correta. Nenhum formulário demonstrativo foi introduzido.
- Página inexistente testada: HTTP 404 real, com texto da página de erro.
- Formulário central: campos obrigatórios, payload original, respostas 200/500 e falha de rede testados com interceptação. Nenhum dado fictício foi enviado ao n8n. O rascunho local de IR continua persistindo após recarregar.
- Lighthouse no Preview: **100 / 100 / 100 / 63** em três execuções mobile e três desktop. SEO 63 exclusivamente por noindex automático; CLS 0 em todas. LCP mediano mobile 1,635 s e desktop 0,393 s. Local: mobile **99 / 100 / 100 / 100**, desktop **100 / 100 / 100 / 100**; a diferença local de um ponto está registrada no relatório.
- [Evidência funcional local](evidence/validation-local.json), [evidência do Preview](evidence/validation-preview.json) e [medidas de layout](evidence/layout-comparison.json).

## Revisão editorial e preservação

Revisadas todas as páginas HTML públicas. No hub consular, “100% seguro” passou a “Conferência documental”; “Segurança em todo o processo” passou a “Orientação em cada etapa”; a promessa “mais simples, seguro e sem burocracia” passou à explicação de organização documental, requisitos e próximos passos. CTAs “especialista” foram padronizados para “Solicitar análise”. Não foram encontradas garantias afirmativas de agendamento, prazo ou deferimento a remover; as negações existentes de garantia e avisos de variação por consulado foram preservados.

Páginas de Privacidade/Termos, regras específicas, preço de IR existente, webhook/payload, credenciais, recursos visuais, fontes, dependências e configuração Vercel sem alterações nesta etapa. Sem Clicksign, pagamentos, banco, contratos, novos serviços ou preços. O checklist de IR mantém sua função local, distinta da solicitação de análise.

## Pendências e limites

1. **Aprovação expressa de Jennifer e Rodrigo** continua pendente. Sem merge ou publicação em produção; Etapa 2 não iniciada.
2. **n8n ponta a ponta** não foi testado com envio real. A interceptação confirma o contrato do cliente e o tratamento de respostas, sem comprovar recebimento no backend, banco ou atendimento.
3. Conteúdo técnico consular, políticas legais e escopo comercial legado (como áreas antigas em `italia.html`) continuam sujeitos a revisão humana. Nenhuma alteração substancial dessas regras foi feita.
4. Lighthouse é medição de laboratório da home, não prova de INP/CWV de campo, estabilidade permanente de nota ou auditoria manual completa. Testes em dispositivos físicos/Safari/Firefox e todos os cenários fiscais de IR não foram realizados.
5. SEO completo, domínio definitivo e Search Console permanecem para as etapas próprias; noindex do Preview mantido. A exceção de CA usada pelo ambiente nos testes remotos está documentada e não certifica TLS.
