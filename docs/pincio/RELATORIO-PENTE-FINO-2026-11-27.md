# Revisão ampla do site PINCIO

Data: 27/11/2026
Branch de trabalho: `feature/pincio-blog-agent`
Estado de produção: preservado; sem merge ou deploy nesta revisão.

## Correções aplicadas

- Corrigido o link “Brasil” que, na página de montagem de pasta, levava à seção Itália.
- Padronizado o link “Conteúdos” na navegação de todas as páginas que usam o menu principal.
- Corrigida a numeração do quinto serviço na página inicial, que aparecia como `08`.
- Padronizada a marca em caixa alta, títulos e metadados da página editorial.
- Preservado `noindex,nofollow`, pois domínio, marca e indexação ainda aguardam decisão.
- Ampliada a área editorial com estilos de cards e páginas de artigo responsivas, com fontes, data de consulta e referências acessíveis.
- Identificado e documentado que `agent/` é um seed antigo do bot n8n, sem relação com o blog. Removido o alias `start` para evitar que seja confundido com o agente editorial; o comando documentado `seed` continua disponível.

## Agente editorial preparado, ainda desativado

O agente manual em `scripts/editorial-agent.mjs` usa a Responses API com busca web e saída estruturada. Pode receber uma pauta ou, no futuro, descobrir uma pauta recente em fontes oficiais. A busca está limitada a domínios governamentais brasileiros, italianos e da União Europeia. O código verifica se os links de fonte foram retornados pela própria busca e se os parágrafos factuais incluem referências.

Os rascunhos são gravados fora da pasta pública, com `status: "draft"`, aprovação falsa e permissão local restrita. Não há agenda, execução contínua ou credencial cadastrada. A ativação exige `PINCIO_EDITORIAL_AGENT_ENABLED=true` e `OPENAI_API_KEY` no ambiente autorizado.

O publicador é um comando separado, bloqueado por `PINCIO_EDITORIAL_PUBLISH_ENABLED=true`. Exige aprovação humana registrada, revisor, data, fontes oficiais e revisão concluída. Gera a página, o card e a entrada de sitemap na branch local. Não faz commit, push, deploy ou publicação direta. Páginas geradas continuam `noindex`.

## Validações executadas

- `npm ci` concluiu sem mudança de dependências do projeto.
- 83 testes de plataforma passaram. As integrações externas nesses testes usam mocks.
- 8 testes de marca, demonstração e CORS passaram; nenhum lead foi enviado ao webhook real.
- 7 testes do agente e do publicador passaram com respostas sintéticas. Não houve chamada à OpenAI, busca real, criação de conteúdo ou publicação.
- Verificações estáticas cobriram 23 páginas HTML e 578 links, assets e fragmentos internos. Nenhum ID duplicado, estrutura principal inválida ou destino local ausente foi encontrado.
- `node --check` passou nos scripts editoriais e no teste novo.

## Verificação visual não concluída

`npm test` não conseguiu iniciar: o lançador do sistema aponta para `/usr/lib/chromium/chromium`, que não está instalado neste executor. A instalação do Chromium gerenciado pelo Playwright foi bloqueada pelo ambiente ao baixar o binário (`HTTP 403`). O Preview da Vercel continua protegido por login. A versão pública foi apenas consultada; esta branch não foi publicada.

## Pendências externas mantidas

- O webhook n8n/Cloudfy não tem DNS confirmado e o recebimento real de leads continua sem homologação. O endpoint e o payload foram preservados.
- Identificação jurídica da empresa e canal de privacidade ainda dependem de confirmação do titular. Os textos não foram preenchidos com dados presumidos.
- Domínio e Clicksign permaneceram fora desta revisão, conforme orientação da titular.

## Fontes técnicas

- [Documentação oficial da busca web na Responses API](https://developers.openai.com/api/docs/guides/tools-web-search?api-mode=responses)
- [Documentação oficial de saídas estruturadas](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Referência oficial da Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
