# Oliveira Assessoria | Preparação operacional após a Clicksign | 24/11/2026

**Alcance:** código e testes no Preview, sem merge em produção, sem cliente real,
sem envio de mensagens, assinatura, cobrança ou atribuição de domínio.

## Implementação técnica

1. **Acesso da equipe.** O painel de administração pode gerar convite temporário
   de funcionário (operador/revisor) e token para recuperação de conta não
   administrativa. O token possui 256 bits, é armazenado apenas como hash,
   expira em 24 horas e só permite uma ativação. O funcionário define a senha,
   configura o próprio MFA e confirma o código no formulário `/equipe.html`.
   Recuperação suspende sessões antigas imediatamente. Não existe convite de
   administrador, autocadastro público ou envio automático por e-mail.
2. **Migração para convites.** `db/operacional-convites-preview.sql` é aditiva.
   Nunca ativar o recurso antes de aplicar no Neon dedicado, confirmar backup e
   revisar permissões. Só depois configurar
   `OLIVEIRA_OPS_TEAM_INVITES_ENABLED=1` **somente na branch Preview**,
   redeployar e testar com contas fictícias.
3. **Documentos privados.** Repositório preparado em
   `server/platform/operational-documents.mjs`, com limite de 1 MiB por
   arquivo, PDF/PNG/JPEG, assinatura de formato, digest SHA-256, criptografia
   AES-GCM do conteúdo e nome, ACL por caso, registro de downloads e remoção.
   As operações de gravação/remoção e auditoria são transacionais.
   `db/operacional-documentos-preview.sql` precisa ser aplicado
   separadamente. O transporte é controlado pela flag
   `OLIVEIRA_OPS_DOCUMENTS_PREVIEW=1` após migração.
   **ATENÇÃO:** o ambiente Vercel ainda injeta
   `documentScanner: null`. Por isso todo upload retorna 503, mesmo com a
   flag: o antivírus/fornecedor e o contrato de tratamento de dados ainda
   precisam ser selecionados, implementados e homologados.
4. **Backup criptografado.** `scripts/operations-backup.mjs` dispõe de
   `backup`, `verify` e `restore`, usando `pg_dump`/`pg_restore`
   e cifrando o fluxo antes de gravá-lo. Não gera dump legível no disco.
   Verifica integridade AES-GCM; bloqueia restauração sem confirmação
   separada e sem banco vazio. Exige chave própria de backup e credenciais
   locais fornecidas por ambiente privado. Os testes automatizados verificam
   cifragem e adulteração, **não** equivalem a um dump restaurado do Neon.
5. **Histórico operacional.** Eventos cifrados por atendimento e gestão de
   suspensão de usuários, conforme commits anteriores desta branch.
6. **LGPD.** A matriz de dados em `MATRIZ-LGPD-RASCUNHO.md` relaciona
   finalidades, controles, fornecedores e requisitos que exigem aprovação
   jurídica/operacional.

## Backup real: sequência obrigatória

Executar **somente em estação de administração autorizada**, com Node 24 e
PostgreSQL client (pg_dump/pg_restore) instalados. Configurar no ambiente
privado, sem escrever os valores em chats ou comandos versionados:
- `OLIVEIRA_OPS_BACKUP_URL`: URL PostgreSQL TLS de leitura do Neon dedicado
- `OLIVEIRA_OPS_BACKUP_KEY`: chave HEX aleatória de 64 caracteres, guardada em cofre independente da chave AES dos casos
- `OLIVEIRA_OPS_BACKUP_ACK=dedicated-neon-backup-reviewed`
- `OLIVEIRA_OPS_RESTORE_URL`: URL TLS de **outro banco vazio e isolado**, só para restauração
- `OLIVEIRA_OPS_RESTORE_ACK=isolated-empty-database-reviewed`

Com o ambiente configurado e caminhos absolutos de destino privado:

```powershell
node scripts/operations-backup.mjs backup "C:\\BackupsPrivados\\oliveira-20261124.oliveira-backup.enc"
node scripts/operations-backup.mjs verify "C:\\BackupsPrivados\\oliveira-20261124.oliveira-backup.enc"
node scripts/operations-backup.mjs restore "C:\\BackupsPrivados\\oliveira-20261124.oliveira-backup.enc"
```

Não incluir backups, urls de banco ou secrets no Git, issue, PR, CI artifacts,
mídia pública ou chat. Após a restauração, confirmar as tabelas, quantidades,
permissões e acesso a um registro sintético com a **chave da aplicação**; aprovar
RPO/RTO, retenção, cofre, periodicidade e testes futuros. A restauração em banco
isolado é destrutiva naquele ambiente e nunca deve apontar para o banco ativo.

## O que continua impedido

- **Neon:** snapshot e dump cifrado real, restauração comprovada em destino
  independente, segurança de chaves, backup/retention e autorização do titular.
- **Documentos reais:** scanner malware aprovado e integrado, testes de upload
  real, acesso privado, minimização, contrato do operador e aprovação LGPD.
- **Convites reais:** migração no Neon, configuração Preview exclusiva e
  verificação privada do fluxo com usuários fictícios e canal seguro de entrega.
- **Negócio:** cinco serviços e preços ainda dependem de liberação
  comercial/jurídica e competência profissional revisada.
- **n8n/Cloudfy:** webhook validado com mock, não com um envio real comprovado.
- **WhatsApp, pagamentos, IA, Clicksign:** continuam desligados até
  integração escolhida, homologação e autorização. Clicksign foi adiada.
- **Go-live:** aprovação expressa, identidade e origem, domínio, SEO,
  observabilidade, restauração e rollback validados.

**Não transformar o Preview em produção nem preencher essas evidências por
suposição.** O comando `npm run check:go-live` deve continuar bloqueando
liberação real enquanto houver condições externas pendentes.
