# Segurança, operação e dependências

## Controles implementados no teste

- Contas individuais sintéticas com senhas aleatórias, scrypt/salt, comparação de hash em tempo constante e sessões opacas revogáveis. Sem senhas padrão, login real, recuperação por e-mail ou identidade empresarial presumida.
- Cookies HttpOnly/SameSite Strict; Secure e prefixo `__Host-` em HTTPS. Mutação exige origem exata e CSRF. Webhook é a exceção à origem de navegador e exige HMAC próprio; desativado no deploy por ausência de segredo.
- ACL no servidor em cada caso/documento/PDF; cliente vê somente seus casos. Jennifer vê os casos sob sua execução/revisão. Rodrigo administra o espaço de teste. Propriedade e papéis não vêm de campos enviados pelo cliente.
- Arquivos e PDFs fora de `landing`; estado privado cifrado AES-GCM com contexto por espaço. Upload de conteúdo real é recusado; somente fixture de texto exato. A aplicação não aceita executáveis/PDFs arbitrários, URLs de download externas ou credenciais de portais.
- Respostas privadas sem cache, noindex, anexos autenticados e erros com identificador sem dados pessoais. CSP nas interfaces novas. Logs de erro não incluem corpo, senha ou documentos.
- Auditoria encadeada detecta alteração no histórico dentro do estado. Não é trilha imutável com ancoragem externa ou prova legal. Descarte apaga o conteúdo do estado ativo e deixa tombstone, motivo, política e autor; não apaga snapshots anteriores ou substitui política jurídica.
- Compare-and-swap evita sobrescrita concorrente sem verificação. Limites de tamanho/volume por espaço e rate-limit em processo. Para produção, rate-limit distribuído, antiabuso e gestão de identidades com MFA são dependências, não controles já comprovados.
- Assinaturas e pagamentos terminam em estados explicitamente simulados. Idempotência e validação de valor/chave; não há webhook financeiro de adquirente real, cartão, captura, estorno bancário ou reconciliação externa.
- Segredos locais ignorados pelo Git. Nenhuma chave exportada para a Vercel após a rejeição automática. Configuração nova não lê/substitui secrets anteriores ou webhook n8n.

## Variáveis para uma futura conexão Preview

| Nome | Finalidade | Situação |
|---|---|---|
| VERCEL_ENV / VERCEL_GIT_COMMIT_REF | Gate de Preview e branch exata | Injetadas pela plataforma |
| OLIVEIRA_PLATFORM_STORE | `temporario`, `blob` ou `postgres` | Padrão temporário |
| OLIVEIRA_DATA_KEY | Nova chave AES, 64 hex, protegida | Exportação requer autorização específica |
| BLOB_STORE_ID | Store privado de teste | Criado, vazio e não conectado |
| OLIVEIRA_PREVIEW_DATABASE_URL | Alternativa Postgres dedicada | Não configurada; não utilizar banco de produção/n8n |
| CLICKSIGN_* | Credencial nova e sandbox explicitamente habilitado | Adaptador isolado; runtime do painel não consome |
| Google Drive empresarial | Token de escopo mínimo, raiz privada, revisão de permissões | Conta pendente; não reutilizar sessão pessoal |
| WhatsApp Business / provedor financeiro / LLM | Credenciais, políticas e consentimentos específicos | Não configurados; sem transporte real |

Cadastrar secrets diretamente no destino protegido e restrito à branch, nunca no PR, código, captura ou chat. Conexão de storage exige também permissão de identidade/OIDC do projeto; apenas um ID não prova acesso.

## Backup e recuperação já executáveis localmente

`node scripts/platform-backup.mjs backup .local-platform/state.sqlite /caminho/novo-snapshot.sqlite`

`node scripts/platform-backup.mjs restore-copy /caminho/snapshot.sqlite /caminho/restaurado.sqlite`

Snapshot SQLite consistente e cifrado, sem a chave. O destino precisa ser novo; não sobrescreve bases. A restauração testa integridade estrutural; a suite também testa a abertura do estado com a chave correta. Guardar a chave separadamente em mecanismo aprovado. A operação deve ser feita em área privada, fora do Git. Não houve upload ou backup externo de dados.

Para recuperação real de Blob/Postgres, ainda definir cópias, versionamento, região, responsáveis, frequência e ensaiar restauração com chave separada. Recuperar primeiro em ambiente isolado, validar ACL/contagens/hashes, depois autorizar troca. Sem aprovação jurídica, não fixar retenção universal ou exclusão de backups.

## Checklist anterior a clientes reais / produção

- [ ] Aprovação comercial expressa dos cinco escopos, modalidades, preços/custos e política de continuidade; não basta seleção operacional.
- [ ] Revisão jurídica de minutas, autorizações, bases LGPD, originais/devolução, retenção e eliminação inclusive backups; identificar empresa/prestadores.
- [ ] Provar G3 com canal privado autorizado, duas identidades, restrições de acesso, uploads reais controlados, expiração/revogação e recuperação.
- [ ] Trocar bootstrap de demonstração por identidade empresarial/convite seguro, MFA para equipe, recuperação e desligamento de usuários.
- [ ] Storage durável em região aceita, migrações explícitas e ensaio de concorrência; remover dependência de memória e ampliar modelo além do agregado limitado.
- [ ] Confirmar procedimentos/representação perante consulado de São Paulo e órgãos/cartórios; titular continua responsável por autenticação, envio e atos pessoais. Questões reguladas vão para habilitado.
- [ ] Clicksign sandbox de ponta a ponta com credencial nova e signatário autorizado; provedor financeiro em sandbox com webhook assinado, deduplicação, estorno e conciliação testados antes de integrar real.
- [ ] WhatsApp: informar número empresarial, validar consentimento, templates, janela, operador humano e política de cancelamento. Sem disparos enquanto pendente.
- [ ] IA: selecionar modelo/provedor, contrato de dados, minimizar contexto e testar respostas/falhas antes de substituir o motor local; nunca substituir revisão especializada.
- [ ] Rate-limit distribuído, monitoramento de falhas sem PII, alertas e resposta a incidentes; logs atuais registram somente erros genéricos com requestId.
- [ ] Aprovar domínio definitivo, retirar noindex apenas na produção aprovada e validar sitemap/canonical/SEO do domínio real. Previews continuam noindex.
- [ ] Autorização expressa para release. Nenhum merge, promoção ou alteração de domínio ocorreu nesta entrega.

## Release e rollback preparados, não executados

Revisar e testar commit exato no PR vinculado ao #6. Antes de qualquer lançamento, snapshot consistente e restauração ensaiada, inventário de secrets, contatos de responsáveis e validação dos fluxos de ponta a ponta. Manter o deployment de produção atual registrado. Uma futura liberação deve ser feita em deployment de produção sem atribuir domínio, revisada e promovida somente por decisão expressa. Em incidente, desabilitar novas operações, preservar evidências privadas e reatribuir o deployment anterior; restauração de dados exige plano separado, não se resolve só com rollback de código.
