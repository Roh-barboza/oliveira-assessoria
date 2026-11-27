# Agente editorial da PINCIO

## Estado

O agente está implementado como ferramenta manual de rascunhos e permanece **desativado**. Não foi configurado um secret de IA, não existe execução agendada, integração contínua de pauta, publicação automática ou credencial de produção. O site não recebe conteúdo gerado sem revisão da equipe.

O agente usa a Responses API com busca web e saída JSON estruturada. A resposta é validada contra fontes HTTPS oficiais encontradas pela própria busca, salva em `docs/pincio/editorial/drafts/` com permissão local restrita e marcada como rascunho. Não envia dados pessoais. A chamada usa `store: false`.

## Uso futuro, após configuração autorizada

1. Cadastrar `OPENAI_API_KEY` como secret do servidor ou do ambiente de trabalho autorizado. Nunca colocar a chave no frontend, no repositório, em arquivo `.env` versionado ou no chat.
2. Ativar manualmente `PINCIO_EDITORIAL_AGENT_ENABLED=true` somente quando quiser pesquisar. Sem essa variável, o programa encerra antes de fazer qualquer requisição.
3. Para pesquisar uma pauta definida:

   ```sh
   npm run editorial:draft -- --topic "Atualização oficial sobre determinado procedimento consular"
   ```

   Para o agente identificar uma pauta recente nos canais oficiais e preparar um rascunho:

   ```sh
   npm run editorial:draft -- --discover
   ```

4. Conferir o arquivo JSON gerado: atualidade, fatos, aplicabilidade, fontes, textos e eventuais pontos que exigem especialista. O modelo não aprova o próprio conteúdo.
5. Após revisão editorial e técnica, a pessoa responsável registra no arquivo `status: "approved"`, `review.approved: true`, `review.reviewer`, `review.approvedAt` e resolve todos os itens de `reviewPoints`.
6. Com a publicação habilitada em uma sessão autorizada, executar `npm run editorial:publish -- docs/pincio/editorial/drafts/SLUG.json`. Esse comando só altera os arquivos locais da branch: cria a página do artigo, atualiza o índice e o sitemap. Não faz commit, push ou deploy.
7. Revisar o diff e publicar o site pelo fluxo normal de pull request e deploy. Sem aprovação registrada, fonte oficial válida ou citação associada ao texto, o comando recusa a publicação.

As operações de pesquisa e de publicação têm flags de ativação independentes. A pesquisa precisa de `PINCIO_EDITORIAL_AGENT_ENABLED=true`; a geração de páginas requer `PINCIO_EDITORIAL_PUBLISH_ENABLED=true`. Nenhuma delas está ativa nesta entrega.

## Limites editoriais

- A busca restringe resultados a fontes oficiais selecionadas: órgãos públicos brasileiros, órgãos italianos e instituições da União Europeia. Se não houver duas fontes oficiais suficientes, não é criado rascunho.
- Cada parágrafo factual precisa apontar para uma ou mais fontes encontradas na busca. URLs fora da lista oficial ou URLs inventadas são recusadas.
- Conteúdos sobre cidadania, regras consulares, migração, tributos, direito ou saúde continuam sujeitos a revisão humana qualificada. A fonte oficial não substitui análise do caso concreto.
- O agente não negocia, recebe documentos, coleta dados de clientes, assina contratos, acessa portais de usuários ou envia mensagens.
- O agente não publica por conta própria. O publicador exige aprovação registrada, gera apenas arquivos locais e não altera ambientes da Vercel.

## Formato dos artigos

Cada rascunho contém pauta encontrada, título, resumo, categoria, blocos de texto, referências explícitas, fontes com órgão e datas de consulta, pontos de revisão e estado de aprovação. A lista pública exibe artigos aprovados; cada artigo mostra suas fontes, data e aviso informativo.

## Testes

Os testes usam respostas sintéticas e `fetch` interceptado. Não chamam a OpenAI, não fazem busca externa, não criam publicação real e não requerem secrets:

```sh
npm run test:editorial
```
