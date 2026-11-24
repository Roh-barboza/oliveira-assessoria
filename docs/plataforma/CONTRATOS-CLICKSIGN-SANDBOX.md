# Oliveira Assessoria | Contratos digitais e Clicksign

Estado: implementação de **homologação no Preview**, sem contratação real.

## Fluxo implementado

1. O administrador autenticado abre a solicitação de teste no painel e seleciona **Preparar contrato fictício**.
2. A primeira utilização habilita, com confirmação explícita, as tabelas `oliveira_operational_contracts` e `oliveira_operational_contract_events` no PostgreSQL conectado. Nenhum cadastro nem tabela preexistente é apagado.
3. **Gerar minuta fictícia** produz PDF com carimbo de Sandbox, sem dados pessoais, valores ou cláusulas jurídicas. O arquivo é criptografado por AES-GCM e identificado por SHA-256.
4. O administrador baixa o PDF, confere e aprova. Os estados persistidos evitam aprovações repetidas.
5. O envio só é autorizado no Preview, por administrador autenticado, com confirmação adicional, flags e credenciais da **Clicksign Sandbox**, e somente ao e-mail de teste previamente autorizado. A interface distingue configuração da credencial de autenticação efetivamente confirmada. Antes de cada envio, o servidor consulta a API da Clicksign em modo somente leitura e bloqueia a operação em caso de 401, 403, falha de rede ou token não validado, mantendo a minuta aprovada sem criar envelope.
6. A aplicação cria o envelope, anexa o PDF, adiciona signatário, requisitos, ativa o envelope e, depois da ativação, solicita explicitamente a notificação por e-mail. O ID de cada etapa é registrado antes da seguinte.
7. Após o convite, **Consultar assinatura** verifica o estado na API. Quando o provedor comprova conclusão e disponibiliza o PDF assinado, ele é salvo criptografado e pode ser baixado pelo administrador.
8. Se ocorrer falha durante envio, o contrato passa a `manual_review`. Não existe reenvio automático que poderia duplicar envelopes.

## Restrições

- O contrato-base **jurídico definitivo ainda não foi fornecido nem aprovado**. Portanto o PDF de teste não contém condições comerciais, documentos pessoais nem obrigações. Nunca converter uma minuta fictícia em contratação real.
- Não há integração automática com o cadastro de clientes reais, pagamentos, Pix/cartões ou arquivos privados de clientes.
- O fluxo de retorno usa consulta autenticada à Clicksign, não acredita em webhooks sem validação. A integração de webhooks para produção exige payload real documentado, proteção contra replay e tratamento de duplicidade.
- A Clicksign informa que a API de notificação de signatários requer liberação da conta; podem ocorrer respostas 503/422 no Sandbox se indisponível.
- Os IDs e etapas externas ficam em Neon; status final é confirmado por consulta. As chaves de dados devem permanecer sob gestão de segredos e backup/restauração.

## Conectar a conta Sandbox

No portal privado da Vercel, projeto `oliveira-assessoria`, variáveis de ambiente de **Preview na branch `feature/plataforma-operacional-preview`**:

| Variável | Valor / instrução |
|---|---|
| `CLICKSIGN_TEST_EMAIL` | Destinatário já autorizado: `rodrigo.barboza1994@gmail.com` |
| `CLICKSIGN_ACCESS_TOKEN` | Token real gerado dentro de https://sandbox.clicksign.com/settings/api (consulte o endereço em sua conta; nunca mande o token por chat ou GitHub) |
| `CLICKSIGN_WEBHOOK_SECRET` | Não necessário para o teste com consulta autenticada; reservado para futura integração de webhooks, apenas após validar a assinatura real do provedor |
| `CLICKSIGN_SANDBOX_EXPLICIT_TEST` | `1` somente após configurar e validar Sandbox; manter em `0` até lá |
| `CLICKSIGN_SANDBOX_EMAIL_EXPLICIT_TEST` | `1` somente ao autorizar o envio do convite fictício; manter em `0` até lá |

Após alterar variáveis, criar um novo deployment **Preview** da branch. Nunca cadastrar as chaves na produção ou expor valores em logs, código, documentos ou e-mails.

### Critérios de aceite do envio externo

- [ ] Token e e-mail de API associados na conta Sandbox, com resposta `authenticated` na opção **Verificar conexão**
- [ ] Acesso à API de notificação liberado para a conta
- [ ] Configuração sensível na Vercel restrita ao Preview
- [ ] Convite de teste efetivamente entregue e aberto pelo destinatário
- [ ] PDF assinado de teste consultado e baixado pelo painel
- [ ] Envelopes de teste removidos/concluídos conforme retenção do provedor

### Antes de contratos válidos

- [ ] Modelos jurídicos aprovados por serviço, incluindo escopo, exclusões, pagamentos e dados exigidos
- [ ] Informação contratual revisada por responsáveis e clientes de teste
- [ ] LGPD, armazenamento, retenção e auditoria operacional aprovados
- [ ] Integração real Clicksign isolada do Sandbox, com autenticação e webhooks próprios
- [ ] Backup real do Neon restaurado e verificado
- [ ] Governança de envio, responsáveis, notificações e cancelamentos definida

**Resultado técnico:** os testes automatizados comprovam comportamento do software com rede simulada. Eles não substituem uma assinatura Sandbox efetiva.

Referências oficiais: https://developers.clicksign.com/docs/guia-de-criacao-o-passo-a-passo-padrao ; https://developers.clicksign.com/reference/api-notificar-signatario ; https://developers.clicksign.com/docs/access-token
