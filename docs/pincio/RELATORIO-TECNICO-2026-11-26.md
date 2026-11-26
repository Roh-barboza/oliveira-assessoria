# PINCIO — relatório técnico de refinamento

Base: `release/pincio-identidade-2026-11-25` / `9c9ccf5`. Trabalho em `feature/pincio-refinamentos-tecnicos-2026-11-26`, [PR #9](https://github.com/Roh-barboza/oliveira-assessoria/pull/9). O arquivo `CODEX_PENDENCIAS.md` foi lido integralmente e permanece preservado como origem dos requisitos.

Código funcional validado: `2c16b77`. [Preview READY](https://oliveira-assessoria-izkj7vx63-barbozaa-s-projects.vercel.app/), com proteção da Vercel preservada. O slug herdado no URL do Preview é um identificador técnico, não a marca comercial apresentada. O site publicado `https://pincio-assessoria.vercel.app/` e sua configuração não foram substituídos. Não houve merge ou promoção de produção.

## Concluído no código

| Área | Entrega e limite |
|---|---|
| Fotografia | Fotografia real da Piazza del Popolo vista da Terrazza del Pincio, de Krzysztof Golik, realizada em 18/11/2018. Fonte Wikimedia Commons e licença CC BY-SA 4.0 verificadas. Sem IA, montagem ou retoque; redimensionamento proporcional e conversão local para WebP/AVIF em 640, 960 e 1600px, com hashes, dimensões e proveniência. Usada nos dois heros e metadados sociais. |
| Créditos | Autoria, link da origem, licença e informação sobre conversão visíveis junto à fotografia; página `/creditos.html` e link em todos os rodapés. A licença acompanha os derivados da fotografia, não a marca ou todo o código. |
| Marca vetorial | Conferidas as versões em fundo claro/escuro e símbolo em tamanhos pequenos; novas versões monocromáticas claras/escuras com fundo transparente. Nenhum arquivo de fonte foi redistribuído. URLs antigos de SVG continuam funcionando, com conteúdo visual PINCIO. |
| Revisão comercial | 22 páginas sem marca comercial antiga; metadados da ficha IR, documento sintético, README, descrição das ferramentas internas e nomes visíveis da CI atualizados. A minuta sintética e os templates já rebatizados foram conferidos, sem alterar contratos/arquivos reais existentes. |
| Catálogo | Mantido o catálogo público da release (cinco registros italianos e dois brasileiros; Processos Administrativos continua categoria em avaliação). Não foram recriados serviços ou páginas retirados. No simulador, removidas as ofertas de regularização consular e organização documental genérica que ainda vinham de modelos antigos; novas solicitações desses serviços são recusadas. O simulador agora mostra apenas Passaporte, AIRE e FAST IT, sem expandir funcionalidades reais. |
| Limites de passaporte | No simulador, primeira emissão é somente documental; suporte de agendamento consta apenas na renovação. Sem promessa de vagas, emissão ou deferimento. |
| Histórico e preços | Os 20 registros do modelo histórico e os casos existentes não foram apagados ou migrados. A visualização de custos no simulador filtra as modalidades atuais. Nenhum preço foi aprovado ou publicado. |
| Formulário | Endpoint n8n e payload `{nome, whatsapp, area, mensagem}` preservados. Limites de campos, telefone/nome, rejeição de telefone com dígitos repetidos, honeypot local, uma requisição simultânea, timeout de 15s e recuperação do botão. Sem cookies ou referrer no envio externo. Dados permanecem no formulário em caso de falha, sem armazenamento local de leads. |
| Privacidade do formulário | Método HTML POST evita serializar nome/telefone em URL se JavaScript não estiver disponível. Botão só é habilitado após instalar o tratamento de envio. A mensagem diferencia envio HTTP de confirmação humana de recebimento; falha/timeout não estimula reenvio sem verificar duplicação. |
| Privacidade e Termos | Data atualizada e esclarecimento de que rebranding não altera automaticamente a pessoa jurídica. Aviso sobre confirmação da identificação da prestadora/canal de privacidade antes de enviar documentos e sobre dados mínimos no contato. Identificação jurídica/canal efetivos continuam pendentes do titular; não se declara conformidade LGPD concluída. |
| Visual e acessibilidade | Grade de cinco serviços italianos reorganizada para preencher as linhas em desktop/tablet, sem espaços de cartões retirados. Créditos legíveis, alvo de toque ampliado e nome acessível do botão de contato compatível com o texto visível. |
| Diagnóstico e CI | CI do PINCIO passa também no PR da release. Consulta OPTIONS real, somente de leitura e sem dados pessoais, produz evidência independente em artifact. O resultado externo não é mascarado como sucesso do webhook apenas porque os testes de código passaram. |

## Bloqueio real encontrado no recebimento de leads

O host atual `chaoticcow-n8n.cloudfy.live` retornou **NXDOMAIN (DNS status 3)** em consultas independentes aos resolvedores Google e Cloudflare. A CI GitHub confirmou `ENOTFOUND` ao tentar o preflight do domínio PINCIO. No executor local, a tentativa curl também foi bloqueada antes de chegar ao serviço (CONNECT 403). As evidências de DNS e da CI são independentes dessa limitação local.

Consequências: não houve resposta HTTP do n8n para validar CORS; nenhum lead real ou sintético foi submetido ao workflow externo, nenhum recebimento final foi confirmado e não houve teste de deduplicação/antifraude/logs no n8n real. O formulário **não pode ser considerado homologado de ponta a ponta**. Os testes interceptados comprovam o comportamento do navegador e o contrato JSON, não o recebimento externo.

O hostname e o endpoint não foram trocados por suposição. Para retomar, o responsável pelo n8n/Cloudfy deve restabelecer DNS e o workflow ou disponibilizar uma nova URL já provisionada. Depois: confirmar preflight com origem PINCIO, POST e Content-Type; executar envio sintético consentido sem notificações automáticas; localizar a execução/registro correspondente no destino; verificar validação server-side, idempotência, limites de requisição, logs sem PII e política de tratamento. As defesas locais do formulário não substituem controles no webhook.

## Testes e evidências

| Verificação | Resultado |
|---|---|
| `npm ci` | Instalação limpa concluída, sem mudanças de dependências. |
| `npm run test:platform` | 83 testes passaram: autenticação/MFA, contas, convites, permissões, documentos, backups/recuperação, runtime, casos e contratos com provedores simulados. Sem banco real ou credenciais de produção. |
| `node --test tests/platform-public-demo-release.test.mjs tests/pincio-brand.test.mjs tests/pincio-lead-cors.test.mjs` | 8 testes passaram (7 de marca/modo público + 1 de diagnóstico CORS). Incluem licença/hash dos assets, identidade gerada, logos legados, escopo de passaporte e manutenção dos limites do simulador. |
| `npm test` | 22 páginas × 7 larguras = 154 combinações, 360/390/430/768/1024/1366/1920px. Sem falhas; axe sem violações nos estados avaliados, links internos, menu/teclado, formulário interceptado, rascunho IR e navegação sem JS. |
| `npm run test:operational-ui` | Painel/login/logout, ativação/MFA, contratos e formulário com APIs interceptadas passaram; nenhuma mensagem/envio real. Teste final do contrato também confirma ausência de referrer e supressão de submissões simultâneas. |
| `npm audit --omit=dev` | Zero vulnerabilidades reportadas. |
| PDF sintético | Amostra gerada e texto extraído com `pdftotext`: PINCIO presente, marca comercial anterior ausente. Sem partes ou dados reais. |
| CI do código `2c16b77` | [PINCIO — identidade e segurança](https://github.com/Roh-barboza/oliveira-assessoria/actions/runs/45792039820) e [validação operacional](https://github.com/Roh-barboza/oliveira-assessoria/actions/runs/45792039831) concluídas com sucesso. O preflight externo consta como inacessível, não como CORS aprovado. |
| Preview | READY. HTML da página inicial, catálogo e créditos conferido por acesso autenticado Vercel. A navegação anônima encontra o login de proteção; não foi desabilitado. A API operacional respondeu indisponível (503), sem liberar operação real. Os ensaios completos de navegador foram locais/CI, não apresentados como login real em banco externo no Preview. |
| Domínio provisório | Vercel informa `pincio-assessoria.vercel.app` verificado; HTTPS acessível. Isso não comprova registro do domínio `.com.br`. Consulta RDAP oficial não foi conclusiva (404 sem resposta RDAP estruturada); não se declara disponibilidade ou titularidade do domínio pretendido. |

Lighthouse 13.6.0 **local**, após os ajustes finais, uma coleta por dispositivo; não é medição estatística de tráfego real:

| Dispositivo | Desempenho | Acessibilidade | Boas práticas | SEO | CLS |
|---|---:|---:|---:|---:|---:|
| Mobile | 98 | 100 | 100 | 69 | 0 |
| Desktop | 100 | 100 | 100 | 69 | 0 |

SEO reduzido pelo `noindex` herdado e deliberadamente preservado. Não se alterou indexação/domínio para aumentar nota. As auditorias anteriores identificaram alvo de créditos pequeno e nome acessível do contato; ambos corrigidos antes das coletas finais.

## Preservação técnica

Sem alteração de schemas SQL, dados de banco, cookies, storage keys de rascunho, MFA, autenticação, origin allowlists, backups, credenciais, variáveis ou permissões. Não foram executados seeds, migrações, setup operacional, chamadas Clicksign reais, WhatsApp, pagamentos ou notificações. As configurações técnicas herdadas `oliveira-*`, `OLIVEIRA_*`, identificador `$id` do schema IR, `source` de integração e slug do repositório/projeto foram mantidos. Arquivos históricos não foram rebatizados em massa; o novo conteúdo comercial é PINCIO.

## Ações que exigem titular, responsável ou acesso externo

1. **Prioridade crítica — n8n/Cloudfy:** restabelecer o serviço/domínio ou fornecer endpoint novo já provisionado, e acesso à comprovação de recebimento/logs. Confirmar destino dos leads e desligar mensagens automáticas no teste. Depois disso a integração deve ser homologada novamente; o frontend sozinho não corrige DNS do fornecedor.
2. **Identificação e LGPD:** confirmar pessoa jurídica/controlador, razão social/CNPJ quando aplicável, canal de privacidade, bases/finalidades, fornecedores e retenção. Inserir informações reais após validação, sem inventar registros.
3. **Domínio/marca:** consulta e eventual registro do `.com.br` pelo titular, pesquisa completa de marca no INPI e avaliação profissional. Nenhuma compra/reserva ou alegação de exclusividade foi feita. Só depois configurar DNS, HTTPS, redirects e indexação com autorização e rollback.
4. **E-mail e contato:** confirmar domínio e caixas institucionais, SPF/DKIM/DMARC, encaminhamento e eventual número empresarial de WhatsApp. Nenhum endereço ou número fictício foi adicionado.
5. **Clicksign e minutas:** titular deve cadastrar token Sandbox novo/válido diretamente nos secrets, confirmar signatário de teste e revisão jurídica. Nenhuma credencial deve ser enviada no chat. Não se presume que o 401 histórico foi resolvido nem que contratos reais possam ser usados.
6. **Operação real/persistência:** homologação em ambiente autorizado, armazenamento segregado, antivírus documental, backups e recuperação reais, contas/MFA/RBAC e revisão dos instrumentos antes de qualquer liberação. Testes isolados existentes não substituem essa homologação externa.
7. **Publicação:** revisar o PR e decidir a incorporação na release. Nenhum merge ou deploy de produção ocorreu nesta entrega.

## Anexos

- [Página inicial desktop](evidence/home-desktop.png) e [mobile](evidence/home-mobile.png).
- [Consulares desktop](evidence/consulares-desktop.png) e [mobile](evidence/consulares-mobile.png).
- [Variantes da marca](evidence/marca-variacoes.png), [créditos](evidence/creditos-desktop.png) e [amostra PDF sintética](evidence/minuta-sintetica-pincio.pdf).
- [Regressão pública](evidence/public-validation.json), [backend](evidence/backend.txt), [marca/CORS](evidence/brand-and-cors.txt), [interface operacional](evidence/operational-ui.txt), [contrato final do formulário](evidence/lead-contract-final.txt), [auditoria](evidence/npm-audit-runtime.json).
- [DNS Google](evidence/dns-google.json), [DNS Cloudflare](evidence/dns-cloudflare.json) e [preflight da CI](evidence/ci-cors.json).
- [Lighthouse final](evidence/lighthouse-final.json), JSONs completos `evidence/lighthouse-*.json.gz`, [metadados do Preview](evidence/deployment-code.json) e [licença/proveniência das imagens](../../landing/assets/pincio-fotografia-licenca.json).

As capturas contêm telas vazias ou dados exclusivamente sintéticos, sem senhas, tokens, códigos MFA ou informações de clientes reais.
