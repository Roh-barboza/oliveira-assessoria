# Etapa 1 — redesign premium e validação

Base: `feature/jennifer-ir-assistant-mvp` (`2adb1afa303e6e0d82147de985a401575c6505be`).
Branch: `feature/etapa-1-premium-responsiva`.

Implementação restrita à apresentação, navegação, acessibilidade, imagens, fontes e integridade de roteamento. Preserva serviços, URLs, textos legais, preço de IR já existente e contrato de envio do formulário da home. Não altera n8n, credenciais, Clicksign, pagamentos, extensão ou lógica do checklist de IR.

## Implementado

- Sistema visual em `landing/site.css`: verde profundo, creme, dourado com contraste, tipografia editorial, espaçamentos, botões, foco e componentes compartilhados.
- Cabeçalho, logo e rodapé consistentes em todas as páginas institucionais e de serviços; ferramentas de IR mantêm controles próprios e recebem as mesmas fundações visuais.
- Menu responsivo acessível, Escape com retorno de foco, fechamento por link e navegação disponível sem JavaScript. Link para pular ao conteúdo e respeito a movimento reduzido.
- Home com contexto Brasil/Itália, CTA de serviços e análise, conteúdo institucional independente e formulário central preservado.
- Foto original completa, sem corte do rosto/passaporte, com versões WebP de 640/960 px, srcset/sizes, dimensões explícitas e prioridade LCP. Foto abaixo da dobra adiada. Imagens inválidas legadas deixam de ser referenciadas.
- Fontes WOFF2 locais com licenças OFL e preload; ícones SVG locais. Eliminadas dependências de Google Fonts, Font Awesome e Pexels durante a navegação.
- Formulários consulares de demonstração substituídos por CTA para o formulário central; serviço pré-selecionado via query string. O botão flutuante agora corresponde à ação de abrir contato.
- Removidos links para seções inexistentes; descrição e estrutura semântica revisadas. URLs existentes mantidas. Removido fallback global para a home: arquivos inexistentes passam a 404. Sem sitemap, domínio definitivo ou estratégia de indexação nesta fase.
- Código HTML antes comprimido em uma linha formatado para manutenção. Testes e auditoria reproduzíveis, sem framework em produção.

## Validação

`npm ci --ignore-scripts`, `npm test`, `npm run audit`. Chromium disponível em `/usr/bin/chromium`; para outra instalação use `CHROME_PATH`. O teste sobe um servidor local isolado; para Preview use `BASE_URL`. `EVIDENCE_DIR` define a pasta dos resultados. Auditoria roda três vezes por perfil, com as configurações oficiais mobile/desktop do Lighthouse.

Resultados completos, capturas, métricas e checklist serão anexados nesta branch após a validação do Preview. Nenhum merge ou deploy de produção está autorizado.

## Entrega para avaliação

- [Comparação visual antes/depois](VISUAL.md).
- [Medições Lighthouse, condições e relatórios brutos](PERFORMANCE.md).
- [Checklist de aprovação para Jennifer e Rodrigo](APROVACAO.md).
- [Lista completa de arquivos alterados](ARQUIVOS.md).
- [Validação local](evidence/validation-local.json) e [validação do Preview](evidence/validation-preview.json).
- **Preview validado:** https://oliveira-assessoria-i7jrm8te6-barbozaa-s-projects.vercel.app/
- **Vercel:** projeto `oliveira-assessoria`, deployment `dpl_DQG3Z8k7tjTduJ4kJuXUd8URxGnR`, estado `READY`, ambiente Preview, implementação `64b5062ea8b60215c393e115958b03408c16fe30`.

## Validação executada

Não existia suíte de testes de frontend nem comando de build na base. A arquitetura continua estática; a Vercel concluiu o build/deploy do Preview. Foi adicionada uma suíte reproduzível com `npm test` (Playwright + axe), e `npm run audit` (Lighthouse).

As mesmas verificações passaram localmente e no Preview: 17 páginas (16 existentes mais a nova 404), nas larguras 360, 390, 768, 1024, 1366 e 1920 px, totalizando 102 combinações por ambiente. Sem overflow horizontal, imagens quebradas ou erros de execução JavaScript. Links locais e âncoras conferidos. Axe WCAG 2 A/AA e 2.1 A/AA sem violações automáticas na apresentação inicial de cada página a 390 px. Menu verificado com abrir/fechar, Escape, retorno de foco, clique em link e versão sem JS. Capturas foram inspecionadas para home, serviços e IR em mobile e desktop.

