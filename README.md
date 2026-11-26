# PINCIO Assessoria Internacional

Site e ferramentas de apoio administrativo e documental da PINCIO, com catálogo Brasil/Itália. Site publicado: https://pincio-assessoria.vercel.app/.

O nome técnico do repositório, cookies, tabelas e variáveis legadas `oliveira-*` / `OLIVEIRA_*` é preservado por compatibilidade. Isso não é uma oferta comercial da marca anterior. A PINCIO não é apresentada como escritório de advocacia; atividades regulamentadas dependem de responsável habilitado.

## Desenvolvimento e verificação

Node 24.x. `npm ci` e `npm run serve` para o site estático local. `npm run dev` inicia o simulador local exclusivamente sintético. Não copiar credenciais reais para testes.

- `npm test`: navegação, formulários interceptados, acessibilidade e responsividade.
- `npm run test:platform`: autenticação, MFA, permissões, documentos, backups e demais testes isolados.
- `npm run test:operational-ui`: interface operacional com APIs simuladas e contrato do webhook sem envio real.
- `node --test tests/platform-public-demo-release.test.mjs tests/pincio-brand.test.mjs`: limites da demonstração pública e marca.
- `npm audit --omit=dev`: auditoria de dependências de execução.

`landing/` contém o site público; `api/` e `server/platform/` contêm as APIs e controles de acesso. `db/` e `agent/` também incluem componentes históricos. Não executar migrações, seeds ou scripts de setup contra bancos reais como parte de uma alteração visual.

## Formulários e dados

O formulário central é controlado por `landing/premium-consular.js`. Preserva o contrato JSON `{nome, whatsapp, area, mensagem}` e o endpoint n8n legado `/webhook/oliveira-leads`. Retorno HTTP não comprova sozinho recebimento no destino final, deduplicação ou ausência de notificações posteriores. Essas etapas exigem homologação do workflow e confirmação da equipe.

Não registrar dados pessoais ou credenciais em evidências. O checklist IR mantém o rascunho no navegador e gera arquivo local; não transmite a declaração ou acessa a conta gov.br.

## Marca, fotografia e pendências

Leia [as pendências PINCIO](docs/pincio/CODEX_PENDENCIAS.md) e [os créditos e a licença da fotografia](landing/assets/pincio-fotografia-licenca.json). O código e a marca não herdam automaticamente a licença da fotografia.

Não ativar operação real, pagamentos ou mensagens; não alterar autenticação, banco, secrets, backups, domínios ou permissões como efeito colateral do rebranding. A pessoa jurídica, o CNPJ, o canal de privacidade, domínio definitivo e caixas institucionais dependem de confirmação do titular.
