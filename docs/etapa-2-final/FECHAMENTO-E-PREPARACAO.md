> **Aceite operacional (18/11/2026):** o usuário autorizou seguir com os limites de duração/revisão e conferência cruzada de Jennifer/Rodrigo para os cinco serviços A, como **modelo interno**. Não é liberação de venda. [Registro](../decisoes/2026-11-18-aceite-operacional-cinco-servicos.md) · [Procedimento documental a implantar](PROCEDIMENTO-DOCUMENTAL-SEGURO.md). **Bloqueios residuais:** G1 contratual, G2 capacidade/limites de atuação, G3 configuração e testes de segurança documental.

> **Rodada única vigente:** [DECISAO-COMERCIAL-FINAL](DECISAO-COMERCIAL-FINAL.md) apresenta as sete recomendações com documentos, revisões, vigência privada, encerramento e bloqueios G1–G5. Os limites são propostos, sem aprovação automática.

# Fechamento documental da Etapa 2 e preparação interna da Etapa 3

> **Atualização de seleção comercial (18/11/2026):** Jennifer e Rodrigo confirmaram em conjunto a escolha preliminar **A** para Passaporte italiano, AIRE, FAST IT, Regularização consular e Organização documental e **C (adiar)** para Registro de filhos e Imposto de Renda. Passaporte brasileiro segue candidato. Os cinco A **não** estão liberados para venda, pois ainda restam aceite das condições específicas e comprovação de G1–G3. Ver [decisão registrada](../decisoes/2026-11-18-selecao-comercial-preliminar.md) e [pendências atualizadas](PENDENCIAS-APROVACAO.md).

Atualização: 18/11/2026. Base desta revisão documental: `26d9977`. [PR #6](https://github.com/Roh-barboza/oliveira-assessoria/pull/6).

## Entregue

- [Decisão operacional rastreável](../decisoes/2026-11-18-responsaveis-cobertura-e-preparacao-comercial.md): Jennifer no atendimento/documentação, Rodrigo no suporte operacional/digital e supervisão, cobertura inicial SP. Os comentários do PR foram conciliados; propostas superadas não viraram condições contratuais.
- [Matriz comercial](MATRIZ-CONSOLIDADA.md) e [JSON](MATRIZ-CONSOLIDADA.json): 16 registros preservados, oito prioridades, modalidades, atividades, entregas, limites, despesas, responsabilidades e pendências reais. Segundo revisor/profissional continuam separados do responsável operacional. Status: **12 pendentes, quatro candidatos, zero aprovados**.
- [Modelo interno de precificação](../etapa-3-preparacao/MODELO-PRECIFICACAO.md), em [CSV](../etapa-3-preparacao/MODELO-PRECIFICACAO.csv) e [JSON](../etapa-3-preparacao/MODELO-PRECIFICACAO.json): vinte linhas por modalidade/hipótese, com preço, custos, taxas, horas, vigência, margem e parcelamento vazios. Sem tratar ausência como zero ou gratuidade.
- [Hipóteses de composição](../etapa-3-preparacao/PACOTES.md): primeira emissão/renovação de passaporte, inscrição/atualizações AIRE, FAST IT avulso, regularização personalizada, três níveis documentais e filhos/IR conforme modalidade/complexidade e validação profissional. Candidatos sem pacote comercial liberado.
- [Apresentação futura premium](../etapa-3-preparacao/APRESENTACAO-COMERCIAL.md): comparação por entregas, limites, acompanhamento e despesas, sem implementar componentes ou expor custos/margens internos.
- [Arquitetura operacional](ATENDIMENTO-ARQUITETURA.md) e [lista de decisões restantes](PENDENCIAS-APROVACAO.md) atualizadas com papéis/cobertura confirmados, sem repetir esses pontos como sugestões.

## Verificação desta atualização

[Evidência de consistência e preservação](evidence/verificacao-fechamento.json): inventário/status, oito prioridades, vinte linhas, campos financeiros vazios, referências válidas e ausência de alterações em site, dependências, scripts/testes ou integrações.

Não foram repetidos testes de navegador ou Lighthouse: esta tarefa altera somente documentação interna e a matriz, sem modificar arquivos servidos. Os [testes anteriores](TESTES.md), [24 capturas](VISUAL.md) e [30 medições Lighthouse](PERFORMANCE.md) continuam vinculados à implementação `5d40796`, não são medições novas desta revisão. Performance medida 99–100, Acessibilidade e Boas Práticas 100; SEO 63 pelo noindex. Limites de CA, medição de laboratório e acessibilidade automatizada continuam registrados nos relatórios originais.

[Preview técnico anteriormente verificado, sem alterações visuais desta tarefa](https://oliveira-assessoria-90onhrh0b-barbozaa-s-projects.vercel.app/). Nenhum deploy manual foi solicitado; esta entrega não altera o conteúdo do site ou autoriza publicação. Documentos de precificação ficam fora de `landing/`, diretório servido.

## Situação de encerramento

| Frente | Situação |
| --- | --- |
| Apresentação técnica do catálogo | Entregue e validada na revisão anterior; preservada |
| Divisão operacional e princípio de cobertura SP | Confirmados nesta decisão |
| Estrutura interna de precificação/pacotes | Preparada, sem valores nem liberação comercial |
| Escolha preliminar de modalidades de lançamento | **Concluída: A para cinco; C para filhos e IR** |
| Modelo operacional de prazos e revisão cruzada | Aceito em 18/11/2026 para os cinco A, sem assinatura ou habilitação presumida |
| Aprovação comercial final por serviço/modalidade | Pendente, exige G1 residual, G2 residual e G3 implantado/testado para as cinco A |
| Profissionais habilitados, revisão, limites e instrumentos | Pendentes conforme a modalidade |
| Encerramento formal da Etapa 2 | Ainda impedido pelas decisões comerciais/profissionais/operacionais remanescentes |
| Implementação comercial, pagamentos, automação e publicação | Não autorizados |

Jennifer e Rodrigo **já escolheram as modalidades** A/C. O modelo de limites e revisão cruzada dos cinco serviços A já foi aceito operacionalmente. Agora precisam validar juridicamente os termos, comprovar a capacidade/limites de atuação e implantar/testar o procedimento documental seguro (G1–G3 residuais). Depois levantarão custos e deliberarão sobre valores/parcelamento na Etapa 3. Filhos e IR exigem validações específicas; passaporte brasileiro segue candidato até decisão própria. Não é necessário aprovar todos os serviços para encerrar a etapa, mas o conjunto liberado e os itens adiados precisam de registro expresso.

A preparação interna da Etapa 3 está expressamente autorizada em paralelo; não resolve os impedimentos nem libera venda. Sem valores inventados, merge, publicação de alteração visual/funcional, contratações, mensagens, automações ou pagamentos. Clicksign e webhook n8n preservados. WhatsApp ainda aguarda número empresarial.

Não é necessário preencher preços, custos ou margens para declarar a Etapa 2 encerrada quando seus próprios bloqueios forem resolvidos. Esses dados continuam necessários à decisão de valores na Etapa 3, e não devem ser inventados para fechar a etapa anterior.