### Fluxo de contato

| Fronteira | Evidência | Situação |
| --- | --- | --- |
| CTA interno → contato central | URL com serviço válido e opção pré-selecionada; teste no Preview | Passou |
| Formulário → pedido HTTP | POST interceptado, URL original, Content-Type JSON e mesmo payload `nome`, `whatsapp`, `area`, `mensagem` | Passou sem atingir n8n |
| Resposta → interface | Sucesso limpa formulário; HTTP 500 e falha de rede preservam dados e exibem erro; botão reativado | Passou com respostas simuladas |
| n8n → banco/atendimento/WhatsApp | Não houve envio real ou consulta ao backend nesta etapa | **Pendente** |

Todos os pedidos de teste ao webhook foram interceptados pelo navegador. Nenhum lead fictício foi enviado. Isso valida a preservação do contrato de integração no cliente, **não comprova a operação ponta a ponta do n8n**. O checklist IR teve a continuidade e persistência do rascunho local verificadas; sua lógica, exportação e extensão não foram alteradas. Todas as etapas ocultas e todos os cenários fiscais não foram revalidados nesta etapa visual.

### Formulários demonstrativos identificados

A base tinha formulários stub em `servicos-consulares.html`, nos oito arquivos `servicos/*.html`, e campos sem envio em `italia.html`. Eles foram substituídos por links claros ao contato central. Nenhum deles foi conectado a uma nova integração. O checklist `ir/formulario.html` continua sendo uma ferramenta local, explicitamente sem envio; `ir/laboratorio.html` permanece um laboratório, com noindex.

## Problemas corrigidos

Identidades visuais divergentes; perda de navegação mobile nas páginas legadas; falta de foco e skip link; contraste insuficiente em números/ações; recorte da foto principal; ícones/fontes dependentes de terceiros; imagem externa sem dimensões; formulários que aparentavam receber pedidos; ícone de WhatsApp com destino incorreto; links para `/#blog`, `/#sobre` e `/#servicos` inexistentes; ausência de navegação nas páginas legais; fallback que entregava home/HTTP 200 em URLs inexistentes. A nova 404 foi confirmada na Vercel; `/robots.txt` e `/sitemap.xml` agora retornam 404 real, sem simular arquivos já implantados.

## Pendências e limites

1. **Aprovação visual de Jennifer e Rodrigo**, incluindo o enquadramento integral da foto e o layout editorial. Nenhum merge ou publicação em produção foi executado.
2. **Teste real da automação n8n**, com rastreamento de recebimento e saída; envio ponta a ponta não comprovado por este PR.
3. **Conteúdo comercial/técnico legado:** `italia.html` mantém as áreas já cadastradas (incluindo Precatórios e Contratos) e o hub consular mantém expressões como “100% seguro” e “sem burocracia”. Essas alegações já existiam; precisam de revisão/aprovação editorial e de escopo. Não foram criados novos serviços ou garantias. Os rótulos institucionais “jurídico” foram alinhados à apresentação administrativa/documental, conforme o pedido. Preço de IR preexistente foi preservado.
4. Textos de Privacidade e Termos mantidos integralmente no conteúdo do `main` (comparação de texto antes/depois com normalização de espaços); qualquer revisão jurídica continua pendente.
5. **SEO completo na Etapa 5:** sitemap, robots, canonical, Open Graph, dados estruturados, Search Console, estratégia de indexação e domínio final não implantados. O Preview continua com noindex automático da Vercel; não desativado para melhorar nota.
6. **Dados de campo:** INP e CWV no percentil 75 exigem tráfego real e monitoramento futuro. Lighthouse não é auditoria manual completa de acessibilidade nem teste em dispositivos físicos/Safari/Firefox. TLS não foi certificado pelos testes do ambiente.
7. Arquivos CSS/JS legados não referenciados foram preservados para evitar remoções fora da revisão. Não são carregados pelas páginas redesenhadas. Os arquivos de imagem inválidos legados também deixam de ser usados, sem alteração de URLs das páginas.
8. A memória antiga `CLAUDE.md` descreve um contexto comercial e prioridades antigas; a nota adicionada aponta este pedido e a issue #4 como escopo atual. Nenhuma ação de banco, seed, credencial, contratação ou pagamento foi executada.

O PR deve ser avaliado contra a branch de referência `feature/jennifer-ir-assistant-mvp`, preservando separação das branches de contratação. Após aprovação visual, o responsável pode decidir o fluxo de integração à produção. **Não avançar para a Etapa 2 antes da aprovação expressa.**
