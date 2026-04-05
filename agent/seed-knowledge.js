/**
 * seed-knowledge.js
 * Insere a base jurídica no Postgres com embeddings Gemini
 * 
 * Uso:
 * npm install pg @google/generative-ai dotenv
 * node seed-knowledge.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env.PG_HOST     || 'chaoticcow-postgres.cloudfy.live',
  port:     parseInt(process.env.PG_PORT || '8277'),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'ltKPcRzBdQuFZXrTwBZQ',
  database: process.env.PG_DB       || 'oliveira_db',
  ssl:      false,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// ─── BASE DE CONHECIMENTO ─────────────────────────────────────────────────────

const artigos = [
  {
    area: 'divida',
    titulo: 'Prescrição de Dívidas no Brasil — Prazos por Tipo',
    fonte: 'Código Civil Art. 205 e 206; Lei 8.078/90 (CDC)',
    tags: ['prescricao', 'divida', 'prazo', 'codigo-civil', 'negativacao'],
    conteudo: `## Resumo
Prescrição é a perda do direito do credor de cobrar judicialmente uma dívida após determinado prazo. No Brasil, o prazo geral é de 10 anos (Art. 205 CC), mas a maioria das dívidas cotidianas prescreve em 3 ou 5 anos. Após a prescrição, a dívida ainda existe, mas não pode mais ser executada judicialmente.

## Base Legal

- Art. 205 do Código Civil — prazo geral de 10 anos
- Art. 206, §5º, I do CC — dívidas em instrumento público/particular: 5 anos
- Art. 206, §3º, IV do CC — enriquecimento sem causa: 3 anos
- Súmula 233 do STJ — contratos bancários e prazo prescricional

## Tabela de prazos por tipo de dívida

- Banco (crédito, empréstimo, cheque especial): 5 anos
- Cartão de crédito: 5 anos
- Telefone / Planos: 5 anos
- Aluguel: 3 anos
- Condomínio: 5 anos
- Mensalidade escolar: 5 anos
- Honorários profissionais: 5 anos
- Reparação civil (dano moral, material): 3 anos
- Dívida sem documento escrito: 10 anos

## Procedimento passo a passo

1. Identificar a data exata do vencimento ou do primeiro inadimplemento
1. Contar o prazo prescricional a partir dessa data
1. Verificar se houve interrupção da prescrição (notificação judicial, reconhecimento da dívida)
1. Se prescrita, o devedor pode recusar o pagamento e exigir exclusão de negativação
1. Contestar judicialmente (JEC) ou extrajudicialmente qualquer cobrança de dívida prescrita

## Documentos necessários

- Contrato original ou comprovante da dívida com data de vencimento
- Extrato bancário ou fatura com data do primeiro inadimplemento
- Histórico de contato do credor (cartas, e-mails, mensagens)
- Comprovante de negativação (Serasa/SPC) com data de inclusão

## Prazos importantes

- O prazo começa a contar da data do vencimento da obrigação
- Negativação no Serasa/SPC: máximo 5 anos independente da prescrição (Lei 8.078/90, Art. 43, §1º)
- Interrupção da prescrição: recomeça do zero se o devedor reconhecer a dívida por escrito

## Armadilhas comuns

- Negociar dívida prescrita reinicia a prescrição: qualquer reconhecimento oral ou escrito interrompe o prazo
- Prescrição ≠ dívida extinta: credor pode negativar novamente se dentro do prazo de 5 anos
- Confundir data da dívida com data da negativação
- Parcelamento parcial interrompe a prescrição

## O que o cliente deve saber

A prescrição é uma defesa, não um direito automático — precisa ser arguida. O processo pode ser resolvido extrajudicialmente com uma simples notificação ao credor. Custo estimado: consulta jurídica R$ 150–500. Tempo de resolução extrajudicial: 30–90 dias.`
  },
  {
    area: 'divida',
    titulo: 'Direitos do Devedor — Proteção Contra Cobrança Abusiva',
    fonte: 'CDC Art. 42, Lei 8.078/90; Código Civil; STJ Tema 929',
    tags: ['devedor', 'cobranca-abusiva', 'assedio', 'negativacao-indevida', 'dano-moral', 'CDC'],
    conteudo: `## Resumo
O devedor inadimplente possui direitos expressamente protegidos pelo Código de Defesa do Consumidor, especialmente contra práticas vexatórias, ameaças ou cobrança em horários abusivos. A cobrança de valor indevido gera direito à devolução em dobro do que foi pago. Negativação indevida configura dano moral presumido (in re ipsa).

## Base Legal

- CDC Art. 42 — vedação de constrangimento na cobrança de dívida
- CDC Art. 43 — direito de acesso a cadastros e correção de dados
- CDC Art. 71 — cobrança com ameaça, coação, afirmação falsa — crime
- Código Civil Art. 186 e 927 — responsabilidade civil por ato ilícito
- STJ Tema 929 — repetição do indébito em dobro no CDC

## O que o credor NÃO pode fazer

- Ligar antes das 8h ou após as 20h, fins de semana e feriados
- Contatar o devedor no local de trabalho causando constrangimento
- Ameaçar, intimidar ou usar linguagem vexatória
- Comunicar a terceiros (vizinhos, família) sobre a dívida
- Incluir em cadastro de inadimplentes sem notificação prévia
- Cobrar dívida prescrita sob ameaça de processo judicial

## Procedimento passo a passo

1. Documentar toda cobrança abusiva (prints, gravações, registros)
1. Registrar BO em caso de ameaça ou constrangimento grave
1. Enviar notificação extrajudicial à empresa exigindo cessação
1. Protocolar reclamação no Procon ou consumidor.gov.br
1. Ajuizar ação de dano moral no JEC
1. Em caso de negativação indevida: solicitar tutela antecipada para retirada

## Documentos necessários

- Prints/capturas de tela de mensagens abusivas com data e hora
- Gravação ou registro de ligações
- Extrato de negativação (Serasa, SPC) com data
- Comprovante de que a dívida não existe, está paga ou prescrita

## Prazos importantes

- Prazo para ação de dano moral por cobrança abusiva: 3 anos
- Negativação no cadastro de inadimplentes: máximo 5 anos
- Resposta do Procon/consumidor.gov.br: geralmente 5–15 dias úteis

## Armadilhas comuns

- Não documentar: sem prova, não há indenização
- Dano moral não é automático em todas as situações
- Valor da indenização varia: tribunais fixam entre R$ 1.000 e R$ 10.000 para casos comuns

## O que o cliente deve saber

O processo no JEC é gratuito até 20 salários mínimos. Ações de dano moral costumam ser resolvidas em 6–18 meses. A empresa pode propor acordo antes da audiência, frequentemente entre R$ 800 e R$ 3.000.`
  },
  {
    area: 'divida',
    titulo: 'Como Negociar Dívidas — Estratégia, Serasa e Desenrola Brasil',
    fonte: 'Lei 14.690/2023 (Desenrola); serasa.com.br; desenrola.gov.br; CDC',
    tags: ['negociacao', 'divida', 'serasa', 'desenrola', 'acordo-extrajudicial', 'desconto'],
    conteudo: `## Resumo
Negociar dívidas exige estratégia: conhecer o valor real da dívida, o tipo de credor e usar as plataformas disponíveis (Serasa Limpa Nome, Desenrola Brasil) para obter os melhores descontos. O Feirão Limpa Nome 2026 oferece descontos de até 99% em dívidas selecionadas.

## Base Legal

- Lei 14.690/2023 — Programa Desenrola Brasil
- CDC Art. 52 — concessão de crédito ao consumidor
- Código Civil Art. 840 a 850 — transação (acordo extrajudicial)

## Percentuais mínimos de proposta por tipo de credor

- Banco (crédito pessoal/cartão antigo >2 anos): 20–30% do total
- Financeira/crédito consignado: 40–50%
- Telefonia/internet: 30–50%
- Varejo (Renner, C&A, Lojas): 20–40%
- Aluguel/imobiliária: 60–80%
- Concessionárias (água, luz): 80–100%

## Procedimento passo a passo

1. Levantar todas as dívidas: Serasa.com.br, SPC Brasil ou Registrato do Banco Central
1. Classificar por tipo, valor e antiguidade
1. Verificar se a dívida está no Serasa Limpa Nome ou Desenrola Brasil
1. Para dívidas no Serasa: negociar via app com Pix ou parcelamento
1. Para dívidas fora das plataformas: contato direto com proposta por escrito
1. Obter acordo escrito, numerado e assinado antes de pagar qualquer valor
1. Guardar comprovante de quitação e solicitar carta de quitação formal
1. Monitorar exclusão do cadastro (Serasa atualiza em até 5 dias úteis)

## Documentos necessários

- CPF do devedor
- Extrato da dívida atualizado
- Comprovante de renda (para negociações com desconto por hipossuficiência)
- Conta bancária para Pix

## Prazos importantes

- Feirão Serasa Limpa Nome 2026: 23 de fevereiro a 26 de março de 2026
- Exclusão de negativação após acordo: até 5 dias úteis

## Armadilhas comuns

- Pagar sem ter acordo escrito
- Aceitar parcelamento sem calcular CET
- Não verificar se dívida é prescrita antes de negociar
- Priorizar dívidas pelo valor, não pelo impacto

## O que o cliente deve saber

Negociações via Serasa Limpa Nome têm descontos maiores do que ligando direto. Não há custo para negociar. O score Serasa melhora em dias após a quitação.`
  },
  {
    area: 'divida',
    titulo: 'Dívidas Bancárias — Juros Abusivos, CET e Portabilidade',
    fonte: 'Resolução CMN 3.517/2007; Lei 10.820/2003; CDC; Banco Central do Brasil',
    tags: ['banco', 'juros-abusivos', 'CET', 'cartao-de-credito', 'cheque-especial', 'portabilidade'],
    conteudo: `## Resumo
Dívidas bancárias possuem regras específicas de proteção ao consumidor. O Custo Efetivo Total (CET) é obrigatório em todos os contratos de crédito. Juros acima dos praticados pelo mercado podem ser revisados judicialmente.

## Base Legal

- Resolução CMN 3.517/2007 — obrigatoriedade do CET
- CDC Art. 6º, V — revisão contratual por onerosidade excessiva
- STJ Súmula 530 — abusividade de juros bancários
- Circular Bacen 3.291/2005 — portabilidade de crédito

## Taxas médias de mercado (referência Banco Central)

- Cartão de crédito rotativo: ~15–17% a.m.
- Cheque especial: ~8–10% a.m.
- Empréstimo pessoal (banco): ~3–5% a.m.
- Crédito consignado: ~1,5–2,5% a.m.

## Procedimento passo a passo

1. Solicitar ao banco o contrato original + demonstrativo de evolução da dívida
1. Calcular ou solicitar o CET
1. Comparar com as taxas médias do Banco Central (bcb.gov.br)
1. Se identificar abusividade (>2x a taxa média): enviar carta de contestação
1. Em caso de negativa: SAC → Ouvidoria → Banco Central
1. Se necessário: ação revisional de contrato na Vara Cível ou JEC
1. Para portabilidade: solicitar proposta em outro banco

## Documentos necessários

- Contrato de crédito original assinado
- Extratos completos da conta (mínimo 12 meses)
- Demonstrativo de evolução da dívida
- Comparativo de taxas do Bacen

## Prazos importantes

- Banco Central deve responder reclamação: 10 dias úteis
- Portabilidade de crédito: banco de origem tem 1 dia útil para liberar
- Ação revisional: prazo prescricional de 5 anos

## Armadilhas comuns

- Pagar apenas o mínimo do cartão: capitalização do rotativo gera dívida exponencial
- Cheque especial como recurso permanente: ~200% ao ano`
  },
  {
    area: 'precatorio',
    titulo: 'Cessão de Crédito em Precatórios — Deságio e Riscos',
    fonte: 'Código Civil Art. 286; Resolução CNJ 458/2022',
    tags: ['precatorio', 'cessao-de-credito', 'desagio', 'venda-de-precatorio', 'investimento'],
    conteudo: `## Resumo
Cessão de crédito é a venda de um precatório (dívida judicial do governo) para um terceiro, geralmente com um desconto chamado deságio. É uma forma de antecipar o recebimento de valores que podem levar anos para serem pagos.

## Base Legal

- Código Civil Art. 286 — cessão de crédito
- Resolução CNJ 458/2022 — regulamentação dos precatórios

## Deságio médio por tipo de precatório

- Federal (União): 15–30%
- Estadual (SP, MG, RJ, RS): 25–45%
- Estadual (demais estados): 40–65%
- Municipal (capital): 30–50%
- Municipal (interior): 50–75%

## Procedimento passo a passo

1. Obter avaliação do precatório (3–5 empresas compradoras para comparar)
1. Verificar regularidade do precatório no portal do tribunal + CNJ
1. Negociar o deságio e condições de pagamento
1. Assinar contrato de cessão de crédito (reconhecido em cartório)
1. Comunicar formalmente a cessão ao tribunal de origem
1. Comunicar à entidade devedora
1. Aguardar homologação pelo tribunal (15–60 dias)
1. Receber o valor acordado após homologação

## Documentos necessários

- Documento de identidade e CPF do cedente
- Cópia do precatório e publicação no Diário Oficial
- Certidão de trânsito em julgado da sentença
- Certidão negativa de débitos do cedente
- Contrato de cessão de crédito reconhecido em cartório

## Prazos importantes

- Homologação pelo tribunal: 15 a 60 dias
- Pagamento ao cedente: geralmente 5–15 dias após homologação

## Armadilhas comuns

- Vender para empresa não especializada: verificar registro, CNPJ, referências
- Não comparar propostas: diferença de 5–10 pontos percentuais pode ser significativa
- Vender com dívidas fiscais pendentes: Fazenda pode compensar o precatório
- Não comunicar formalmente ao tribunal

## O que o cliente deve saber

A cessão é a única forma de receber rapidamente, mas implica perda de parte do crédito. Para precatórios de valor alto (acima de R$ 100.000), o deságio é negociável. A empresa compradora assume o risco do não-pagamento pelo ente.`
  },
  {
    area: 'precatorio',
    titulo: 'Precatórios Federais, Estaduais e Municipais — Como Consultar e Cobrar',
    fonte: 'CNJ precatorio.cnj.jus.br; STN tesouro.fazenda.gov.br; TJ estaduais',
    tags: ['precatorio', 'federal', 'estadual', 'municipal', 'consulta', 'CNJ', 'atraso'],
    conteudo: `## Resumo
Precatórios variam significativamente no prazo de pagamento conforme o ente devedor: a União é a mais regular, enquanto estados e municípios acumulam dívidas históricas.

## Base Legal

- CF/88, Art. 100 — regime unificado de precatórios
- EC 99/2017 — parcelamento para Estados e Municípios
- Resolução CNJ 303/2019 e 458/2022

## Diferenças por esfera

Federal (União): pagamento regular, prazo médio 1–3 anos, deságio 15–30%.
Estadual: variável (SP e MG melhores), prazo 3–8 anos, deságio 25–50%.
Municipal: muito variável, prazo 5–15 anos, deságio 40–75%.

## Portais de consulta

- Todos os entes: precatorio.cnj.jus.br
- União: tesouro.fazenda.gov.br → precatórios
- São Paulo (Estado): fazenda.sp.gov.br
- Demais tribunais estaduais: TJ do estado de origem

## Procedimento passo a passo

1. Acessar precatorio.cnj.jus.br e buscar pelo número do processo ou CPF/CNPJ
1. Verificar o status: inscrito, aguardando orçamento, incluído no orçamento, pago
1. Confirmar posição na fila e previsão de pagamento
1. Se constar como pago mas não recebido: verificar dados bancários no tribunal
1. Se em atraso: peticionar no processo solicitando informações

## Armadilhas comuns

- Não acompanhar a fila: reclassificações podem alterar a ordem de pagamento
- Dados bancários desatualizados: valor devolvido + nova espera
- Não peticionar em caso de atraso

## O que o cliente deve saber

O portal do CNJ é a fonte mais completa e atualizada. Municípios pequenos frequentemente têm precatórios em atraso de décadas. Nesse caso, a cessão de crédito pode ser a única saída prática.`
  },
  {
    area: 'imposto_renda',
    titulo: 'Declaração de IR 2026 — Obrigatoriedade, Prazo e Deduções',
    fonte: 'Receita Federal — gov.br/receitafederal; RIR/2018',
    tags: ['imposto-de-renda', 'IRPF', 'declaracao', 'obrigatoriedade', 'deducao', 'Receita-Federal'],
    conteudo: `## Resumo
A Declaração de Imposto de Renda de Pessoa Física (IRPF) 2026 refere-se aos rendimentos recebidos em 2025 e deve ser entregue entre março e maio de 2026. O limite de obrigatoriedade subiu para R$ 35.584,00 em rendimentos tributáveis anuais.

## Base Legal

- Lei 9.250/1995 — IRPF
- Decreto 9.580/2018 — Regulamento do Imposto de Renda
- Instrução Normativa RFB 2.255/2025 — regras para IRPF 2026

## Quem é obrigado a declarar IRPF 2026

- Rendimentos tributáveis acima de R$ 35.584,00
- Rendimentos isentos acima de R$ 200.000,00
- Receita bruta atividade rural acima de R$ 177.920,00
- Bens e direitos (patrimônio) acima de R$ 800.000,00
- Operações em bolsa acima de R$ 40.000,00 em vendas
- Ganho de capital na venda de bens (qualquer valor)
- Passou a ser residente no Brasil em 2025

## Deduções permitidas (modelo completo)

- Dependentes: R$ 2.275,08 por dependente por ano
- Saúde: sem limite (médico, dentista, hospital, plano de saúde)
- Educação: até R$ 3.561,50 por pessoa
- Previdência privada PGBL: até 12% da renda bruta tributável
- Contribuição ao INSS: valor pago integral
- Pensão alimentícia: valor integral (com decisão judicial)

## Procedimento passo a passo

1. Baixar o programa IRPF 2026 ou acessar via e-CAC
1. Reunir todos os informes de rendimentos
1. Preencher ficha de rendimentos tributáveis, isentos e exclusivos
1. Incluir deduções
1. Comparar resultado com modelo simplificado (20%, limite R$ 16.754,34)
1. Escolher o modelo mais vantajoso
1. Transmitir a declaração e salvar o recibo de entrega (DREC)
1. Guardar todos os documentos por 5 anos

## Documentos necessários

- Informe de rendimentos do empregador (DIRF)
- Informe de rendimentos do INSS
- Informe de rendimentos bancários e de investimentos
- Recibos de despesas médicas com CPF do prestador
- Comprovantes de despesas educacionais

## Prazos importantes

- Entrega: março a maio de 2026
- Multa por atraso: mínimo R$ 165,74 ou 1% ao mês sobre imposto devido
- Guarda de documentos: 5 anos

## Armadilhas comuns

- Perder o prazo de entrega: multa automática
- Não guardar recibos de saúde com CPF do prestador
- Deduzir despesas sem comprovante

## O que o cliente deve saber

Declaração pode ser feita gratuitamente no site da Receita Federal. Declaração com erros pode ser corrigida com declaração retificadora. Serviços de declaração cobram entre R$ 150 e R$ 500.`
  },
  {
    area: 'imposto_renda',
    titulo: 'Malha Fina — Como Cair, Como Sair e Declaração Retificadora',
    fonte: 'Receita Federal; Lei 9.250/1995; RIR 2018',
    tags: ['malha-fina', 'IRPF', 'retificadora', 'Receita-Federal', 'pendencia', 'fiscalizacao'],
    conteudo: `## Resumo
Malha fina é o processo de revisão da declaração pela Receita Federal quando há inconsistências entre os dados informados e os dados dos sistemas fiscais. Pode resultar em imposto a pagar, multa ou restituição menor. A maioria dos casos tem solução com declaração retificadora.

## Base Legal

- Lei 9.250/1995 — IRPF
- Decreto 9.580/2018 (RIR)
- Instrução Normativa RFB 1.300/2012 — malha fiscal

## Principais motivos para cair na malha fina

- Despesas médicas não comprovadas ou com CPF errado do prestador
- Rendimentos omitidos (aluguel, trabalho autônomo, dividendos)
- Divergência entre o informe do empregador e o que foi declarado
- Dedução de pensão alimentícia sem homologação judicial
- Dependente declarado em duas declarações diferentes
- Rendimentos de aplicações financeiras não declarados

## Como consultar situação na Receita Federal

1. Acessar e-CAC (gov.br/receitafederal → Meu Imposto de Renda)
1. Clicar em “Pendências de Malha”
1. Verificar o motivo da retenção
1. Baixar o extrato da declaração com as inconsistências

## Procedimento passo a passo para sair da malha fina

1. Identificar o motivo exato da inconsistência (e-CAC)
1. Reunir documentação que comprove o que foi declarado
1. Se o erro foi do contribuinte: fazer declaração retificadora
1. Transmitir a declaração retificadora pelo programa IRPF
1. Se o erro foi de terceiros (empregador, banco): exigir informe corrigido
1. Se houver imposto a pagar: recolher com DARF e juros
1. Aguardar a Receita processar e sair da malha (geralmente 30–60 dias após retificação)

## Declaração retificadora

- Usa o mesmo programa do IRPF original
- Selecionar “Retificadora” e informar o recibo da declaração original
- Pode ser feita até 5 anos após o prazo original
- Após intimação: prazo de 30 dias para regularizar sem autuação

## Documentos necessários

- Informe de rendimentos do empregador corrigido
- Recibos de despesas médicas com CPF do prestador
- Comprovante de pagamento de pensão alimentícia com decisão judicial
- Extratos de aplicações financeiras do banco

## Prazos importantes

- Malha fina: Receita pode reter por até 5 anos
- Após intimação: 30 dias para regularizar
- Prescrição tributária: 5 anos

## Armadilhas comuns

- Ignorar intimação da Receita: gera autuação com multa de 75% do imposto devido
- Fazer retificadora sem entender o motivo: pode piorar a situação
- Não guardar comprovantes por 5 anos

## O que o cliente deve saber

A maioria dos casos de malha fina é resolvida com retificadora sem multa adicional. Se houver autuação, multa mínima é 75% do imposto + juros Selic. Representação fiscal perante a Receita exige advogado tributarista.`
  },
  {
    area: 'imposto_renda',
    titulo: 'Restituição do IR — Como Verificar, Prioridades e Problemas',
    fonte: 'Receita Federal; Lei 9.250/1995',
    tags: ['restituicao', 'IRPF', 'Receita-Federal', 'lote', 'prioridade', 'imposto-de-renda'],
    conteudo: `## Resumo
A restituição do Imposto de Renda é devolvida ao contribuinte que pagou mais imposto do que devia no ano. O pagamento ocorre em lotes mensais de maio a dezembro, com prioridade para idosos, professores, pessoas com deficiência e quem entregou a declaração mais cedo.

## Base Legal

- Lei 9.250/1995, Art. 86 — restituição do IRPF
- Instrução Normativa RFB — calendário de restituição anual

## Ordem de prioridade nos lotes de restituição

1. Idosos acima de 80 anos
1. Idosos entre 60 e 79 anos
1. Pessoas com deficiência física, mental ou grave doença
1. Professores (magistério)
1. Contribuintes que entregaram a declaração mais cedo (ordem cronológica)

## Como verificar se tem restituição

1. Acessar Receita Federal (receita.fazenda.gov.br → “Minha Restituição”)
1. Ou baixar o app “Meu Imposto de Renda”
1. Informar CPF e data de nascimento
1. Verificar se há restituição, valor e lote previsto

## Procedimento passo a passo se a restituição não caiu

1. Verificar se a declaração está em malha fina (e-CAC)
1. Confirmar os dados bancários informados na declaração
1. Se conta foi encerrada: declaração retificadora informando nova conta
1. Se dados bancários corretos e sem malha: aguardar processamento
1. Se passou de 1 ano sem recebimento: contato com Receita via chat no e-CAC

## Documentos necessários

- CPF e data de nascimento
- Recibo da declaração (DREC)
- Dados bancários informados na declaração original

## Prazos importantes

- Restituições 2026 (declaração 2025): maio a dezembro de 2026
- 1º lote: geralmente maio (prioritários)
- Último lote: dezembro
- Correção pela Selic se não paga até 60 dias após o prazo

## Armadilhas comuns

- Informar dados bancários incorretos: restituição devolvida ao Tesouro
- Não atualizar conta bancária após encerramento
- Esperar restituição sem verificar se está em malha fina
- Não aproveitar prioridade: idosos e professores podem estar esquecendo de registrar

## O que o cliente deve saber

A restituição é corrigida pela taxa Selic se houver atraso. Não existe previsão exata de data para contribuintes fora dos grupos prioritários — apenas estimativa por lote. A Receita não envia e-mails pedindo dados bancários — isso é golpe.`
  },
];

// ─── FUNÇÕES ──────────────────────────────────────────────────────────────────

async function gerarEmbedding(texto) {
  const result = await embedModel.embedContent(texto);
  return result.embedding.values;
}

async function inserirArtigo(artigo) {
  const textoParaEmbedding = `${artigo.titulo}\n\n${artigo.conteudo}`;
  console.log(`  → Gerando embedding: ${artigo.titulo}`);
  const embedding = await gerarEmbedding(textoParaEmbedding);

  const query = `INSERT INTO conhecimento (area, titulo, conteudo, fonte, embedding, tags) VALUES ($1, $2, $3, $4, $5::vector, $6) ON CONFLICT DO NOTHING RETURNING id`;

  const values = [
    artigo.area,
    artigo.titulo,
    artigo.conteudo,
    artigo.fonte,
    JSON.stringify(embedding),
    artigo.tags,
  ];

  const result = await pool.query(query, values);
  if (result.rows.length > 0) {
    console.log(`  ✓ Inserido: ${artigo.titulo} (id: ${result.rows[0].id})`);
  } else {
    console.log(`  ⚠ Já existe: ${artigo.titulo}`);
  }
}

async function main() {
  console.log('🚀 Iniciando inserção da base jurídica…\n');

  try {
    await pool.query('SELECT 1');
    console.log('✓ Postgres conectado\n');
  } catch (err) {
    console.error('✗ Erro ao conectar no Postgres:', err.message);
    process.exit(1);
  }

  for (const artigo of artigos) {
    try {
      await inserirArtigo(artigo);
      // Pequena pausa para não estourar rate limit da Gemini API
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`✗ Erro em "${artigo.titulo}":`, err.message);
    }
  }

  console.log(`\n✅ Concluído! ${artigos.length} artigos processados.`);
  await pool.end();
}

main();
