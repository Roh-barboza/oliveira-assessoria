# Etapa 2.1 — refinamento para aprovação comercial

Base: `fec7143`, entrega da Etapa 2. Mesma branch `feature/etapa-2-catalogo-servicos` e PR #6. Esta revisão não aprova serviços nem inicia a Etapa 3.

## Implementado

- Oito páginas italianas: dois CTAs de análise no conteúdo principal (abertura e fim), em vez de três. A barra lateral passa a ser um índice nativo recolhível, com links para atividades, exclusões, documentos, etapas, limitações, FAQ e fontes. No celular aparece antes da leitura, fechado; funciona sem JavaScript e por teclado.
- Avisos de triagem, checklist e uso de fontes mais diretos; etapas resumidas sem eliminar as cinco fases. Quatro FAQs redundantes foram retiradas porque suas respostas já permanecem nas exclusões/limitações. As páginas mantêm de três a quatro perguntas úteis.
- Listas de atividades propostas, exclusões e documentos, textos específicos de limitações e links oficiais das oito páginas foram preservados e comparados automaticamente com a base.
- IR: resumo repetido de etapas substituído por índice; link de checklist local aparece uma vez, separado da solicitação de análise. Abertura e fim da página permitem solicitar análise com o serviço correto. Aviso de checklist local sem envio à equipe continua claro. Documentos, exclusões, etapas, segurança, FAQ e fontes preservados.
- INSS, Processos Administrativos e Organização Documental permanecem no catálogo e na home, agora com rótulo **Em validação comercial**, descrição das decisões de escopo ainda necessárias e CTA de consulta de possibilidade. Os valores de seleção e destinos do formulário não mudaram. Não foram convertidos em novas ofertas definitivas nem removidos.
- Busca, filtros e categorias Itália/Brasil preservados. Sem alterações no JavaScript de busca, recursos visuais, fontes, dependências ou formulário n8n.

## Decisão comercial

- [Matriz completa em Markdown](MATRIZ-DECISAO-COMERCIAL.md) e [JSON](MATRIZ-DECISAO-COMERCIAL.json): nome, público, atividades propostas/excluídas, executor, cobertura, habilitação/parceiro, pendências e status por serviço.
- **12 pendentes, 4 candidatos, 0 aprovados.** Executor e cobertura continuam a confirmar, sem atribuir responsabilidade a pessoas não nomeadas.
- Passaporte brasileiro é **candidato prioritário**; sem página, opção comercial ou execução publicada.
- Negociação de Dívidas, Precatórios e Contratos permanecem fora das ofertas até validação específica.
- [Lista objetiva do que Jennifer e Rodrigo precisam confirmar](CONFIRMACOES.md).

## Preservação

Sem preços, pacotes, checkout, novas ofertas, merge ou produção. Clicksign, n8n, payload/endpoint, credenciais, banco, contratos, pagamentos, extensão e lógica do checklist IR não foram alterados. Logo, foto da home, fontes locais, busca e tokens de identidade continuam iguais à base. WhatsApp segue aguardando número empresarial, conforme preferência salva.

Nenhum requisito legal, prazo, taxa ou procedimento oficial novo foi acrescentado nesta revisão editorial. As fontes e suas limitações continuam na documentação da Etapa 2. Não foi atribuída habilitação profissional à empresa.

## Validação

Testes locais passaram: 18 páginas × 7 larguras (360, 390, 430, 768, 1024, 1366, 1920), busca/filtros, menu, links e âncoras, teclado/foco, axe, ausência de overflow e erros JS, imagens, seleção de serviços, 404, simulações interceptadas de leads e rascunho IR. Novas verificações cobrem limite de CTAs, índice nativo e os três rótulos de validação comercial.

## Entrega para aprovação comercial

- **Preview atualizado:** https://oliveira-assessoria-1yoa9gtt2-barbozaa-s-projects.vercel.app/servicos.html
- **PR #6:** https://github.com/Roh-barboza/oliveira-assessoria/pull/6
- Vercel READY, ambiente Preview, deployment `dpl_5bDoPp6h9VWs9ounoXrTy7UbyQfe`, implementação `84d2bcee81fdea6204259bb0d17547308d434961`. Commits posteriores desta entrega apenas registram documentação/evidências; os arquivos servidos continuam iguais aos testados.
- [Capturas desktop/mobile e comparação antes/depois](VISUAL.md).
- [Lighthouse atualizado, condições e relatórios brutos](PERFORMANCE.md).
- [Arquivos modificados nesta revisão](ARQUIVOS.md).
- [Matriz para aprovação](MATRIZ-DECISAO-COMERCIAL.md) e [confirmações necessárias](CONFIRMACOES.md).

A suíte final passou também no Preview: 18 páginas × 7 larguras, totalizando 126 combinações em cada ambiente. Verificou o índice por teclado, número de CTAs, links de checklist, categorias pendentes, busca, filtros, menus, foco/contraste automático axe, imagens, overflow, erros JS, seleção de serviços, 404 e tratamento do formulário com interceptação. [Resultado local](evidence/validation-local.json) · [Resultado final do Preview](evidence/validation-preview.json).

Na rodada inicial do Preview houve uma ocorrência pontual de imagem não carregada (logo em `404.html`, 1366 px). A URL retornou HTTP 200 e bytes idênticos ao arquivo do repositório; duas verificações focadas carregaram ambos os logos sem falhas. A suíte inteira foi repetida e passou, sem alteração de aplicativo ou recurso entre as rodadas. A causa não foi determinada e a ocorrência não foi ocultada: [registro inicial](evidence/validation-preview-initial.json), [verificação](evidence/preview-image-check.json).

Comparação automatizada confirmou listas de atividades, exclusões e documentos, limitações e links oficiais preservados nas oito páginas: [evidência](evidence/content-preservation.json). Em 390 px, a altura de AIRE caiu 13,4% e IR 10,1%; a contagem de texto DOM caiu 16,4% e 8,2%, respectivamente. As capturas e critérios da contagem estão no relatório visual.

Lighthouse: 24 execuções em home, catálogo, AIRE e IR, com três por perfil em cada página. Catálogo/AIRE/IR: Performance 100 nos dois perfis; home mobile 99–100, desktop 100. Acessibilidade e Boas práticas 100 em todas; SEO 63 pelo noindex automático, mantido. CLS máximo 0,000808, sem alegação de zero exato em todas as execuções.

## Limites e próximas decisões

Nenhuma linha da matriz foi aprovada automaticamente. Jennifer e Rodrigo devem confirmar executor, cobertura, tarefas, exclusões, habilitação/parceiros e status de cada serviço. As três categorias brasileiras continuam presentes e pendentes; os quatro candidatos continuam fora das ofertas, com passaporte brasileiro prioritário para avaliação.

Envio real ao n8n não foi realizado. As simulações foram interceptadas antes do webhook. Não houve teste em dispositivos físicos, Safari/Firefox, auditoria manual completa de acessibilidade, medição de campo ou revisão integral dos cenários fiscais IR. Nenhum requisito oficial novo foi apresentado como confirmado nesta revisão editorial.

Etapa 3 não iniciada. Sem merge ou produção, preços, pacotes, novos serviços comerciais ou alteração de Clicksign/n8n/credenciais/contratos/pagamentos. A matriz e a lista de confirmações são o material concreto para a decisão comercial.
