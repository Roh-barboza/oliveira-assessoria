# Plataforma operacional — Preview de teste

Implementação posterior ao PR #6, sem merge e sem alteração da produção. Branch: `feature/plataforma-operacional-preview`; base: `fb91d10`. A instrução de execução completa mais recente autoriza implementar as etapas posteriores em teste; não representa aprovação comercial, jurídica ou de publicação.

## Preview validado

[Site e catálogo](https://oliveira-assessoria-ekhw33jq9-barbozaa-s-projects.vercel.app/) · [Plataforma de teste](https://oliveira-assessoria-ekhw33jq9-barbozaa-s-projects.vercel.app/plataforma.html) · [PR #7](https://github.com/Roh-barboza/oliveira-assessoria/pull/7), vinculado ao [PR #6](https://github.com/Roh-barboza/oliveira-assessoria/pull/6). Código funcional validado: `96df056`. Produção permanece no deployment anterior `dpl_9WmwZYXXnmXQscmwMRATydJKUxNq`; nenhuma promoção foi feita.

## Como revisar

- `/servicos.html`: catálogo com 12 registros preservados, busca e filtros Brasil/Itália; seleção do piloto indicada, IR e filhos adiados, demais registros para expansão.
- `/solicitar.html` e `/plataforma.html`: criar demonstração privada, guardar credenciais individuais exibidas uma única vez e alternar entre Rodrigo, Jennifer e dois clientes fictícios.
- Solicitar análise em três etapas; salvar e retomar rascunho autenticado; abrir caso com responsável e revisor.
- Adicionar checklist, baixar o arquivo sintético permitido e enviá-lo. Jennifer faz a primeira conferência e Rodrigo a segunda; FAST IT inverte. O servidor recusa dados binários diferentes do fixture, acesso de outro cliente e preparação sem ambas as conferências.
- Registrar marcos, T0 (somente após aceite do escopo de teste e dados mínimos), protocolo, pendências, revisões, tarefas e encerramento. AIRE tem janela pós-protocolo de 180 dias; organização completa, 60 dias após último protocolo do lote inicial. Duas rodadas por escopo; erro da Oliveira não consome. FAST IT e regularização têm limites específicos descritos nas modalidades; ainda não há cronômetro de sessões nem separação automática entre a rodada de complementos e a de esclarecimento do diagnóstico.
- Gerar PDF por modalidade, conferir hash e versão, simular convite interno e assinar como o cliente proprietário. Sem assinatura eletrônica válida, e-mail ou envelope externo. O PDF é a minuta original marcada como teste.
- Equipe: preencher custos **apurados** na ferramenta de 20 linhas. Vazio não vira zero. Escolher custo direto ou horas; simular margem, preço alvo e parcelas. Taxas oficiais e despesas do cliente ficam separadas. Acompanhamento e adicionais são rascunhos internos. Nenhum preço é aprovado ou publicado.
- Equipe: simular PIX/cartão com valor manual de teste e chave idempotente; confirmar/falhar/cancelar. Nenhum dado de cartão é solicitado, nenhum QR de cobrança ou comprovante real é emitido.
- Gerar tarefa de follow-up com opt-in, deduplicação por janela e revisão humana. Pausa, encerramento e revogação interrompem sugestões. Não existe transporte de mensagens ativo.

## Execução local

Node **24.x**. `npm ci` e `npm run dev`; abrir `http://127.0.0.1:4176/plataforma.html`.

A primeira execução gera chave aleatória local e banco SQLite em `.local-platform/`, ignorados pelo Git, com permissões restritas. Todo o estado é cifrado AES-256-GCM com contexto do espaço, inclusive documentos, PDFs e credenciais derivadas com scrypt. Não copiar a pasta para o repositório, artefatos ou serviços externos. A demonstração expira logicamente após 24h e as sessões após 1h; isso é regra de teste, **não prazo jurídico de retenção**. O banco local não é apagado automaticamente por expiração.

## Arquitetura implementada

Interface HTML/CSS/JS sem framework → API Node com cookies HttpOnly/SameSite/CSRF → regras e ACL no servidor → repositório cifrado com compare-and-swap. Produção e outras branches retornam 404. O runtime habilita somente `VERCEL_ENV=preview` na branch exata desta entrega. Não existe flag que libere cobrança, mensagem ou oferta comercial.

- `server/platform/app.mjs`: identidade de teste, RBAC, casos, revisões, tarefas, minutas, simulações financeiras, auditoria encadeada, webhook HMAC de teste.
- `store.mjs`: memória, Blob privado com ETag e Postgres com CAS. `sqlite.mjs`: persistência local. Limite de 2 MB por espaço; modelo agregado para piloto pequeno, não arquitetura multiempresa em escala.
- `api/plataforma.mjs`: função Vercel. Se persistência foi explicitamente configurada e falha, retorna 503; **não** rebaixa silenciosamente para memória.
- `providers/drive.mjs`: provisionamento de pasta por caso, verificação de permissões restritas e leitura de metadados por credencial empresarial injetada. Testes com rede simulada; não conectado ao painel e sem upload/leitura de conteúdo Drive implementados. Documentos funcionam no repositório cifrado atual. Acesso individual de clientes no Drive e conta empresarial precisam de configuração/validação.
- `providers/clicksign.mjs`: adaptador de sandbox reaproveitado do PR #2, desacoplado do simulador. Exige teste explícito/embedded; notificações desativadas. Falta prova real de sandbox, credencial nova e revisão da API.
- `providers/followup.mjs`: fronteira opcional de modelo, com saída limitada e falha encaminhada à equipe. O painel usa **motor determinístico de regras**, não IA generativa conectada. Provedor/modelo e política de dados ainda pendentes.
- `providers/whatsapp.mjs`: política testável de opt-in, janela de 24h, template e revisão humana, com envio sempre bloqueado. Número empresarial continua pendente, sem número fictício.
- `db/platform.sql`: migração apenas para banco Preview dedicado. Não foi aplicada a banco externo ou n8n.

## Persistência do Preview: bloqueio específico

O Preview usa memória cifrada por processo e pode perder a sessão/dados em reinícios ou requisições atendidas por outra instância. Não serve para documentos reais, continuidade operacional ou teste de durabilidade externa. SQLite foi testado localmente, inclusive recuperação; Postgres foi testado com PGlite e Blob com rede simulada.

Foi criado um store **privado e vazio** `oliveira-platform-preview` (`store_85Ar0XqTHja9xFLb`, região `gru1`), não conectado ao projeto. A criação de um projeto Vercel separado retornou 403. A revisão automática rejeitou cadastrar uma nova chave de criptografia nas variáveis protegidas do Preview do projeto existente por exigir autorização específica para enviar esse segredo ao destino externo. Nenhuma chave foi embutida, publicada ou enviada por caminho alternativo.

**Atualização de 18/11/2026:** autorização específica recebida, condicionada ao isolamento por branch. A conexão foi interrompida antes de qualquer alteração porque esse isolamento das permissões Blob/OIDC não pôde ser comprovado. O bloqueio atual é técnico, e não a autorização anterior. Veja [a validação e evidências sem secrets](VALIDACAO-ISOLAMENTO-BLOB.md).

Somente após comprovar o isolamento exigido, configurar **somente Preview e somente esta branch**: `OLIVEIRA_PLATFORM_STORE=blob`, `BLOB_STORE_ID` e `OLIVEIRA_DATA_KEY` (64 hex aleatórios, protegida), conectar o store ao projeto de teste com permissões mínimas/OIDC e provar reinício, concorrência, ACL e recuperação. Nenhuma variável existente deve ser lida ou substituída. Alternativa futura: Postgres dedicado com `OLIVEIRA_PREVIEW_DATABASE_URL`, mesma chave protegida e migração explícita. Não habilitar ambos.

**Atualização de 19/11/2026 — destino exclusivo criado pelo proprietário via CLI:** o projeto `oliveira-plataforma-preview` (`prj_IB4FPuQ8CWkSS0VjZvIQsq3kE2Ie`) existe na equipe `barbozaa-s-projects`, com Node 24.x, framework Other, saída `landing`, raiz `.`, Git ainda não conectado e sem URL de produção. O diretório local `C:\\Users\\venda\\oliveira-preview-src` foi vinculado com `npx vercel link`. A conexão Vercel acessível nesta conversa ainda retorna 404 para esse novo projeto, apesar de o CLI autenticado confirmá-lo. **Nenhuma chave, Blob, deployment, branch Git ou integração real foi conectada ao projeto novo.** O bloqueio 403 anterior foi superado pelo CLI do usuário, mas ainda falta validar isolamento de acesso à identidade Preview e a forma de criar um primeiro deployment sem contrariar a proibição de Production. [Histórico e situação](VALIDACAO-ISOLAMENTO-BLOB.md#continuação-tentativa-de-destino-exclusivo).

**Correção técnica adicional nesta branch (19/11/2026):** o adaptador Blob agora configura `allowOverwrite: true` ao enviar uma versão ETag com `ifMatch`, conforme exige o SDK para atualização condicional. O teste de regressão foi ampliado para criação, atualização, conflito e gravações concorrentes. **Os testes alterados ainda não foram executados nesta rodada**, e não houve publicação; ver [TESTES.md](TESTES.md).

## Evidências e próximos passos

Veja [TESTES.md](TESTES.md), [SEGURANCA-E-OPERACAO.md](SEGURANCA-E-OPERACAO.md) e [MATRIZ-ENTREGA.md](MATRIZ-ENTREGA.md). Capturas contêm apenas casos sintéticos e não incluem senhas ou cookies. A implementação não deve ser descrita como pronta para clientes reais enquanto os bloqueios de persistência, identidade, LGPD, minutas e operação externa permanecerem.
