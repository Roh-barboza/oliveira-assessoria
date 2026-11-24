# Matriz consolidada da entrega

Seleção operacional não equivale a aprovação comercial. O registro histórico `docs/etapa-2-final/MATRIZ-CONSOLIDADA.json` permanece preservado (12 pendentes, quatro candidatos, zero aprovados).

| Serviço | Seleção atual | Execução / revisão no piloto | Implementação de teste | Liberação real |
|---|---|---|---|---|
| Passaporte italiano | Piloto: primeira emissão adulta / renovação adulta | Jennifer / Rodrigo | Formulário, caso, checklist, PDF por modalidade, janelas 180/60 dias | Pendente: escopo final, preços, minutas e permissões |
| AIRE | Piloto: inscrição / atualizações | Jennifer / Rodrigo | Dossiê, pendências, 30 dias e marco pós-protocolo de 180 dias | Pendente; Registro Civil separado |
| FAST IT | Piloto avulso | Rodrigo / Jennifer | Pergunta de dificuldade, roteiro, revisão invertida e janela de sete dias | Pendente; sessão 60min/retorno 30min sem cronômetro |
| Regularização consular | Piloto de diagnóstico | Jennifer / Rodrigo | Mapa factual, tarefas e janela de 15 dias | Pendente; sem parecer jurídico ou execução ilimitada |
| Organização documental | Piloto: básico / intermediário / completo | Jennifer / Rodrigo | Escopos diferenciados, pasta lógica cifrada, revisões, 30 dias e lote externo de 60 dias no completo | Pendente; pedidos externos exigem autorização e permissão |
| Registro de filhos | Adiado | A confirmar para expansão | Ficha preservada, indisponível no formulário do piloto | Não liberado |
| Imposto de Renda | Adiado | Habilitação/responsável a validar | Página e formulário anterior preservados; sem contratação na plataforma | Não liberado |
| Estado civil | Expansão futura | A confirmar | Ficha preservada; separado de AIRE/FAST IT | Não liberado |
| Certidões italianas | Expansão futura | A confirmar | Ficha preservada; não liberada como oferta independente | Não liberado |
| Carta d’identità | Expansão futura | A confirmar | Ficha preservada | Não liberado |
| INSS e benefícios | Escopo em análise | A confirmar / parceiro quando necessário | Categoria preservada, sem oferta definida | Não liberado |
| Processos administrativos | Escopo em análise | A confirmar / profissional quando necessário | Categoria preservada, sem oferta definida | Não liberado |
| Passaporte brasileiro | Candidato prioritário | A confirmar, PF/consulado e região | Material histórico preservado, sem página comercial nova ou fluxo de compra | Não aprovado |
| Negociação de Dívidas | Candidato | A confirmar / validação específica | Fora das ofertas comerciais | Não aprovado |
| Precatórios | Candidato | A confirmar / habilitado | Fora das ofertas comerciais | Não aprovado |
| Contratos | Candidato como serviço independente | A confirmar / habilitado | Fora das ofertas comerciais; minutas de teste próprias não constituem oferta jurídica | Não aprovado |

Cobertura inicial dos cinco: São Paulo. Confirmar sede competente, procedimento, titularidade, permissões de terceiros e exceções a cada caso; não inferir abrangência nacional ou de todos os consulados.

## Estado técnico sem confundir simulação com integração

| Área | Estado | Dependência residual |
|---|---|---|
| Catálogo premium, busca, filtros e fichas | Implementado; regressão pública passou | Revisão final comercial |
| Formulário autenticado e retomada | Implementado no teste | Identidade real/convites/MFA fora do demo |
| RBAC, casos, responsáveis, histórico, tarefas | Implementado no teste | Escala, observabilidade e gestão de identidades reais |
| Documentos e dupla revisão | Funcional com fixture, SQLite cifrado; ACL no servidor | G3 real, canal durável externo e política LGPD |
| Persistência externa | Adaptadores implementados e testados com SQL local/rede simulada | Segredo protegido e conexão autorizada; Preview temporário |
| Drive empresarial | Adaptador parcial de provisionamento/metadados testado com mock | Conta, permissões individuais e transporte de arquivos; não conectado ao painel |
| Preços e modalidades | Calculadora funcional com 20 linhas; todos os valores inicialmente vazios | Custos/preços reais e aprovação; nenhuma oferta liberada |
| Minutas e assinatura | PDF por modalidade e simulador interno funcionais | Jurídico, dados empresariais, credencial nova e teste Clicksign real |
| Pagamentos | Simulador PIX/cartão/idempotência funcional | Escolha do provedor, sandbox real, webhooks e conciliação externa |
| Follow-up | Motor local com opt-in, deduplicação, pausa/encerramento, tarefas e resposta humana | IA generativa não conectada, sem cron/scheduler externo |
| WhatsApp | Regras de janela/template/revisão testadas; nenhum transporte ativo | Número empresarial, provedor e autorização de mensagens |
| SEO | Metadados, canonical, Open Graph, WebPage, robots/sitemap preparados; noindex preservado | Domínio final e autorização de indexação |
| Lançamento | Checklist e recuperação local implementados | Aprovação expressa, segurança/operadores/provedores reais |
