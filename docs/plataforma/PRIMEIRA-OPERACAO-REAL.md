# Oliveira Assessoria | Primeira operação interna real

## Entrega de ponta a ponta

A UI `/operacional.html` consome `/api/operacional`. O backend em `api/operacional.mjs` compõe `OperationalAccounts`, `OperationalMfa`, `OperationalLoginLimiter` e `OperationalCases` sobre **PostgreSQL dedicado**.

O primeiro funcionário é um administrador criado por uma ferramenta restrita, com senha individual e cadastro no autenticador TOTP. Após login, o operador pode abrir, listar, consultar e atualizar atendimentos internos. Nenhuma rota do simulador `/api/plataforma` é reaproveitada para casos reais.

Os campos descritivos das solicitações são armazenados como payload cifrado AES-256-GCM. As colunas mínimas de autorização, situação e data permanecem consultáveis. O modelo ainda não armazena anexos, documentos pessoais nem dados de pagamento.

## Proteção de publicação

A rota operacional responde 503 até que todos os requisitos abaixo sejam atendidos:

- `VERCEL=1` e `VERCEL_ENV=preview`.
- `VERCEL_GIT_COMMIT_REF=feature/plataforma-operacional-preview`.
- ID do projeto **exclusivo**, diferente do projeto público da Oliveira Assessoria.
- `OLIVEIRA_OPS_ALLOWED_PROJECT_ID` igual ao `VERCEL_PROJECT_ID` desse projeto isolado.
- `OLIVEIRA_OPS_ENABLED=1`.
- `OLIVEIRA_OPS_ORIGIN` como origem HTTPS exata de onde o painel será aberto (sem barra final).
- `OLIVEIRA_OPS_STORE=postgres`.
- `OLIVEIRA_OPS_DATABASE_URL` apontando ao PostgreSQL dedicado.
- `OLIVEIRA_OPS_DATA_KEY`: chave AES aleatória de 32 bytes, codificada como 64 caracteres hexadecimais.
- `OLIVEIRA_OPS_RATE_SECRET`: segredo HMAC aleatório de no mínimo 32 bytes.

**Nunca cadastre essas variáveis no projeto público, armazene-as em arquivos versionados, compartilhe seus valores por chat, ou replique o banco do n8n.** Crie-as somente no projeto exclusivo e ambiente Preview, como variáveis sensíveis/criptografadas. O endpoint exige cabeçalho de IP atribuído pela borda da Vercel e recusa login na ausência dele.

Atenção: as contas operacionais ainda não possuem fluxo remoto de convite, recuperação, rotação de chaves, armazenamento de anexos, trilha permanente de auditoria de casos e política LGPD revisada. Portanto, a primeira liberação deve ficar limitada **a atendimentos internos sem dados sensíveis** e permanecer protegida por autenticação da Vercel até a homologação desses pontos.

## Preparar o banco e a primeira conta

Após provisionar banco Postgres exclusivo, conectividade e backups, utilizar um ambiente de manutenção seguro:

```powershell
# Executar na pasta do repositório, em PowerShell com acesso autorizado ao banco.
# Configure as variáveis secretas no gerenciador apropriado, não no Git.
$env:OLIVEIRA_OPS_SETUP_ACK = "dedicated-postgres-reviewed"
node scripts/operations-setup.mjs migrate
```

Para cadastro do administrador, configurar `OLIVEIRA_OPS_ADMIN_EMAIL`, `OLIVEIRA_OPS_ADMIN_NAME` e `OLIVEIRA_OPS_ADMIN_PASSWORD` no processo **sem imprimir a senha**:

```powershell
node scripts/operations-setup.mjs admin
```

A ferramenta cria a conta pendente e revela o segredo TOTP somente no console local. Registrar no aplicativo autenticador e **não enviar a captura nem a saída do terminal a ninguém**.

Depois, informar o código de seis dígitos na variável temporária `OLIVEIRA_OPS_ADMIN_CODE` e executar:

```powershell
node scripts/operations-setup.mjs confirm
Remove-Item Env:OLIVEIRA_OPS_ADMIN_CODE -ErrorAction SilentlyContinue
Remove-Item Env:OLIVEIRA_OPS_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

O bootstrap de administrador só funciona com a tabela de contas completamente vazia. Não há senhas padronizadas nem conta de teste operacional implantada.

## Como verificar

O CI em `.github/workflows/oliveira-operational-ci.yml` roda `npm run test:platform`, `npm run test:operational-ui` e `npm audit --omit=dev`, sem segredos ou deploy automático.

O teste `platform-operational-end-to-end.test.mjs` usa o mecanismo SQL PostgreSQL local PGlite e prova login+MFA, sessão, criação de caso cifrado, listagem, transição de etapa, detecção de conflito e logout.

O passo seguinte após credenciais e projeto dedicados é publicar no **projeto isolado**, testar no domínio HTTPS exato, validar bloqueios de rede, reinício e persistência, criar conta administrativa e só então admitir solicitações internas controladas.

**Sem banco configurado, conta ativada e deployment verificado, a página operacional mostrará serviço indisponível. Isso é um bloqueio de segurança intencional, não um go-live concluído.**
