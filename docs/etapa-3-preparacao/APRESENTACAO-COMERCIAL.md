# Estrutura futura de apresentação — especificação interna

Não implementada no site nem no Preview. O catálogo atual permanece intacto. Não é necessário criar componentes ou carregar JSON/CSV internos no frontend nesta preparação.

## Composição prevista

1. Título do serviço e modalidades comparáveis, na categoria Brasil/Itália existente.
2. Descrição curta de finalidade e público, com escopo aprovado como pré-condição.
3. Quadro de comparação com: atividades incluídas, entregas, volume/revisões efetivamente acordados, acompanhamento e encerramento.
4. Valor privado somente quando real, aprovado e autorizado para divulgação. Sem `R$ 0`, preço fictício, “a partir de” inventado ou desconto demonstrativo.
5. Taxas oficiais e terceiros separados: o que pode ser necessário, quem presta/cobra e se está ou não incluído; valores só após verificação.
6. Responsabilidades do cliente e do órgão, atos pessoais, canal de atendimento e limites profissionais.
7. Continuidade/extensão e adicionais, sem renovação ou cobrança automática.
8. Solicitação de análise como ação inicial. Checkout, pagamento, contrato e WhatsApp real não são ativados por esta especificação.

## Padrão visual e acessibilidade

Reutilizar as fontes locais, verde/creme/dourado, espaçamentos e botões já presentes em `landing/site.css` e `landing/catalogo.css`, sem dependência nova. Em desktop, comparação sem excesso de cartões; no mobile, leitura vertical com rótulos persistentes para cada critério. Usar títulos, listas e tabelas semânticas quando apropriado, foco visível, contraste e navegação por teclado.

Os blocos devem mostrar claramente serviço privado, despesas externas, entregas e vigência. Não usar destaque de urgência ou disponibilidade presumida. Texto não deve sugerir vínculo com consulado, PF ou Receita. Ausência de preço não deve gerar valor zero por fallback.

## Portas de liberação futura

Somente após aprovação comercial/profissional e autorização de publicação, selecionar manualmente os serviços e modalidades liberados. Itens pendentes ficam em tratamento a decidir; candidatos não viram cartões de venda. A atual etiqueta “em validação comercial” será revista em tarefa futura apenas para itens formalmente aprovados, sem esconder o inventário interno.

Não copiar o modelo interno integral para o site. Converter somente os dados aprovados em conteúdo público minimizado, com revisão humana, mantendo fora dele custos, margens e hipóteses. Passaporte brasileiro exige decisão específica antes de qualquer anúncio.
