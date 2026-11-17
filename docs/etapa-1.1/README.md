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

O relatório final e as capturas serão incluídos após a medição do Preview atualizado. Aprovação visual de Jennifer e Rodrigo continua pendente; a Etapa 2 não foi iniciada.
