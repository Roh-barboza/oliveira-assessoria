# Oliveira Assessoria | Relatório de homologação técnica | 23/11/2026

## Escopo desta entrega

Projeto Vercel único: `oliveira-assessoria` (`prj_M19hHqI7fq25KgKnXWIqUYRXmxhq`). Desenvolvimento somente em Preview da branch `feature/plataforma-operacional-preview` no repositório `Roh-barboza/oliveira-assessoria`. Não houve merge em `main` nem release no site público.

### Recuperação de código

- Backup anterior a esta homologação: `backup/operacional-antes-homologacao-2026-11-23`, commit `c7df7f156b117b6b7ef1c64668f1e260d2f97214`.
- Backups de 20/11: `backup/producao-publicada-2026-11-20`, `backup/operacional-antes-ajustes-2026-11-20`, `backup/main-antes-ajustes-2026-11-20`.
- São cópias do **código Git**, não backups independentes do Neon.

### Validado

1. GitHub Actions: 59 testes de backend aprovados na primeira rodada com verificação SQL (0 falhas), interfaces operacional e de ativação responsivas, auditoria de acessibilidade, contrato de leads com mock e `npm audit --omit=dev` sem vulnerabilidades reportadas (run `45182895784`).
2. Neon real: GET `/api/operacional-selftest` no Preview temporário retornou HTTP 200 com `ready: true`; confirmou conexão, esquema, administrador ativo com MFA, criação, atualização e listagem criptografadas usando **tabelas temporárias**, `ROLLBACK` e ausência de linhas fictícias persistidas nas tabelas reais.
3. Após o teste, a variável `OLIVEIRA_OPS_SELFTEST_ENABLED` foi desabilitada, o endpoint temporário excluído da branch e sua função retirada de `vercel.json`. O arquivo `server/platform/operational-live-smoke.mjs` e o teste unitário permanecem no repositório para regressão CI. Previews anteriores exigem autenticação Vercel e poderão existir até expirar/sua remoção.
4. Primeiro administrador: confirmado com MFA ativo; cadastro inicial desabilitado. Login regular habilitado no Preview, usando cookie seguro e controle de sessão.
5. Formulário de leads: Playwright simulou a resposta HTTP do n8n/Cloudfy e validou JSON, seleção do serviço, mensagem de sucesso, tratamento de erro e restauração do botão. **Nenhum POST real foi feito ao webhook.**
6. Produção: mantido deployment `dpl_9WmwZYXXnmXQscmwMRATydJKUxNq` e código publicado anterior; nenhum serviço operacional foi liberado em produção.

### Ainda não homologado

- Backup lógico **real e independente** do Neon e teste de restauração em outro banco/branch, com RPO/RTO, chaves de descriptografia e política de retenção: seguir `PLANO-BACKUP-NEON.md`. Isso não pode ser concluído apenas com a conexão Vercel, sem ferramenta de gerenciamento Neon e cofre de backup autorizado.
- Entrega real do webhook Cloudfy/n8n e processamento de leads ponta a ponta. Teste de navegador com mock é útil mas não comprova recepção no workflow.
- Aprovação do responsável sobre LGPD, política de acesso, procedimentos de atendimento, retenção de documentos e dados reais.
- Assinatura eletrônica, pagamentos, anexos reais, WhatsApp automático e automações externas, ainda explicitamente inibidos na base de simulação. Não representar mocks como serviço homologado.

**Decisão técnica:** o Preview está pronto para uso assistido com dados sintéticos, mas **não** há evidência suficiente para declarar produção operacional real 100% homologada. Promover somente após validação dos itens pendentes e aprovação explícita do responsável.

## Evidências de referência

- GitHub PR #7: https://github.com/Roh-barboza/oliveira-assessoria/pull/7
- CI com 59 testes e mock de leads: https://github.com/Roh-barboza/oliveira-assessoria/actions/runs/45182895784
- Documentação Neon: https://neon.com/docs/postgres/backup-restore
