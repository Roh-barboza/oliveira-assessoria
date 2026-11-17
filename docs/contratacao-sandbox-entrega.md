# Contratação digital da Oliveira Assessoria

## Escopo desta entrega

A página `/contratacao.html` atende dois perfis. Participantes entram com um convite de sandbox, preenchem a triagem, conferem a minuta, iniciam a assinatura de teste e consultam o andamento. Jennifer e Rodrigo entram com contas distintas, filtram solicitações, consultam respostas, PDFs, assinaturas, simulações de pagamento e auditoria. O painel também registra revisão de triagem, sincroniza com a Clicksign e acompanha as etapas de um atendimento simulado.

O PR foi construído sobre `feature/clicksign-contratacao-prototipo` (`f4b7625`, PR #1). A produção observada na Vercel tinha um deploy disponível de `feature/jennifer-ir-assistant-mvp` (`2adb1af`) para o site premium. O projeto também conserva um deploy histórico de `main`. Os arquivos da home, o JavaScript de captação e os workflows do n8n são idênticos aos do PR #1.

O catálogo segue os quatro serviços e valores ilustrativos da especificação. A triagem coleta circunscrição declarada, maioridade e três respostas específicas do serviço. São Paulo é a circunscrição habilitada para o cenário de teste. As outras, menores e respostas pendentes seguem para revisão humana. A revisão é registrada no painel e a solicitação continua bloqueada para assinatura. A identidade fictícia é preenchida pelo servidor e a API rejeita substituições. Senhas de contas oficiais, documentos de identidade e dados de cartão ficam fora do formulário.

A minuta de teste utiliza base e anexo versionados, congela um retrato com escopo, dados e valor em centavos, gera um PDF no servidor e grava o SHA-256 do binário conferido. O documento tem marca visível de sandbox. A versão da prévia permanece vinculada ao PDF persistido. A integração envia o mesmo binário que o participante conferiu.

## Arquitetura e controles

- `api/contratacao.mjs` concentra os endpoints em uma função Node.js. `landing/` continua sendo a saída estática da Vercel. O fallback existente da home continua disponível para rotas fora de `/api`.
- `db/contratacao-sandbox.sql` cria tabelas isoladas para sessões, limites, pedidos, auditoria e eventos processados. Identidade, minuta e PDF assinado usam AES-256-GCM com contexto vinculado ao pedido e ao tipo de arquivo. Aplicativo e migração devem usar contas separadas. Guarde a chave fora do banco e inclua sua recuperação segura no plano de backup do sandbox.
- Cookies opacos `HttpOnly` e `SameSite=Strict` são validados no servidor e têm validade de sete dias. Em preview são também `Secure` e `__Host-`. Pedidos ficam vinculados à sessão que os criou. Encerrar a sessão ou trocar de navegador perde o acesso do participante a esses pedidos. A equipe continua com acesso. Antes do uso real, implemente identidade persistente e recuperação com verificação de titularidade.
- O servidor valida a origem de operações do navegador, limita criação e envio e restringe PDFs ao titular ou à equipe. Downloads são anexos privados sem cache. A auditoria registra conta/perfil, ação, hash ou etapa quando aplicável, sem corpo bruto ou dados da Clicksign.
- A transição para envio é atômica. A função grava o estágio e os IDs entre operações da Clicksign. Uma falha com resultado externo ambíguo bloqueia reenvio automático. Em caso de interrupção, procure pelo nome `SANDBOX Oliveira <referência>` no painel Clicksign, confira a etapa e use a sincronização quando já houver ID registrado. Se for preciso repetir um envio incompleto, confirme o estado do envelope anterior na Clicksign e cancele-o lá antes de abrir outro pedido de teste. Um e-mail de notificação pode ter sido entregue mesmo quando a resposta falhou.
- Pix e cartão usam uma interface de simulação que recebe valor e moeda do pedido. A interface guarda somente a modalidade e o estado simulado. A futura integração exige checkout hospedado por gateway, referência externa, criação idempotente e confirmação autenticada de valor, moeda e pedido.
- A função desativa o fluxo em produção mesmo com as flags da integração habilitadas. Em preview o destino Clicksign é fixo no sandbox. O ambiente local aceita somente loopback, com a flag local explícita. O site existente não tem links públicos para o fluxo de testes.

## Clicksign API v3

A função usa JSON:API com token no cabeçalho `Authorization`. Cria envelope, envia o PDF, cadastra signatário fictício, adiciona `agree/sign` e `provide_evidence` para o documento, muda o envelope para `running` e, na modalidade hospedada, solicita o envio para a caixa controlada de teste. Confirme na conta a liberação do endpoint de notificação.

O webhook recebe `POST /api/contratacao?op=webhook`, valida `Content-Hmac` SHA-256 sobre os bytes crus e relaciona o documento ao pedido. Eventos repetidos são deduplicados. Para concluir uma assinatura, a função confirma o fechamento do envelope e do documento, a ocorrência da assinatura na API e a disponibilidade do PDF assinado. O download é tamanho-limitado e restrito a hosts permitidos. A confirmação e o arquivo são gravados juntos.

O Widget Embedded foi incluído atrás de `CLICKSIGN_EMBEDDED_SANDBOX`. Usa o ID do signatário já ativado, a biblioteca 2.1.0, autenticação `embedded_signature` e origem explícita. A interface consulta o estado persistido após a assinatura. O widget está disponível no sandbox. Para produção, a Clicksign informa disponibilidade a partir do Plano Avançado e contratação específica do recurso via **Configurações → API → Contratar**. Confirme preço, limites e modalidade contratada com a Clicksign antes de decidir o canal. Caso habilite a versão de produção no futuro, revise também o isolamento do JavaScript de terceiros.

- [Ambientes, autenticação e formato](https://developers.clicksign.com/docs/ambientes-autenticacao-e-formato)
- [Fluxo de criação do envelope](https://developers.clicksign.com/docs/guia-de-criacao-o-passo-a-passo-padrao)
- [Requisitos de signatário e documento](https://developers.clicksign.com/reference/criar-requisito-de-autenticacao)
- [Notificação de signatário](https://developers.clicksign.com/reference/api-notificar-signatario)
- [Segurança de webhooks](https://developers.clicksign.com/docs/seguranca-de-webhooks)
- [URLs de PDF assinado](https://developers.clicksign.com/reference/api-documentos)
- [Instalação do Widget Embedded para API v3](https://developers.clicksign.com/docs/implementando-o-widget-embedded)
- [Modalidade de assinatura incorporada](https://developers.clicksign.com/docs/instalacao-de-widget-assinatura-tokenless)
- [Disponibilidade comercial do Widget Embedded](https://ajuda.clicksign.com/article/694-widget-embedded)

## Configuração do preview de sandbox

1. Provisione Postgres separado do agente/n8n e aplique `db/contratacao-sandbox.sql`. A conexão de preview exige TLS com certificado verificável. Dê ao usuário de execução apenas as permissões necessárias de uso do schema, leitura/escrita de pedidos, sessões e limites, e inserção/leitura de auditoria e eventos. Mantenha as permissões de migração, limpeza e rotação em uma conta administrativa do banco.
2. Configure as variáveis do arquivo `.env.contratacao.example` no ambiente **Preview**, com escopo da branch de desenvolvimento quando disponível. Em preview, deixe `CONTRACTS_LOCAL` ausente e informe em `CONTRACTS_ORIGIN` o endereço HTTPS exato de teste, sem barra final. Habilite a exposição das variáveis de sistema da Vercel `VERCEL` e `VERCEL_ENV`.
3. Gere uma chave de 32 bytes em hexadecimal, um código de convite aleatório com ao menos 32 bytes e senhas longas e diferentes para Jennifer e Rodrigo. Use SHA-256 hexadecimal do convite e valores `salt_hex:hash_scrypt_hex` para as contas. O script `server/contratacao/privacy.mjs` exporta `passwordHash(password, salt)`, com sal aleatório de 16 bytes em hexadecimal. Use o gerenciador de segredos para transferir os valores.
4. Substitua as credenciais anteriormente expostas na Clicksign. Cadastre o webhook de sandbox no endereço da função, com acesso HTTPS para a Clicksign, e cadastre o segredo HMAC e um novo token de sandbox nas variáveis privadas. Se a proteção do preview responder antes da função, providencie um endereço de preview para receber o webhook com HMAC sem abrir o restante do preview a participantes sem convite. Use uma caixa de e-mail controlada pela equipe. Confirme o host de download com uma assinatura fictícia e inclua apenas o host oficial observado em `CLICKSIGN_SANDBOX_FILE_HOSTS`, se necessário.
5. Teste primeiro a assinatura hospedada. Em seguida, habilite o widget no preview e teste o fluxo em desktop e celular. Confira se a assinatura chega por webhook, se o PDF assinado abre e se os dados são visíveis apenas à sessão autorizada e aos operadores. Desabilite a configuração ao fim do ciclo de teste, revogue as sessões e remova as amostras conforme a política do sandbox. Programe a limpeza de sessões expiradas, janelas antigas de limite e pedidos de teste, incluindo os envelopes e as cópias de backup conforme a retenção acordada.

## Verificação e pendências

`npm ci && npm test` executa quatro testes automatizados com PostgreSQL embutido e transporte Clicksign simulado. Cobrem isolamento de ambiente, integridade e criptografia, triagem condicional, acesso concorrente, hash da minuta, assinatura hospedada, contrato de requisição do widget, falha intermediária, webhook inválido/repetido/fora de ordem, download privado, Pix, cartão e ações administrativas.

O build local da Vercel em modo Preview passou e empacotou a home, a página de contratação e a função Node.js 24. A auditoria npm das dependências de execução retornou zero vulnerabilidades conhecidas.

A integração real depende de novas credenciais, banco de preview, configuração do endpoint de webhook e teste ao vivo com uma caixa autorizada. Valide o payload real de webhook, o host do PDF assinado, a liberação das notificações e o widget na conta antes de dar o aceite da integração. Use dados fictícios durante toda essa validação.

Para uso real, faltam a minuta-base e os anexos aprovados, os dados da empresa e do representante, a política de privacidade e retenção, preços definitivos, regras consulares por circunscrição, login e recuperação de conta para clientes, gateway de pagamento e autorização expressa para publicação. A implementação deste PR permanece restrita à simulação e ao sandbox.
