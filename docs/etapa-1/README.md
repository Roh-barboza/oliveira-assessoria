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
