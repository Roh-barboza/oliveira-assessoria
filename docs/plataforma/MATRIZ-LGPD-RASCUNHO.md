# Oliveira Assessoria | Matriz operacional de proteção de dados (rascunho)

**Estado: NÃO APROVADO.** Esta matriz é uma ferramenta interna de revisão.
Não é política de privacidade publicada, parecer jurídico, contrato com operador,
base legal concluída ou autorização para receber documentos de clientes.

## Inventário e finalidade

| Categoria | Finalidade pretendida | Controle técnico já previsto | Validação que ainda falta |
|---|---|---|---|
| Equipe: nome, e-mail, hash da senha, segredo MFA | Identificação, autenticação, suporte e revogação | PostgreSQL com MFA, segredos cifrados, sessão revogável, rate limit, convites temporários | Autorizar novos colaboradores, revisão de acesso periódica, recuperação de conta e responsáveis |
| Atendimento: título, serviço, notas, etapas | Acompanhamento de solicitação | Payload AES-GCM, papéis, isolamento de caso, histórico recente cifrado | Minimização e política de classificação/retificação/exclusão |
| Arquivos: PDF, PNG, JPEG | Conferência documental condicionada ao serviço | Esquema privado preparado, acesso por caso, conteúdo cifrado, verificação de malware obrigatória | Selecionar e homologar scanner, revisão jurídica/LGPD, consentimentos/avisos adequados, backup e descarte |
| Formulário público de leads | Receber solicitações espontâneas | Testes de contrato de payload e erro com resposta simulada | Comprovar rota real n8n/Cloudfy, operadores/suboperadores e consentimento/transparência |
| Logs de segurança | Detectar acessos e incidentes | Registro limitado e sem senhas, códigos ou conteúdo de documentos | Retenção, imutabilidade, acesso e resposta a incidentes |

## Regras mínimas a validar

1. Definir pessoa jurídica controladora, responsáveis e canais para titulares. Não presumir dados cadastrais não informados.
2. Mapear bases legais **por finalidade** e estabelecer os avisos exigidos antes de coletar documentos. Consentimento não é automaticamente a única base cabível.
3. Formalizar contratos e garantias com Vercel, Neon, eventual fornecedor de scanner, n8n/Cloudfy e demais operadores de dados, inclusive transferência internacional quando aplicável.
4. Definir prazo/critério de retenção por tipo de documento e registro, hipóteses de guarda obrigatória, devolução/descarte e expurgo também dos backups.
5. Restringir acessos por função e caso, exigir MFA da equipe, revisar permissões regularmente e registrar a origem de pedidos de acesso ou correção.
6. Implantar backup independente criptografado, testar restauração isolada e manter chave de backup separada da chave dos atendimentos.
7. Criar procedimento de incidentes com responsáveis, evidências, avaliação de risco, comunicação à autoridade/titulares quando exigível e eventual suspensão de uploads.
8. Aplicar proteção reforçada para dados sensíveis ou de crianças e adolescentes, caso algum serviço os exija; não aceitar esses casos automaticamente.
9. Validar os textos e processos com o responsável jurídico e o responsável pelo tratamento antes de qualquer operação real.

## Bloqueios configurados

- A documentação pública e a tela do painel alertam para **não inserir dados reais** durante a homologação.
- Os endpoints de anexos exigem banco dedicado e flag explícita; o adaptador de scanner real **não está conectado** na Vercel e o upload falha de forma fechada.
- O convite de funcionários depende de migração e variável própria, sem envio automático de token por e-mail ou WhatsApp.
- Clicksign, pagamentos e automações reais seguem fora do escopo de liberação.

**Aprovação pendente**: representante do negócio, jurídico/LGPD, responsável técnico e responsável pela infraestrutura, com data e evidências de testes. Nunca marcar como aprovado apenas porque um teste automatizado passou.
