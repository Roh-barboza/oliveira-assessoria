# Finalização da Etapa 2 — catálogo pronto para última revisão

Fonte: [proposta consolidada de 18/11/2026](../decisoes/2026-11-18-proposta-consolidada-8-servicos.md). Branch `feature/etapa-2-catalogo-servicos`, [PR #6](https://github.com/Roh-barboza/oliveira-assessoria/pull/6), base de implementação desta revisão `2f3b9c3`.

**12 pendentes, 4 candidatos, 0 aprovados.** Sete serviços existentes prioritários receberam escopo estruturado; passaporte brasileiro é o oitavo prioritário e permanece candidato interno. O restante do catálogo continua preservado. A autorização de estruturar não foi convertida em aprovação comercial.

## Apresentação preparada

- Catálogo mantém 12 entradas, separação Itália/Brasil, busca local, filtros e funcionamento sem JavaScript. Prioritários consulares aparecem primeiro; todos os cartões informam validação comercial. Nenhum candidato virou oferta.
- Oito fichas italianas preservam URLs, âncoras e fontes; agora explicitam público, atividades, checklist indicativo, cinco etapas, entregas, responsabilidades, exclusões, condições, FAQ e solicitação de análise na abertura e no fim.
- Passaporte italiano diferencia primeira emissão/renovação e suporte limitado a andamento informado pelo cliente, sem automação de vagas ou credenciais.
- AIRE distingue inscrição, endereço, circunscrição e atualizações; Registro Civil tem canal próprio, não é atualização pelo FAST IT em São Paulo. FAST IT é suporte de plataforma, sem duplicar apoio já incluído. Regularização é triagem e mapa de pendências, sem execução ilimitada.
- Organização Documental ganha ficha de escopo proposto em `/servicos/organizacao-documental.html`, sem aprovação ou liberação de contratação: todas as cinco atividades da proposta, pedidos de certidão somente quando permitidos, autorizações, conferência material e coordenação de prestadores competentes.
- Registro de filhos exige revisão técnica e, quando necessário, profissional habilitado. Não pressupõe cidadania automática nem equivalência entre registro, transcrição e aquisição.
- IR mantém layout, checklist local e lógica existentes; explicita limites profissionais, perfis e exercícios a confirmar, entregas e preparação/transmissão apenas após definição e validação específica. Não anuncia execução completa indiscriminada.
- INSS, Processos Administrativos, Estado Civil, Certidões e CIE permanecem presentes e pendentes. Negociação de Dívidas, Precatórios e Contratos continuam fora das ofertas.

## Material de decisão e arquitetura

- [Matriz consolidada dos 16 registros](MATRIZ-CONSOLIDADA.md) e [JSON](MATRIZ-CONSOLIDADA.json).
- [Dados das fichas estruturadas](SERVICOS-ESTRUTURADOS.json).
- [Pendências comerciais e profissionais](PENDENCIAS-APROVACAO.md).
- [Passaporte brasileiro: material interno, não publicado](PASSAPORTE-BRASILEIRO-CANDIDATO.md).
- [Arquitetura futura de atendimento e follow-ups — inativa](ATENDIMENTO-ARQUITETURA.md).

Arquitetura documenta componentes, entidades, estados, executor/revisor, pendências, histórico, modalidade/vigência, origem de protocolos, alertas, deduplicação, consentimento, pausa, encerramento e continuidade. Não cria banco, agente, fila, cron ou integração. Papéis de Jennifer/Rodrigo e piloto SP são propostas não aceitas formalmente. Hipóteses de vigência de 180/60 dias de passaporte ficam apenas internas; não são prazos oficiais ou compromissos aprovados.

## Preservação

Logo, fotografia, fontes locais, tokens visuais, estilos e dependências preservados. Nenhum JavaScript de produção foi alterado. Formulário mantém endpoint e payload n8n; seleção de serviços existente continua funcionando. A nova ficha documental usa a opção já existente. Nenhum upload, senha ou autenticação é coletado por ela.

Clicksign, n8n, banco, credenciais, extensão e lógica do checklist IR, contratos e pagamentos não foram alterados. Nenhuma mensagem automática ou cobrança foi ativada; nenhum lead de teste foi enviado ao webhook. WhatsApp permanece aguardando número empresarial, sem link fictício.

Sem preços, pacotes, merge, produção, contratação real ou início da Etapa 3. Fontes e checklists continuam indicativos, sem novos requisitos, taxas ou prazos oficiais universais. Validar fonte específica antes da execução de cada caso.

## Verificação e entrega

Validação local concluída: **19 páginas × 7 larguras**, 133 combinações, sem falhas registradas. Busca/filtros, teclado, menu, links, âncoras, axe, imagens, overflow, erros JS, formulário interceptado e persistência local do checklist IR. [Resultado local](evidence/validation-local.json) · [Preservação de recursos, fontes oficiais e checklists](evidence/preservation.json).

Preview, capturas finais e Lighthouse estão registrados na entrega verificada abaixo.

## Entrega final verificada

**[Abrir o novo Preview completo](https://oliveira-assessoria-90onhrh0b-barbozaa-s-projects.vercel.app/)** · [Catálogo](https://oliveira-assessoria-90onhrh0b-barbozaa-s-projects.vercel.app/servicos.html) · [Organização Documental](https://oliveira-assessoria-90onhrh0b-barbozaa-s-projects.vercel.app/servicos/organizacao-documental.html).

Deployment `dpl_HHNqoPNd6pPYNDBqVTmc8e9aoVrG`, READY, ambiente Preview (`target: null`), implementação `5d40796efc9e3934005993a32196f28a109bbbab`. Commits posteriores apenas registram documentação/evidências; arquivos servidos iguais aos testados.

Testes finais passaram também no Preview: **19 páginas × 7 larguras**, 133 combinações por ambiente. [Relatório e limites](TESTES.md) · [24 capturas desktop/mobile](VISUAL.md) · [30 execuções Lighthouse](PERFORMANCE.md) · [Arquivos modificados](ARQUIVOS.md).

Para encerrar a Etapa 2 falta registrar a decisão comercial e profissional de Jennifer e Rodrigo por serviço, conforme [pendências](PENDENCIAS-APROVACAO.md). Sem Etapa 3, merge ou produção.
