# Oliveira Assessoria | Pendências operacionais e execução | 24/11/2026

## Escopo aprovado nesta intervenção

A pedido do responsável, priorizar o painel operacional independente da Clicksign.
As alterações permanecem exclusivamente em `feature/plataforma-operacional-preview`
no projeto Vercel `oliveira-assessoria`. **Não há merge, produção nem envio real.**

## Situação verificada

O relatório de homologação de 23/11/2026 registra integração real com o banco Neon,
administrador com MFA ativo e smoke test de escrita em tabelas temporárias com ROLLBACK.
Isso **não** equivale a backup/restauração independente ou autorização para
receber documentos de clientes.

## Correções implementadas neste conjunto de commits

- **Histórico de etapas:** criação e alterações de status são registradas em
  `recentEvents` dentro do payload criptografado AES-GCM do próprio atendimento.
  A gravação acompanha o bloqueio por versão (compare-and-swap) em uma única
  atualização PostgreSQL, sem alteração de esquema nem dados legados. O painel
  mostra o histórico recente. O limite é de 100 eventos por caso e o contador
  `previousEvents` indica eventos antigos que saíram da janela. **Não é auditoria
  imutável independente, trilha jurídica ou substituto de backup.**
- **Contas da equipe:** administrador autenticado pode consultar contas sem
  hashes/senhas e revogar acessos de operadores e revisores. A API rejeita
  operadores, requisições sem sessão, origens de terceiros e desativação de
  administradores. A conta desativada deixa de autenticar inclusive quando um
  token de sessão anterior ainda é apresentado.
- **Interface:** cartão de gestão da equipe e histórico de etapas sem novos
  dados sensíveis ou comunicação com terceiros.
- **Testes:** cobertura ampliada para trilha criptografada, concorrência e
  revogação de sessões, permissões da API e fluxo sintético de navegador.
- **Auditoria de prontidão:** `npm run check:go-live` passou a inspecionar a
  aplicação operacional real em vez de usar a presença intencional do
  simulador como único critério. Exige, deliberadamente, evidências externas e
  permanece **bloqueado** para publicação real.

## Bloqueios que não podem ser resolvidos apenas alterando código

| Frente | Evidência e decisão necessárias | Estado |
|---|---|---|
| Backup Neon | Dump independente cifrado fora do provedor, cofre autorizado, ensaio de restauração com chave, RPO/RTO e retenção | **Não homologado** |
| Documentos reais | Canal/arquivo privado com antivírus/validação, segregação de acesso, LGPD, retenção e descarte aprovados, teste completo de download | **Não ativado** |
| Usuários novos | Convite de equipe restrito, recuperação de senha/MFA, rotação de chaves, revogação e encerramento com processo documentado | **Parcial** |
| Serviços | Revisão jurídica, comprovação de competência e liberação dos cinco escopos escolhidos | **Não aprovado** |
| Valores | Custos/hora, preços e condições assinados pelos responsáveis | **Não aprovado** |
| n8n / Cloudfy | Teste real e autorizado de recebimento/rastreio de leads | **Só teste simulado** |
| Pagamentos / WhatsApp / IA | Provedores, opt-in, auditoria e homologação externa, somente quando necessários | **Posteriores** |
| Domínio e go-live | Revisão de domínio, SEO, contingência, release e aceite expresso | **Não autorizado** |
| Clicksign | Etapa expressamente adiada; nenhum envio de assinatura ou convite | **Pausada** |

## Ordem segura de continuidade

1. Homologar **backup e recuperação** do banco Neon sem circular segredos em chat.
2. Obter aceite de segurança documental/LGPD e implantar **fluxo real de arquivos**.
3. Concluir convites e recuperação de contas com MFA.
4. Validar condições e preços dos **cinco serviços iniciais**.
5. Verificar o webhook real e só então deliberar sobre publicação.
6. Tratar pagamentos, WhatsApp, IA e Clicksign separadamente quando autorizados.

## Segurança de liberação

**READY na Vercel e CI verde comprovam compilação e testes, não
go-live com dados pessoais.** Continuam proibidos novos dados reais
na demonstração, pagamentos, convites eletrônicos e disparos automáticos.
Os vínculos de Preview devem continuar protegidos. Não executar scripts
de restauração contra bancos que contenham registros reais.
