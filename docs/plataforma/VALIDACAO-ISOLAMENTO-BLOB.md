# Validação anterior à conexão Blob — 18/11/2026

## Decisão

**Conexão interrompida antes de qualquer alteração na Vercel.** A autorização expressa para gerar e cadastrar uma chave nova foi recebida, condicionada à exclusividade de Preview da branch `feature/plataforma-operacional-preview`. O bloqueio atual é comprovar a granularidade das permissões do armazenamento, não falta de autorização para exportar a chave.

A condição do usuário exige não compartilhar permissões com Produção, Development ou outras branches. Restringir variáveis por branch e conferir `VERCEL_GIT_COMMIT_REF` na aplicação não prova que a autorização do armazenamento está restrita àquela branch.

## Evidências obtidas sem secrets

| Verificação | Resultado |
|---|---|
| Store consultado | `oliveira-platform-preview` / `store_85Ar0XqTHja9xFLb` |
| Acesso / região | Privado / `gru1` |
| Projetos conectados | Zero; `projectsMetadata` vazio |
| Objetos / tamanho reportados | Zero / zero |
| Consulta de metadados das três variáveis solicitadas na branch, sem decriptação | Nenhum registro correspondente retornado |
| Variáveis criadas ou alteradas nesta verificação | Nenhuma |
| Nova chave gerada/cadastrada nesta verificação | Não; a pré-condição de isolamento não foi satisfeita |
| Dados enviados ao Blob | Nenhum |

Não foram lidas chaves ou credenciais existentes. A consulta de variáveis usou `decrypt=false`; apenas nomes/tipos/targets/branch dos registros relevantes seriam registrados, sem valores. A resposta não trouxe registros correspondentes aos três nomes solicitados.

## Limite técnico identificado

A documentação oficial atual do SDK Blob descreve a conexão por **projeto e ambientes**. A interface documentada não apresenta seleção de branch ou política de autorização por branch. A referência OIDC documenta um subject composto por owner, project e environment; os claims documentados não incluem a branch Git. Os tools disponíveis para este trabalho também não oferecem uma política Blob verificável por branch.

Isso não prova que toda alternativa futura da plataforma seja impossível. Significa que **não há garantia demonstrada de cumprimento da condição 3 com a conexão disponível**. Não foi criado um vínculo amplo para tentar corrigi-lo depois. Nem o ID oculto nas outras branches nem a chave de decriptação restrita substituem a restrição de leitura/escrita/exclusão do próprio store.

Fontes oficiais consultadas em 18/11/2026:

- [Blob SDK — conexão e autenticação](https://vercel.com/docs/vercel-blob/using-blob-sdk#connect-to-a-project-highly-recommended).
- [Referência OIDC — subject e claims](https://vercel.com/docs/oidc/reference).
- [CLI Blob — seleção de ambientes](https://vercel.com/docs/cli/blob).

## Testes e entrega

Não houve configuração, redeploy funcional ou alteração do runtime. O Preview anterior continua em memória temporária. Os testes de persistência Blob entre reinícios, concorrência remota, criptografia remota, autorização entre branches e recuperação remota **não foram executados**, pois exigiriam conectar um armazenamento sem o isolamento comprovado. Os resultados anteriores de SQLite, mocks e navegador não são apresentados como prova dessa conexão.

Nenhuma mudança em Produção, Clicksign, n8n, WhatsApp, pagamentos, mensagens ou contratos reais; nenhum merge. A alteração deste registro é apenas documental.

## Requisito para retomar

Provar uma política de acesso do Blob que selecione a branch autorizada e negue as demais identidades, ou acordar uma arquitetura de teste isolada, como projeto exclusivo de Preview ou ambiente personalizado exclusivo com política verificável. Essas alternativas mudam o destino/ambiente atualmente autorizado e não foram aplicadas. Não usar token compartilhado, conexão com todos os Previews, script na aplicação ou separação por prefixo como substitutos da condição de isolamento.

Só depois dessa definição: gerar uma chave nova com fonte criptograficamente segura, cadastrar as três variáveis protegidas no escopo aprovado, conectar com permissão mínima, executar reinício/concorrência/ACL/criptografia/recuperação e a regressão completa, e entregar um novo Preview de persistência validada.

## Continuação: tentativa de destino exclusivo

Após a instrução de continuidade, foi iniciada a alternativa de projeto exclusivo `oliveira-plataforma-preview`, na equipe `barbozaa-s-projects`, separado do projeto atual. A consulta de projetos com esse nome retornou lista vazia. A tentativa de criação, sem Git conectado, sem secrets e sem deployment de produção, retornou **HTTP 403 / forbidden**, operação `POST /v11/projects`: a conexão Vercel atual não tem permissão para criar o projeto.

Não há CLI Vercel instalada/autenticada disponível como fallback: não foi encontrado executável, token de CLI no ambiente nem arquivo de autenticação de CLI nos locais padrão verificados. Nenhum conteúdo de credencial foi lido. Não se tentou repetir a mesma criação, usar outra conta, criar destino pessoal ou ampliar a conexão do store ao projeto de produção.

A autorização de continuidade foi registrada. A ação necessária agora é habilitar a criação de projetos na conexão Vercel da equipe, ou disponibilizar o projeto exclusivo vazio `oliveira-plataforma-preview` nessa equipe. Não é necessário enviar tokens pelo chat. O projeto deverá ser criado sem conectar automaticamente o armazenamento a todos os ambientes.

### Configuração a validar quando o destino existir

1. Destino exclusivo de teste, separado de `oliveira-assessoria`, sem vínculo Git que gere automaticamente deployments de outras branches.
2. Somente deployments Preview do commit aprovado da branch `feature/plataforma-operacional-preview`; nenhum deployment de produção.
3. Conexão do store exclusivamente à identidade Preview do novo projeto, com negativa verificada para Produção, Development e projetos originais. Antes da conexão, validar também como impedir uso por outras branches no destino exclusivo; criar o projeto, isoladamente, ainda não comprova todos os controles.
4. Gerar chave nova somente após essa validação e cadastrar `OLIVEIRA_DATA_KEY`, `OLIVEIRA_PLATFORM_STORE=blob` e `BLOB_STORE_ID` no Preview da branch permitida. Nenhum segredo em arquivos versionados ou evidências.
5. Executar persistência entre processos/deployments, CAS concorrente, criptografia, ACL entre clientes e identidades de ambientes, recuperação e regressão completa. Registrar resultados reais, sem substituir testes remotos por mocks.

A consulta do store após a tentativa confirmou novamente acesso privado, zero objetos, tamanho zero e zero projetos conectados. Nenhuma chave, variável, permissão de armazenamento ou integração real foi criada ou alterada. Os testes remotos e o novo Preview persistente seguem bloqueados pelo pré-requisito de infraestrutura. Esta continuação alterou apenas documentação; não representa uma nova rodada de testes funcionais.
