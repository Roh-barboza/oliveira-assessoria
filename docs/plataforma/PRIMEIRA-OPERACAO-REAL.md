# Oliveira Assessoria | Operação interna no mesmo projeto Vercel

## Backups preservados em 20/11/2026, antes das alterações

- Produção publicada: `backup/producao-publicada-2026-11-20`, commit `2adb1afa303e6e0d82147de985a401575c6505be`.
- Plataforma operacional antes dos ajustes: `backup/operacional-antes-ajustes-2026-11-20`, commit `03407bfd791dd3a0538e5ebeb3c8f93438ca9e4a`.
- Branch principal: `backup/main-antes-ajustes-2026-11-20` (snapshot de `main`).
- Deployment de produção identificado: `dpl_9WmwZYXXnmXQscmwMRATydJKUxNq` (`READY`).
- Projeto Vercel original: `oliveira-assessoria`, ID `prj_M19hHqI7fq25KgKnXWIqUYRXmxhq`.
- Não foi realizado novo release de produção nem alterado o domínio.
- As branches são backups de **código Git**. Não são backups de banco, secrets ou configurações externas. Os dados persistentes exigem plano independente de backup e recuperação.

## Arquitetura simplificada: um projeto Vercel, dois ambientes

- **Produção**: site institucional e captação existentes, sem mudanças; **API operacional sempre retorna 503**.
- **Preview** da branch `feature/plataforma-operacional-preview`: interface `/operacional.html` e API `/api/operacional`, com banco PostgreSQL exclusivo da operação.
- O simulador `/plataforma.html` e `/api/plataforma` é opcional e totalmente sintético. Exige outro armazenamento remoto, outra chave e outra autorização. Nunca deve usar o Postgres operacional.

Nenhum domínio novo, projeto Vercel adicional ou mudança na produção é necessário para validar a primeira operação. A segurança é garantida pela **identidade do ambiente, branch, projeto, origem, segredos e autenticação da equipe**, não pela mera separação em dois projetos.

## Ativação operacional (somente Preview; uso real ainda não homologado)

A API operacional exige **todas** estas condições:

- `VERCEL=1`, `VERCEL_ENV=preview` e `VERCEL_GIT_COMMIT_REF=feature/plataforma-operacional-preview`.
- `VERCEL_PROJECT_ID=prj_M19hHqI7fq25KgKnXWIqUYRXmxhq` (providenciado pela Vercel).
- `OLIVEIRA_OPS_ALLOWED_PROJECT_ID=prj_M19hHqI7fq25KgKnXWIqUYRXmxhq`.
- `OLIVEIRA_OPS_PREVIEW_ACK=shared-project-preview-only`.
- `OLIVEIRA_OPS_ENABLED=1`.
- `OLIVEIRA_OPS_ORIGIN`: URL HTTPS **exata da implantação Preview**, com domínio `*.vercel.app` e sem barra final. Os domínios principais da produção são proibidos.
- `OLIVEIRA_OPS_STORE=postgres`.
- `OLIVEIRA_OPS_DATABASE_SOURCE=neon-vercel` (configurado no Preview da branch). O endereço do PostgreSQL é fornecido **automaticamente pelo Neon**, nas variáveis sensíveis `DATABASE_URL` e `NEON_PROJECT_ID`, sem copiar nem recriar credenciais. Para um banco externo, a opção alternativa é `dedicated-url` acompanhada de `OLIVEIRA_OPS_DATABASE_URL`.
- O PostgreSQL é **dedicado** à Oliveira, não é o banco do n8n ou de outro sistema.
- `OLIVEIRA_OPS_DATA_KEY`: chave AES de 32 bytes aleatórios, representada como 64 hexadecimais.
- `OLIVEIRA_OPS_RATE_SECRET`: segredo HMAC aleatório com 32+ bytes.

Cadastre as variáveis **somente no alvo Preview e restritas a essa branch**, dentro da Vercel, com tipo criptografado/sensível. Não disponibilize os valores em GitHub, mensagens, arquivos públicos ou no projeto de produção.

Até que a origem de IP via proxy seja verificada, o limitador utiliza uma **identidade global fixa** com janela de 25 tentativas a cada 15 minutos, além de 5 tentativas por conta, para evitar confiar em cabeçalhos que possam ser falsificados.

Ausência de qualquer requisito responde **503**, nunca cria armazenamento provisório nem aceita credenciais fictícias.

### Simulador opcional

