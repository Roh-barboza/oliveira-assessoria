# Etapa 2 — catálogo premium para revisão

**Implementação preparada em Preview, sujeita à revisão de Jennifer e Rodrigo.** Mesma branch `feature/etapa-2-catalogo-servicos`, PR #6, base `feature/etapa-1-premium-responsiva`. Sem merge, produção ou início da Etapa 3.

## Catálogo encontrado

12 entradas existentes: 8 italianas (Passaporte, AIRE, Fast It, Estado civil, Registro de filhos, Certidões, Carta d’Identità e Regularizações) e 4 brasileiras (IR, INSS, Processos administrativos e Organização documental). Existência confirmada nos arquivos não significa aprovação comercial do escopo.

Três categorias legadas — Negociação de Dívidas, Precatórios e Contratos — estavam apenas na página antiga, sem correspondência no formulário atual. Passaporte brasileiro foi acrescentado somente à documentação como possibilidade futura solicitada, não como oferta pública. Nenhum desses quatro candidatos foi implementado como novo serviço.

## Implementado

- `/servicos.html`: catálogo completo por Itália/Brasil, busca local por título e descrição, filtro de categoria, contador e estado vazio. Busca ignora acentos, maiúsculas e diferenças de pontuação; nenhum dado é enviado a um backend. Sem JavaScript todos os serviços permanecem disponíveis.
- Home mantém serviços existentes e CTAs de análise; “Explorar serviços” e links de categoria levam ao catálogo completo. Cabeçalhos e rodapés públicos recebem navegação rastreável para o catálogo. O CSS específico do catálogo não é carregado na home.
- Oito páginas consulares existentes padronizadas com nome/descrição, público, atividades, exclusões, checklist indicativo, cinco etapas, limitações, quatro FAQs, fontes oficiais e CTA direto ao formulário com serviço pré-selecionado. Sem nova coleta de dados, preços ou garantias.
- Página existente de IR recebe público, documentos indicativos, exclusões e fontes oficiais; preserva checklist local e sua lógica. O preço legado “a partir de R$ 149” sai da apresentação pública conforme a instrução expressa desta etapa de não incluir preços. Nenhum novo valor foi definido.
- As três categorias brasileiras amplas permanecem disponíveis para análise de escopo, identificadas como condicionais; não receberam páginas comerciais detalhadas sem definição operacional.
- AIRE/Fast It, Estado civil/filhos e regularização/serviços específicos têm fronteiras explicitadas. Instruções de São Paulo não são tratadas como requisitos universais.
- Assessoria privada opcional é diferenciada dos procedimentos oficiais, inclusive gratuitos. Sem promessa de agendamento, emissão, deferimento ou prazo controlado por autoridade.
- As três categorias brasileiras legadas deixam de ser promovidas nos chips de `italia.html`; permanecem inventariadas como sugestões internas até decisão de escopo. URL da página e suas âncoras continuam existentes.
- URLs das páginas mantidas; âncoras antigas de contato e `#requisitos`/`#faq` de passaporte preservadas. Sem redirecionamento de domínio.

## Conteúdo e rastreabilidade

- [Matriz completa por serviço e status comercial](CATALOGO-SERVICOS.md), incluindo tabelas dos 12 existentes e 4 candidatos/legados.
- [Fontes oficiais e limites da revisão](FONTES-E-REVISAO.md).
- [Catálogo estruturado atualizado](CATALOGO-PROPOSTO.json).
- [Inventário anterior à implementação](INVENTARIO.json) e [primeiras fichas de planejamento](FICHAS.md) permanecem como histórico; a matriz CATALOGO-SERVICOS é a referência atual.
- [Checklist de aprovação e decisões pendentes](APROVACAO.md).

A documentação histórica de `CLAUDE.md` contém afirmações antigas sobre atividades jurídicas que não foram usadas como fundamento para a oferta. Consultoria e assessoria jurídicas não foram incluídas no apoio administrativo. Responsabilidades profissionais e comerciais devem ser validadas antes de aprovar o escopo definitivo.

