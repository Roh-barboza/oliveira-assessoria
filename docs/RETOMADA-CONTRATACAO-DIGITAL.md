# Oliveira Assessoria — Registro de retomada técnica da contratação digital

**Registrado:** 17/11/2026  
**Situação:** EM PAUSA. Retomar somente após a aprovação do site completo pela Jennifer e pelo Rodrigo.  
**Escopo deste registro:** integração Clicksign em sandbox, backend, banco, segurança, assinaturas, painel e pagamentos. **Não executar em produção nesta fase.**

## Referências permanentes
- Site público atual, que deve permanecer funcionando: https://oliveira-assessoria.vercel.app/
- Repositório: https://github.com/Roh-barboza/oliveira-assessoria
- PR #1, protótipo visual: https://github.com/Roh-barboza/oliveira-assessoria/pull/1
- PR #2, implementação de sandbox (rascunho): https://github.com/Roh-barboza/oliveira-assessoria/pull/2
- Branch PR #2: `feature/contratacao-digital-sandbox`, baseada em `feature/clicksign-contratacao-prototipo`
- Preview de testes: https://oliveira-assessoria-6qm2kwmdd-barbozaa-s-projects.vercel.app/contratacao.html
- Relatório técnico completo: [contratacao-sandbox-entrega.md](./contratacao-sandbox-entrega.md)
- Especificação de referência: [clicksign-contratacao-spec.md](./clicksign-contratacao-spec.md)

## O que já está implementado no PR #2
- Formulário com triagem para 4 serviços consulares; preços e textos de teste, ainda não comerciais.
- Prévia do contrato vinculada à versão dos dados e do serviço.
- PDF produzido no servidor, hash SHA-256 e armazenamento cifrado.
- Integração programada com API Clicksign v3 apontando para **sandbox**; assinatura por e-mail de teste; widget incorporado opcional e desativado por padrão.
- Endpoint de webhook com validação HMAC, tratamento de duplicidade e sincronização.
- Sessões de teste, permissões de equipe, painel administrativo, histórico de auditoria e simulações de pagamento por Pix/cartão.
- 4 testes automatizados relatados como aprovados, além de verificações em Chromium no formulário mobile, PDF e painel.
- Preview da página responde; API intencionalmente bloqueada enquanto não forem configurados banco e credenciais.
- Site público e captação de leads por n8n preservados. Nenhum envio real a cliente, assinatura válida ou cobrança real foi realizado.

## Pendências técnicas ao retomar (nessa ordem)
1. Revisar PR #2, confirmar consistência com PR #1 e verificar que produção, formulário de leads e demais páginas continuam intactos.
2. Provisionar PostgreSQL **exclusivo para Preview**, separado do banco de agente/n8n, com TLS, backup e usuários de migração/aplicação distintos; aplicar `db/contratacao-sandbox.sql`.
3. **Revogar e substituir** qualquer token Clicksign ou credencial de webhook previamente expostos em mensagens. Gerar novos segredos para sandbox e armazenar somente no cofre de variáveis da Vercel (escopo Preview/branch). Não repetir, salvar ou publicar valores em Git, documentos ou chats.
4. Seguir `.env.contratacao.example` para configurar: `CONTRACTS_SANDBOX`, `CONTRACTS_ORIGIN`, `CONTRACT_DATABASE_URL`, `CONTRACT_ENCRYPTION_KEY`, `CONTRACT_TEST_INVITE_SHA256`, `CONTRACT_ADMIN_JENNIFER_SCRYPT`, `CONTRACT_ADMIN_RODRIGO_SCRYPT`, `CLICKSIGN_ENV`, `CLICKSIGN_ACCESS_TOKEN`, `CLICKSIGN_WEBHOOK_SECRET`, `CLICKSIGN_TEST_EMAIL`, `CLICKSIGN_EMBEDDED_SANDBOX`, `CLICKSIGN_SANDBOX_FILE_HOSTS`. No Preview, não usar `CONTRACTS_LOCAL=1`; verificar `VERCEL` e `VERCEL_ENV`.
5. Criar convites de teste e credenciais de acesso distintas para Jennifer e Rodrigo; usar e-mail controlado exclusivamente para os documentos fictícios.
6. Configurar URL HTTPS pública da função do Preview em Clicksign sandbox: `POST /api/contratacao?op=webhook`; validar o header `Content-Hmac` recebido com segredo correto. Verificar proteção da Vercel e acessibilidade ao provedor, sem liberar a área de testes sem autenticação.
7. Testar ponta a ponta com dados **fictícios**: entrar, selecionar serviço, realizar triagem, conferir PDF, solicitar assinatura hospedada, receber notificação, assinar no sandbox, receber webhook, fechar envelope, recuperar PDF assinado e visualizar no painel. Confirmar a privacidade e que apenas o titular/equipe têm acesso.
8. Testar webhook inválido, repetido, fora de ordem, falha parcial ao criar envelope, idempotência, PDF sem modificação e sessões expiras. Checar hosts de download oficiais observados e allowlist estrita.
9. Se a conta permitir, testar Widget Embedded **somente em sandbox**; verificar compatibilidade mobile. Confirmar custo/licenciamento de Embedded antes de qualquer futura produção.
10. Documentar resultados, erros, screenshots sem dados sensíveis, limites e configurações pendentes; só depois concluir o PR em nova revisão.

## Pendências para contratação REAL (após aprovação da interface e do modelo de negócio)
- Razão social, CNPJ, endereço comercial, representantes e canais oficiais.
- Revisão jurídica e aprovação do contrato-base, anexos específicos por serviço, direito de arrependimento, cancelamento, serviços incluídos/excluídos e responsabilidade por custos terceiros.
- Preços finais e regras consulares atualizadas por circunscrição.
- Política LGPD, retenção, exclusão de dados e segurança operacional.
- Identidade persistente para clientes e recuperação de conta com prova de titularidade.
- Gateway real Pix/cartão e webhooks autenticados, checkout hospedado, prevenção de cobranças duplicadas.
- Ambiente **produção** segregado de sandbox; segredos específicos e nova verificação de segurança.
- Testes de aceite com aprovação expressa antes de merge e publicação.

## Regra de retomada
**Não ligar API, pagamentos ou contratos reais, não mesclar PR #2 e não alterar produção enquanto o site não estiver aprovado.** Quando aprovarem todo o site, abrir este arquivo, consultar o PR #2 e o relatório `docs/contratacao-sandbox-entrega.md`, e dar ao ChatGPT Work a tarefa de finalizar a lista técnica a partir do ponto 1, pedindo relatório de validação antes de solicitar aprovação para produção.

Este registro não contém chaves, tokens, senhas nem dados reais de clientes.
