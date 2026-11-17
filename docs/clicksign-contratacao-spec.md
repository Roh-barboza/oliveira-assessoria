# Oliveira Assessoria — especificação da contratação digital (rascunho)

**Estado:** planejamento e protótipo. **Nenhum contrato real deve ser enviado** até aprovação jurídica, credenciais seguras e testes completos.

## Situação técnica observada
- Repositório GitHub: \`Roh-barboza/oliveira-assessoria\`.
- Versão de referência: \`feature/jennifer-ir-assistant-mvp\`, commit \`2adb1afa303e6e0d82147de985a401575c6505be\`.
- Produção: https://oliveira-assessoria.vercel.app/
- Site: HTML/CSS/JS em \`landing/\`, com \`vercel.json\` apontando \`outputDirectory\` para \`landing\`.
- Formulário de leads atual em \`landing/premium-consular.js\` envia para um webhook do n8n. **Preservar fluxo existente**.
- Protótipo de contratação sem dados reais: \`landing/contratacao-demo.html\` na branch \`feature/clicksign-contratacao-prototipo\`. Ele só altera a prévia no navegador. Nada é enviado, assinado, cobrado ou salvo.

## Experiência desejada
1. Cliente escolhe assessoria, visualiza preço e escopo. Tabela inicial é *proposta comercial*, não preço aprovado.
2. Triagem identifica impedimentos, consulado competente e necessidade de análise humana antes de formalizar.
3. Formulário de dados mínimos. Validar no servidor e evitar solicitar senhas de contas oficiais.
4. Contrato-base + anexo dinâmico por serviço; apresentar versão final para conferência.
5. PDF imutável é gerado pelo backend com versão do texto e hash de integridade.
6. Backend cria envelope, documento, signatário, requisitos e ativa envelope na Clicksign API v3.
7. Assinatura via widget incorporado **apenas se houver habilitação contratual no ambiente de produção**; fallback por fluxo de assinatura hospedado pela Clicksign, se suportado no plano.
8. Webhook autenticado atualiza status apenas quando provado que evento veio da Clicksign.
9. Pago via checkout externo seguro; confirmação por webhook do gateway; não salvar dados do cartão.
10. Área do cliente recebe PDF assinado, comprovante e status. Painel administrativo mostra pendências e histórico.

## Primeira versão: catálogo indicativo
- Atualização de endereço AIRE: R$ 179.
- Primeira inscrição AIRE: R$ 249.
- Primeira emissão passaporte italiano (assessoria): R$ 449.
- Renovação passaporte italiano (assessoria): R$ 399.
- **Não prometer** emissão, agendamento, prazo consular ou deferimento.
- Taxas consulares aplicáveis, certidões, traduções, apostilas e postagem ficam fora do valor, pagos pelo cliente.
- Cadastrar regras específicas de cada consulado antes da comercialização.

## Contrato e conformidade (pendências bloqueantes)
- Confirmar razão social, CNPJ, endereço, representante, canal de contato e política de privacidade.
- Revisão por advogado de cláusulas de objeto, serviços excluídos, obrigações, custos externos, execução, desistência (CDC art. 49 quando aplicável), cancelamento, reembolso, política de dados e foro/competência.
- Anexos específicos para AIRE, passaporte e outros; não misturar agendamento e garantia de vaga.
- Fluxo de contratação e retenção de evidências adequado à LGPD e legislação de consumo; coleta mínima e armazenamento cifrado com controle de acesso.
- Sem contratos verdadeiros ou cobranças antes de concluir essas verificações.

## Requisitos técnicos de segurança
- **Revogar e substituir** o token Clicksign e eventual segredo de webhook compartilhados em uma conversa. Não reutilizar dados expostos.
- Separar credenciais de **sandbox** e **produção**. Todos os segredos somente em Secrets/Environment Variables do servidor, nunca em HTML/JS do navegador, repositório, logs ou URLs públicos.
- Nomes de variáveis sugeridos: \`CLICKSIGN_ENV\`, \`CLICKSIGN_ACCESS_TOKEN\`, \`CLICKSIGN_WEBHOOK_SECRET\`, \`APP_BASE_URL\`, \`DATABASE_URL\`, \`PRIVATE_DOCUMENT_STORAGE_*\` (se necessários). Não adicionar valores verdadeiros a arquivos.
- Avaliar compatibilidade do \`vercel.json\` estático com backend: funções serverless em \`api/\` ou serviço separado; validar deploy e roteamento. Não destruir formulário atual.
- Endpoints propostos: \`POST /api/contracts/draft\`, \`POST /api/contracts/submit\`, \`GET /api/contracts/:id/status\`, \`POST /api/webhooks/clicksign\` (sujeito a revisão de autenticação e ACL). Nunca permitir consulta de contratos somente por ID previsível.
- Autenticar e autorizar cada operação; limitar taxa, validar entrada e impedir HTML/JS injetado na geração de PDFs. Proteção CSRF e anti-bot na submissão. Idempotência para criação de envelopes.
- **Webhook:** validar HMAC do **corpo bruto**, confirmar formato exato de header e algoritmo na versão/documentação escolhida; comparar em tempo constante; tratar duplicatas, ordem de eventos e reprocessamento.
- Status internos possíveis: \`triagem\`, \`rascunho\`, \`aguardando_assinatura\`, \`assinado\`, \`aguardando_pagamento\`, \`pago\`, \`em_atendimento\`, \`finalizado\`, \`cancelado\`.
- Persistir apenas dados necessários: \`contract_id\`, dados mínimos da pessoa, \`service_id\`, tabela de preço/versionamento, \`document_hash\`, IDs de envelope/documento/signatários, status e timestamps, comprovante assinado e log de auditoria de eventos sem credenciais.
- HTTPS obrigatório, autenticação dos operadores, acesso privado aos PDFs, backups, retenção definida e exclusão conforme política.

## Clicksign API v3
Documentação oficial atual:
- https://developers.clicksign.com/docs/ambientes-autenticacao-e-formato
- https://developers.clicksign.com/docs/guia-de-criacao-o-passo-a-passo-padrao
- https://developers.clicksign.com/docs/introducao-a-webhooks
- https://developers.clicksign.com/docs/introducao-ao-widget-embedded
- https://developers.clicksign.com/docs/instalacao-de-widget-assinatura-tokenless
- https://developers.clicksign.com/docs/seguranca-de-webhooks
- Sandbox: \`https://sandbox.clicksign.com\` (documentos de teste sem validade legal).
- Confirmar no painel do usuário se API, notificações, assinatura integrada e limite de envelopes estão habilitados; nenhum direito/plano deve ser presumido.

## Testes de aceite para Work
1. Prévia muda corretamente serviço, valor, escopo e dados.
2. Valores de prova não seguem para ambientes de produção nem logs.
3. Pessoa não pode assinar rascunho desatualizado (hash/versão devem bater).
4. Um pedido não gera múltiplos envelopes por clique duplo ou retry.
5. Evento inválido de webhook resulta em rejeição e não altera estado.
6. Reenvio do mesmo evento não duplica mudança de estado.
7. Contrato só fica assinado após confirmação do provedor, não por clique na interface.
8. Pagamento só fica confirmado por evento autenticado do gateway.
9. PDF assinado só fica acessível à pessoa autorizada e operadores permitidos.
10. Formulário antigo, navegação e layout mobile continuam funcionando.

## Próxima entrega
Executar integração no Work em uma branch própria, validar sandbox com segredos renovados e criar PR. Não promover para produção, ativar pagamentos ou usar dados de clientes sem autorização e validação jurídica.