Além das verificações de Preview, branch e projeto, o simulador exige `OLIVEIRA_PLATFORM_PREVIEW_ACK=synthetic-shared-preview`; `OLIVEIRA_PLATFORM_STORE=postgres` ou `blob`; `OLIVEIRA_DATA_KEY`; e a configuração própria de armazenamento. O simulador não é uma rota para dados reais. Nenhuma configuração do simulador é necessária para liberar apenas a API operacional.

## Neon vinculado à Vercel em 20/11/2026

A integração `neon-almond-paddle` foi encontrada no projeto Vercel `oliveira-assessoria`, com variáveis de conexão `DATABASE_URL` e `NEON_PROJECT_ID`. A API agora utiliza essas variáveis **somente quando** `OLIVEIRA_OPS_DATABASE_SOURCE=neon-vercel` e todas as demais travas do Preview são atendidas. Nenhum valor sensível é salvo no repositório.

Foram criadas, **somente no Preview da branch operacional**, as variáveis `OLIVEIRA_OPS_DATABASE_SOURCE`, `OLIVEIRA_OPS_STORE`, `OLIVEIRA_OPS_ALLOWED_PROJECT_ID`, `OLIVEIRA_OPS_PREVIEW_ACK` e `OLIVEIRA_OPS_ENABLED=0`. O serviço continuará bloqueado até homologação da migração, primeiro funcionário, MFA e chaves de criptografia.

**A integração Neon instalou variáveis de banco para Preview e Produção na Vercel.** Isso não ativa nenhuma operação real na produção (a função está travada por ambiente e branch), mas exige uma revisão posterior da exposição de credenciais e segregação dos acessos no provedor antes do go-live.

## Preparar o banco

Antes de aplicar a migração, **confirmar se o Neon está vazio e dedicado à operação** e criar backup/snapshot da instância ou branch. O arquivo `db/operacional-neon-preview.sql` permite aplicar a estrutura no Neon SQL Editor sem enviar credenciais pelo ChatGPT. O arquivo cria apenas as tabelas; não cria nenhuma conta nem dados de cliente.

Alternativamente, após configurar um ambiente de manutenção seguro, usar o script da aplicação:

```powershell
# Executar em estação de administração autorizada, com secrets fora do Git
$env:OLIVEIRA_OPS_SETUP_ACK = "dedicated-postgres-reviewed"
node scripts/operations-setup.mjs migrate
```

Para a primeira conta, configurar `OLIVEIRA_OPS_ADMIN_EMAIL`, `OLIVEIRA_OPS_ADMIN_NAME` e `OLIVEIRA_OPS_ADMIN_PASSWORD` fora de arquivos versionados:

```powershell
node scripts/operations-setup.mjs admin
```

A ferramenta produz um segredo TOTP no console local. **Não envie o segredo nem sua captura no chat.** Cadastre-o no aplicativo autenticador e valide o código:

```powershell
node scripts/operations-setup.mjs confirm
Remove-Item Env:OLIVEIRA_OPS_ADMIN_CODE -ErrorAction SilentlyContinue
Remove-Item Env:OLIVEIRA_OPS_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

O bootstrap do administrador só pode ser executado quando não houver contas existentes no banco. Não existe acesso público de cadastro de contas. O usuário do Neon pode ser configurado por `DATABASE_URL`/`NEON_PROJECT_ID` e `OLIVEIRA_OPS_DATABASE_SOURCE=neon-vercel` ou por uma conexão dedicada.

**Pendente no ambiente real:** verificar a existência das tabelas no Neon, configurar `OLIVEIRA_OPS_DATA_KEY` e `OLIVEIRA_OPS_RATE_SECRET` como variáveis sensíveis exclusivas do Preview, ativar um administrador com MFA e somente depois revisar `OLIVEIRA_OPS_ENABLED=1`. A conexão Neon por si só não conclui essas etapas.

## Validação

CI: `npm run test:platform`, `npm run test:operational-ui` e `npm audit --omit=dev`.

Os testes de backend usam PostgreSQL local (PGlite), verifica TOTP, sessão, cadastro de solicitações, controle de versão e logout. O teste visual usa dados sintéticos no navegador e não publica credenciais.

Antes de aceitar dados reais: comprovar banco PostgreSQL persistente e backups restauráveis, autenticação e MFA reais, proteção do Preview, migrações, revogação, auditoria de alterações, política LGPD e minimização de dados. Fluxos de anexos, Clicksign, pagamentos e WhatsApp continuam bloqueados.

**Não confundir uma interface publicada no Preview com autorização para processar dados reais.**
