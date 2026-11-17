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

Preview, capturas e medições Lighthouse finais serão anexados antes da conclusão, sem pontuações antecipadas. Envio real ao n8n não foi realizado.