## Preservação

Logo, foto da home/enquadramento, arquivos de imagem, fontes WOFF2, tokens visuais e menu acessível preservados. Sem novas dependências. Contrato do formulário central, endpoint/payload n8n, credenciais, Clicksign, banco, pagamentos, extensão e lógica de IR inalterados. Páginas legais mantêm seu conteúdo principal; apenas o rodapé aponta ao catálogo.

WhatsApp segue [registrado como pendência](../decisoes/2026-11-17-whatsapp-e-continuidade.md): usar ícone e link real quando o número empresarial for fornecido. Até lá, contato por formulário sem número fictício.

## Validação e entrega

Testes locais passaram: 18 páginas × 7 larguras (360, 390, 430, 768, 1024, 1366 e 1920), menu, links e âncoras, teclado/foco, axe, imagens, overflow, busca e filtros, conteúdo padronizado, 404, seleção de serviços e simulações interceptadas de leads. Nenhum lead fictício foi enviado ao n8n.

**Preview validado:** https://oliveira-assessoria-kdd04ek49-barbozaa-s-projects.vercel.app/servicos.html

Vercel READY, ambiente Preview, deployment `dpl_GF72yGrUaGCqjV2kvGZv6pTcC7JP`, implementação `222faf3e414607fb4b550741a09d1bf5c71e1920`. Commits posteriores desta entrega só acrescentam documentação e evidências; os arquivos servidos permanecem iguais aos testados.

- Testes também passaram **no Preview**: 18 páginas × 7 larguras, 126 combinações por ambiente, com os mesmos testes funcionais. [Evidência local](evidence/validation-local.json) · [Evidência do Preview](evidence/validation-preview.json).
- Lighthouse: 3 execuções mobile e 3 desktop de cada uma das páginas home e catálogo. Catálogo: 100 / 100 / 100 / 63 em todas. Home: Performance mobile 99–100, desktop 100; Acessibilidade e Boas práticas 100, SEO 63; CLS 0. O noindex automático permanece. [Relatório, comparação e condições](PERFORMANCE.md).
- [Capturas atualizadas, antes/depois e organização visual](VISUAL.md).
- [Lista completa de arquivos alterados na Etapa 2](ARQUIVOS.md).
- PR específico da Etapa 2: https://github.com/Roh-barboza/oliveira-assessoria/pull/6 (base: branch da Etapa 1.1). Sem merge.

A confirmação de HTTP na Vercel inclui catálogo e AIRE com 200/noindex, URL inexistente com 404, e checklist IR mantendo noindex/nofollow e no-store. Nenhum pedido de teste atingiu o n8n: todos os cenários de sucesso, HTTP 500 e falha de rede foram interceptados. Validação por teclado inclui skip link, foco visível, Escape e ativação dos CTAs dos 8 serviços via Enter.

Limitações: não houve envio real, teste em dispositivos físicos, Safari/Firefox, auditoria manual completa de acessibilidade, medição de campo ou revisão de todos os cenários fiscais do checklist IR. Não foi declarada aprovação jurídica ou comercial da operação.

## Pendências para aprovação

Consulados/regiões atendidos; escopo e responsáveis por serviço; exercícios de IR; benefícios e tarefas INSS; órgãos/processos administrativos; entregáveis de organização documental; continuidade dos 3 legados; decisão sobre passaporte brasileiro; revisão profissional dos limites de atuação. Checklist é indicativo e não substitui instruções oficiais do caso.

Nenhum serviço foi marcado como comercialmente aprovado por esta implementação. Catálogo pronto para revisão, não autorização automática de contratação, taxas, pacotes, merge ou publicação. Etapa 3 aguarda aprovação do catálogo. Envio real ao n8n não foi realizado.
