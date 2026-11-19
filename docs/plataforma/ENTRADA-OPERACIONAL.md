# Entrada operacional HTTP: integração controlada

A camada de autenticação real implementada em `server/platform/operational-*.mjs` é **separada do simulador** em `api/plataforma.mjs`. Em especial, `operational-http.mjs` **não foi conectado a nenhuma rota pública** nesta etapa.

## Componentes disponíveis no código

- `OperationalAccounts`: cadastro persistente de equipe, revogação e sessão.
- `OperationalMfa`: inscrição e verificação TOTP com segredo cifrado, contra repetição de código.
- `OperationalLoginLimiter`: controle distribuído por conta e origem de rede, armazenado no Postgres.
- `OperationalAuthenticationService`: obriga passar pelo limitador antes de executar senha+MFA.
- `createOperationalHttp`: login, sessão e logout; cookie HttpOnly, Secure e SameSite=Strict; checagem de Origin; sem endpoints de cadastro livre e sem divulgação de credenciais.

## Pré-requisitos para conectar uma rota pública

1. Criar um **banco PostgreSQL exclusivo da plataforma**, com acesso e papel mínimos, backups e restauração validada. Não reutilizar o banco do n8n ou outros projetos.
2. Aplicar a migração de contas, MFA e limites de tentativas por processo de migração explícito. Não executar auto-`setup` a cada requisição HTTP em produção.
3. Configurar chave de cifragem e segredo de HMAC no gerenciador de segredos do **projeto correto**, sem armazená-los no Git ou enviar pelo chat.
4. Prover `networkIdentity(request)` por **origem autenticada de proxy/CDN** e documentar como cabeçalhos de entrada são normalizados. A função deve negar acesso sem identidade confiável.
5. Definir `allowedOrigin` exato e HTTPS; ativar proteção de implantação, monitoramento e prevenção de CSRF no front-end.
6. Criar fluxo restrito de convite de equipe e inscrição MFA (sem rota pública irrestrita), recuperação de conta, rotação de chave e revogação.
7. Conectar a sessão da equipe aos endpoints de **casos reais**, com autorização por registro e auditoria. O simulador atual não deve ser usado para documentos de clientes.
8. Validar teste de integração remoto, concorrência, resiliência, backups, LGPD e a implantação gradual antes de habilitar acesso a dados reais.

## Atenção: fronteira de segurança

A criação de uma sessão pelo serviço de MFA pressupõe verificação efetiva do código. O parâmetro `mfaVerified` na camada de contas não é uma prova independente: **não o exponha em formulários ou endpoints**. O transporte aceita somente a resposta do serviço de autenticação configurado.

As funções de login e sessão são primitives de serviço, não um sistema completo de identidade empresarial. Sem as etapas acima, o lançamento real permanece bloqueado.

## Verificação local

```powershell
git pull --ff-only
npm run test:platform
npm audit --omit=dev
npm run check:go-live
git status --short
```

O verificador de go-live deve continuar falhando enquanto o fluxo real não tiver sido conectado e auditado.
