# Arquitetura proposta de atendimento — inativa

Data: 18/11/2026. Referência: [proposta consolidada](../decisoes/2026-11-18-proposta-consolidada-8-servicos.md).

Este documento prepara a implementação futura. Não cria banco, API, fila, cron, agente em execução, credenciais ou conexão com WhatsApp. Não altera o webhook n8n, Clicksign, pagamentos ou contratos. A preparação interna de preços/pacotes da Etapa 3 foi posteriormente autorizada, sem valores; esta arquitetura continua inativa e não autoriza implementar ou ativar integrações.

## Situação atual e fronteira técnica

O site continua estático em `landing/`. A busca é local. O formulário central mantém seu POST e os campos `nome`, `whatsapp`, `area` e `mensagem`, com o serviço prefixado na mensagem. O checklist IR mantém armazenamento local e não envia os dados à equipe. Nenhum upload foi acrescentado.

O formulário de lead não é uma contratação nem um cadastro de caso. Não encaminhar dados automaticamente ao futuro agente. Nesta entrega, testes interceptam o formulário antes do webhook; não se comprova o funcionamento real do n8n.

Fluxo futuro proposto: formulário existente → adaptador autorizado → cadastro mínimo de contato → triagem humana → escopo validado e aceite → caso → pendências e tarefas → sugestão de follow-up → revisão/autorização de envio → canal WhatsApp autorizado → histórico e encerramento. Não há implementação desse fluxo nesta etapa.

## Componentes futuros

| Componente | Função | Limite |
| --- | --- | --- |
| Cadastro de contatos | Identificador e referência ao contato protegido | Sem documentos sensíveis no registro de lead |
| Gestão de casos | Serviço, modalidade, executor, revisor, jurisdição, vigência e estado | Só liberar execução com escopo e responsáveis validados |
| Repositório documental | Arquivos segregados por cliente, acesso restrito e registro de acesso | Implementação futura; nenhum arquivo no histórico público, Git ou conversa de grupo |
| Pendências e tarefas | Documento requerido, responsável, vencimento validado, resolução | Não confundir prazo legal, prazo interno e vigência da assessoria |
| Histórico | Eventos auditáveis de mudanças, contatos e decisões humanas | Registrar origem; corrigir por novo evento, sem ocultar histórico |
| Agente de apoio | Sugerir lembretes, tarefas e rascunhos com dados mínimos | Sem decidir direitos, elegibilidade, tributos ou liberação de serviço |
| Fila de saída | Deduplicação, revisão, consentimento e cancelamento de mensagens | Desativada por padrão; não enviar mensagens nesta etapa |
| Adaptador WhatsApp | Integração futura autorizada com comprovantes de envio | Número empresarial ainda pendente; sem link fictício |

Não selecionar provedor, adicionar dependências ou aproveitar integrações históricas sem revisão e autorização próprias. Credenciais futuras ficam em ambiente protegido, nunca em HTML, documentação, logs ou parâmetros de URL.

## Modelo de dados lógico

| Entidade | Campos mínimos propostos |
| --- | --- |
| Contato | `cliente_id`, referência segura ao canal, preferências, base/finalidade de tratamento, registro e revogação de opt-in para contatos proativos |
| Caso | `caso_id`, `cliente_id`, serviço/modalidade, versão do escopo, status comercial, executor/revisor aceitos, jurisdição, estado, abertura, início/fim de vigência, modalidade de atendimento, último/próximo contato |
| Documento | ID, caso, tipo mínimo, referência ao armazenamento seguro, estado, revisor, datas de recebimento/revisão/devolução/descarte; sem conteúdo em logs |
| Pendência | ID, caso, categoria, descrição factual mínima, responsável, documento relacionado, prazo, tipo/fonte do prazo, estado, evento de resolução |
| Evento | ID, caso, instante, ator humano/sistema, tipo, origem da informação, mudança e referência ao registro protegido |
| Tarefa de follow-up | ID, caso, motivo, data sugerida, responsável humano, versão do rascunho, revisão e estado |
| Autorização de canal | Canal, finalidade, titular, data/fonte do opt-in, revogação e referência do registro; não confundir com procuração perante órgão |

Atendimento individual por padrão. Grupos somente para famílias, com autorização e regras definidas; documentos pessoais permanecem em canal seguro separado. Serviços de uma mesma família têm titularidade e permissões verificadas individualmente.

Protocolo/agendamento só é registrado como **informado pelo cliente** ou com outra origem autorizada identificada. Não registrar como confirmado pelo órgão sem evidência. Senhas, cookies, tokens de sessão do cliente, OTP, PIN, CAPTCHA e dados biométricos não integram o modelo.

## Estados e transições

