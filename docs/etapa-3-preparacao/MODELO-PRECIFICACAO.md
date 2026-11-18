# Modelo interno de precificação — valores em branco

Autorizado apenas para preparação interna em 18/11/2026. Não é tabela pública, proposta ao cliente ou aprovação de pacotes. [JSON editável](MODELO-PRECIFICACAO.json) · [CSV editável](MODELO-PRECIFICACAO.csv). Vinte linhas cobrem as modalidades e hipóteses dos oito prioritários e preservam os demais registros, incluindo os quatro candidatos.

Todos os preços, custos, taxas, horas, vigências, margens e condições financeiras começam vazios. No JSON usa-se `null`; no CSV, célula vazia. **Ausência de informação não significa zero, gratuidade, taxa incluída ou serviço disponível.** Nenhuma integração consome esses arquivos.

## Campos a preencher

| Campo | Conteúdo a levantar | Responsável pela informação/decisão |
| --- | --- | --- |
| Serviço e modalidade | ID da matriz e hipótese de pacote correspondente | Jennifer e Rodrigo validam o recorte |
| Preço de venda sugerido | Valor privado, inicialmente em branco | Decisão comercial de Jennifer e Rodrigo após custos/escopo |
| Custo operacional estimado | Custo interno por unidade de serviço, com memória de cálculo | Jennifer informa trabalho documental; Rodrigo informa suporte e supervisão |
| Horas e custo-hora | Tempo por atividade e critério de custo, sem estimativas arbitrárias | Medir/levantar capacidade e trabalho reais |
| Custos de parceiros | Proposta de profissional habilitado/prestador, finalidade, validade e inclusão | Responsável do serviço e parceiro identificado |
| Taxas oficiais separadas | Órgão, procedimento, fonte, data, pagador e valor vigente quando verificado | Conferência da fonte oficial antes de orçar; não é receita privada presumida |
| Custos variáveis adicionais | Despesa efetivamente atribuível à venda, classificada sem duplicação | Levantamento operacional e validação contábil quando pertinente |
| Tributos sobre venda e custos do meio de pagamento | Incidência e condições reais aplicáveis | Informações fiscais/provedor competente; pagamentos continuam inativos |
| Prazo de acompanhamento | Vigência privada, marco inicial, pausas e encerramento | Aprovação expressa; separado de prazo oficial |
| Margem de contribuição em valor e percentual | Resultado calculável apenas com preço e custos variáveis confirmados | Jennifer/Rodrigo, com validação da classificação quando necessária |
| Parcelamento | Se admitido, limites, custo e condições | Decisão futura; campo vazio não habilita pagamento |
| Serviços adicionais | Atividades fora do escopo-base, sem duplicar a mesma tarefa | Definir escopo e responsável antes de oferecer |
| Continuidade | Critério de extensão, nova análise e novo aceite, sem renovação automática | Aprovar condições e instrumento adequado |
| Revisões e complexidade | Limite de complementos e critério objetivo de mudança de escopo | Definição operacional, não número inventado |
| Fonte/data dos custos e habilitação | Rastreabilidade do orçamento e profissional responsável | Manter evidência e conferir validade |
| Status/publicação/contratação | Rascunho; `publicavel=false`, `contratavel=false` | Só mudar após autorização específica e pendências resolvidas |

## Separação de custos e formação de margem

1. **Internos:** atendimento, triagem, organização, conferência material, digitalização, orientação operacional, revisão permitida, contatos, supervisão e encerramento. Levantar horas por modalidade. Registrar o que já está incluído para evitar custo/entrega duplicados.
2. **Parceiros:** discriminar profissional, tarefa, habilitação quando exigida e forma de contratação. Definir se o cliente contrata/paga diretamente ou se há repasse autorizado. Não presumir parceiro ou custo.
3. **Oficiais e terceiros:** taxas do órgão, certidões, tradução, apostila e logística são linhas separadas. Quando pagos diretamente pelo cliente, não compõem receita nem custo da Oliveira para cálculo da margem do serviço privado. Se houver recebimento/repasse pela empresa, validar tratamento contábil e documental antes de calcular; não tratar repasse como margem.
4. **Fixos e variáveis:** distinguir custo econômico interno/rateio de custos efetivamente variáveis. Salários, ferramentas ou despesas fixas rateadas não devem ser subtraídos automaticamente como se fossem todos variáveis na margem de contribuição. Registrar cada custo apenas uma vez.

Fórmulas de referência, sem executar cálculo sobre campos vazios:

```text
MC em valor = receita do serviço privado − custos variáveis atribuíveis confirmados
MC em % = MC em valor / receita do serviço privado × 100
```

O percentual só é calculável com receita positiva e dados suficientes. Impostos e custos de pagamento entram conforme classificação efetiva, sem dupla contagem. Não há percentuais, metas ou margens sugeridos neste rascunho. A margem de contribuição não é lucro líquido nem substitui o exame de custos fixos e capacidade.

## Hipóteses de duração preservadas

Passaporte primeira emissão: até 180 dias; renovação: até 60 dias. AIRE: preparação até 30 dias e controle após protocolo até 180 dias. São propostas históricas internas não aprovadas, registradas na [decisão conciliada](../decisoes/2026-11-18-responsaveis-cobertura-e-preparacao-comercial.md). Por isso o campo `prazo_acompanhamento` permanece vazio. Nunca utilizar esses números como promessa de órgão ou preenchimento automático do contrato.

## Sequência para definir valores posteriormente

Validar modalidade e entregas → resolver revisor/profissional/permissões → medir trabalho/capacidade → obter custos de parceiros e fontes oficiais → separar custos/repasse → definir vigência e condições → simular internamente com dados reais → aprovar preço/pacote → autorizar eventual apresentação. Nenhuma dessas etapas autoriza publicar, contratar ou ativar cobrança automaticamente.
