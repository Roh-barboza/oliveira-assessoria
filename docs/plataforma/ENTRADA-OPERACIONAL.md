# Entrada operacional HTTP: integração controlada

A camada de autenticação real implementada em `server/platform/operational-*.mjs` é **separada do simulador** em `api/plataforma.mjs`. A integração agora tem uma rota serverless `api/operacional.mjs`, mas o acesso fica **bloqueado por padrão**. A liberação exige Preview autorizado, banco independente, credenciais e MFA.

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
4. Usar temporariamente um limitador **global fixo e persistido em Postgres**, com 25 tentativas em 15 minutos, mais limite individual; não confiar em cabeçalho de IP não verificado. Antes de aumentar a escala, validar origem autenticada do IP no proxy/CDN.
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

## Rotas internas para solicitações (disponíveis no código, bloqueadas em produção)

O transporte `createOperationalHttp` aceita opcionalmente `cases` e passa a expor operações **apenas quando o aplicativo for composto por um integrador autorizado**:

- `GET ?op=case-list&limit=50`: consulta paginada por limite (máximo 100), filtrada por identidade da equipe.
- `GET ?op=case-get&id=<uuid>`: recupera uma solicitação visível ao funcionário.
- `POST ?op=case-create`: cadastra solicitação com `title`, `service`, `notes` e, para administradores, `assignedTo`.
- `POST ?op=case-status`: altera `nextStatus` de `id` com `expectedVersion`, impedindo sobrescrever atualizações concorrentes.

Requerem cookie seguro emitido pelo login operacional e consulta de sessão no Postgres a cada chamada. Sem `cases`, retornam **503**; sem sessão, **401**; origem inválida, **403**; conflitos de versão, **409**. Não são endpoints da versão de demonstração e **não estão habilitados para uso real**. A API original `api/plataforma.mjs` continua a simulação intacta.

A interface operacional está conectada ao contrato HTTP. A ativação ainda depende de Postgres dedicado, migração, administrador com MFA e variáveis restritas ao Preview. Antes de habilitar dados reais, adicionar trilha de auditoria permanente, mitigação de CSRF para contexto autenticado, proteção contra abuso, política de dados e fluxo de provisionamento de usuários.

## Interface de operação interna (19/11/2026)

Foi criada uma interface **independente da demonstração** em `landing/operacional.html`, com estilos locais e JavaScript próprio:

- Entrada por e-mail profissional, senha e código TOTP, **sem salvar esses dados em storage do navegador**.
- Lista de casos permitidos à sessão, consulta de um caso, abertura de solicitação e alteração de etapa com controle de versão.
- Ocultação de opções não autorizadas conforme papel, com a validação definitiva sempre no servidor.
- Renderização dos dados dos casos usando `textContent` e elementos DOM, sem inserir HTML retornado pelo usuário.
- Quando `/api/operacional?op=session` não está conectado ou não responde JSON válido, a tela exibe **Acesso operacional ainda não habilitado** e não solicita credenciais.
- A página não aparece no menu público e permanece com `noindex`, `no-store` e CSP restritiva.

### Verificação de interface em navegador

```powershell
npm run test:operational-ui
```

Esse script sobe um servidor estático **local**, usa casos e credenciais inteiramente sintéticos interceptados no navegador, testa login, sessão, criação, atualização, logout, acessibilidade e larguras diferentes. **Ele não cria usuários reais, não conecta um banco e não realiza deploy**. O teste exige um navegador Chromium disponível ao Playwright.

### Pendências que impedem uso real

A página está ligada à função `api/operacional.mjs`, mas a API **retorna 503 sem autorização de Preview, banco dedicado e variáveis de segurança**. Faltam origem/identidade de rede validada, banco Postgres dedicado, chave de cifragem, fluxo restrito de convite e recuperação, auditoria permanente dos casos, backups, consentimento e políticas documentais. Não usar informações de clientes enquanto esses itens permanecerem pendentes.


## Vercel em projeto único

A arquitetura atual mantém site e painel no mesmo projeto `oliveira-assessoria`, separando o ambiente **produção** do Preview da branch `feature/plataforma-operacional-preview`. A produção permanece bloqueada para a API operacional. Consulte `PRIMEIRA-OPERACAO-REAL.md` para as variáveis exatas, o backup e a ativação segura.