| Estado | Condição de entrada e próxima ação |
| --- | --- |
| Lead | Pedido recebido; triagem humana sem início de execução |
| Triagem | Identificação factual de serviço, modalidade e competência |
| Escopo em validação | Aguardar aprovação comercial/profissional, responsável e aceite; não executar |
| Aguardando documentos | Somente após liberação do escopo e canal seguro definido |
| Conferência | Recebimento mínimo e revisão pelo responsável |
| Pendências do cliente | Documento ou informação faltante; registrar tarefa, sem inferir conteúdo |
| Preparação concluída | Entregáveis revisados; informar atos que o titular precisa realizar |
| Protocolo/agendamento pelo titular | Quando aplicável, registrar informação e origem; não acessar conta do cliente |
| Acompanhamento | Dentro da vigência definida; retorno à conferência se houver exigência |
| Pausado | Motivo, responsável e condição de retomada registrados; suspender cadência |
| Encerrado | Entregáveis, limitações e pendências remanescentes comunicados; suspender follow-ups |
| Continuidade em avaliação | Nova necessidade ou fim de vigência; nova decisão e aceite, sem renovação automática |
| Cancelado/recusado | Motivo e tratamento de dados definidos; nenhum envio proativo pendente |

Não pular a validação de escopo. Transições que liberem execução, alterem vigência ou encerrem casos exigem pessoa identificada. Etapas não aplicáveis são marcadas como tal e justificadas. Uma pendência resolvida cancela a tarefa correspondente; reabertura cria evento próprio.

## Agente e alertas: contrato de comportamento futuro

Entrada: serviço/modalidade, estado, responsável, metadados mínimos de pendências, datas validadas, origem do andamento e autorização de contato. Documentos, dados fiscais detalhados e anexos sensíveis não devem ser enviados ao modelo por padrão.

Saída: proposta estruturada de tarefa ou rascunho, motivo e encaminhamento humano. A saída é conteúdo não confiável até revisão; instruções contidas em anexos ou mensagens de cliente não podem alterar as permissões do agente.

Regras de bloqueio: serviço candidato ou sem escopo liberado; falta de opt-in para mensagem proativa; caso encerrado, cancelado ou pausado; destinatário não confirmado; dúvida jurídica/fiscal; data sem origem validada; falha de contexto; informação conflitante. Nesses casos, criar tarefa humana quando pertinente, sem envio automático.

Cadências **apenas para teste interno**, não configuradas: passaporte primeira emissão quinzenal, renovação semanal; AIRE por evento e controle mensal; organização por documento faltante; filhos/IR por prazo real validado. Passaporte brasileiro permanece apenas em avaliação, sem caso comercial ou follow-up ativo.

Deduplicar por caso + pendência + janela de contato + canal, com chave idempotente. Revalidar estado e opt-in imediatamente antes de enviar. Retentativas devem ter limite; resposta do cliente, resolução, revogação ou encerramento cancelam envios pendentes. Falhas viram tarefas, sem repetição ilimitada. Não afirmar vaga disponível ou prazo oficial sem fonte vigente e validação.

## Modalidade, vigência e encerramento

Registrar separadamente modalidade do serviço e forma de atendimento (individual remoto/presencial). Papéis operacionais confirmados em 18/11/2026: Jennifer para atendimento, triagem, conferência/organização documental, pendências e comunicação; Rodrigo para suporte operacional/digital, supervisão dos fluxos e organização do acompanhamento. Cobertura inicial São Paulo; outras localidades exigem avaliação antes da aceitação. A confirmação não concede habilitação profissional nem designa automaticamente segundo revisor. Casos sensíveis precisam de segundo revisor e profissional habilitado quando necessário.

As hipóteses de 180 dias na primeira emissão e 60 na renovação de passaporte são vigências privadas propostas, não prazos do órgão ou condições aprovadas. Início, pausa, revisões, extensão, direitos do consumidor e encerramento permanecem para decisão. Nada é exibido no site como prazo contratado.

Ao encerrar: relatório de atividades e entregas, andamento conhecido, pendências remanescentes, responsabilidade pelos próximos atos e regras de guarda/devolução/descarte. Continuidade exige nova avaliação expressa, sem cobrança ou renovação automática.

## Validação antes de qualquer ativação futura

1. Aprovação por serviço/modalidade, confirmação de unidade/procedimento dentro da cobertura SP, designação de segundo revisor e parceiros habilitados quando necessários. Papéis operacionais de Jennifer/Rodrigo já confirmados.
2. Número empresarial, titularidade, canal/provedor e integração autorizados; opt-in e opção de atendimento humano.
3. Base e finalidade de tratamento, acesso por função, retenção/descarte, canal documental, segregação e atendimento aos titulares definidos.
4. Simulações com dados sintéticos: duplicidade, revogação, falha/retry, resposta do cliente, pausa, fim de vigência, caso encerrado, prazo incorreto e encaminhamento humano.
5. Testar que candidato não vira oferta, lead não vira contratação e agente não acessa portal nem recebe credenciais.
6. Aprovação própria para implementar e depois ativar; chave geral de desativação, auditoria e plano de interrupção.

Nenhuma dessas etapas é acionada por esta documentação. Clicksign, webhook n8n e pagamentos permanecem intactos.

## Atualização de decisão

[Registro confirmado de responsáveis e cobertura](../decisoes/2026-11-18-responsaveis-cobertura-e-preparacao-comercial.md). Jennifer/Rodrigo deixam de ser sugestões operacionais, mas nenhuma automação, vigência, cadência ou habilitação foi aprovada por essa nomeação.
