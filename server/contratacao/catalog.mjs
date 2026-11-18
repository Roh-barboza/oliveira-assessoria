export const catalogVersion = 'sandbox-2026-11-v1';
export const templateVersion = 'minuta-sandbox-v1';

export const testClient = Object.freeze({
  name: 'Maria Cliente Exemplo',
  email: 'maria@exemplo.test',
  cpf: '000.000.000-00',
  address: 'Rua Exemplo, 100, São Paulo - SP'
});

const citizenship = ['citizenship', 'A cidadania italiana já foi reconhecida?'];
const activeAire = ['activeAire', 'A inscrição no AIRE está ativa?'];
const currentAire = ['currentAire', 'O cadastro consular está atualizado na circunscrição atual?'];

export const services = Object.freeze({
  aire: {
    name: 'Atualização de endereço AIRE', cents: 17900,
    scope: 'Conferência do cadastro e dos comprovantes de residência, preparação da solicitação e orientação no FAST IT.',
    questions: [citizenship, activeAire, ['addressProof', 'Tem comprovante de residência recente na circunscrição?']],
    review: { citizenship: 'Confirmação da cidadania', activeAire: 'Verificação da inscrição AIRE', addressProof: 'Análise do comprovante de residência' }
  },
  inscricao: {
    name: 'Primeira inscrição no AIRE', cents: 24900,
    scope: 'Organização da documentação para primeira inscrição, conferência da circunscrição e orientação sobre solicitação e acompanhamento no FAST IT.',
    questions: [citizenship, ['neverRegistered', 'Confirma que ainda não está inscrito no AIRE?'], ['addressProof', 'Tem comprovante de residência recente na circunscrição?']],
    review: { citizenship: 'Confirmação da cidadania', neverRegistered: 'Verificação de cadastro anterior', addressProof: 'Análise do comprovante de residência' }
  },
  passaporte: {
    name: 'Passaporte italiano · Primeira emissão', cents: 44900,
    scope: 'Conferência documental para a primeira emissão e orientação sobre o procedimento e o canal oficial de agendamento.',
    questions: [citizenship, currentAire, ['firstPassport', 'Confirma que nunca teve passaporte italiano?']],
    review: { citizenship: 'Confirmação da cidadania', currentAire: 'Regularidade do cadastro consular', firstPassport: 'Identificação da modalidade de passaporte' }
  },
  renovacao: {
    name: 'Passaporte italiano · Renovação', cents: 39900,
    scope: 'Conferência da documentação para renovação, do passaporte anterior e orientação sobre o procedimento e o canal oficial de agendamento.',
    questions: [citizenship, currentAire, ['hasOldPassport', 'Está com o passaporte anterior em mãos?']],
    review: { citizenship: 'Confirmação da cidadania', currentAire: 'Regularidade do cadastro consular', hasOldPassport: 'Análise do passaporte anterior, perda ou extravio' }
  }
});

export const consulates = ['São Paulo', 'Brasília', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Recife', 'Rio de Janeiro', 'Outro / a confirmar'];
export const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const error = (status, message) => Object.assign(new Error(message), { status });

export function validateDraft(body) {
  const { serviceId, consulate, adult, answers, client, acknowledged } = body;
  const service = typeof serviceId === 'string' && Object.hasOwn(services, serviceId) ? services[serviceId] : null;
  if (!service || !consulates.includes(consulate) || !['yes', 'no', 'unknown'].includes(adult) || acknowledged !== true) {
    throw error(422, 'Revise o serviço, a circunscrição, a idade e o aceite do ambiente de testes.');
  }
  if (!client || Object.keys(testClient).some(key => client[key] !== testClient[key])) {
    throw error(422, 'Use a identidade fictícia preenchida pelo ambiente de testes.');
  }
  if (!answers || service.questions.some(([key]) => !['yes', 'no', 'unknown'].includes(answers[key]))) {
    throw error(422, 'Responda às perguntas de triagem.');
  }
  const selected = Object.fromEntries(service.questions.map(([key]) => [key, answers[key]]));
  const reasons = Object.entries(selected).filter(([, value]) => value !== 'yes').map(([key]) => service.review[key]);
  if (adult !== 'yes') reasons.push('Análise de idade e representação');
  if (consulate !== 'São Paulo') reasons.push('Confirmação de circunscrição e requisitos locais');
  return { serviceId, consulate, adult, answers: selected, client: testClient, reasons };
}

export function contractText(id, data) {
  const service = services[data.serviceId];
  return [
    ['Identificação', `Referência ${id}\nContratante de teste: ${data.client.name} · CPF ${data.client.cpf}\n${data.client.email} · ${data.client.address}\nPrestadora de teste: Oliveira Assessoria\nCircunscrição informada: ${data.consulate}`],
    ['Objeto da minuta', `Assessoria administrativa para ${service.name}. O anexo abaixo descreve o escopo.`],
    ['Valor ilustrativo', `${money(service.cents)} pela assessoria. Taxas consulares, certidões, traduções, apostilas e postagem ficam fora desse valor.`],
    ['Anexo de serviço', service.scope],
    ['Limites da assessoria', 'A assessoria não garante vaga, agendamento, prazo, emissão ou deferimento. Nesta simulação não há atendimento contratado, cobrança ou obrigação entre as partes.'],
    ['Controle de versão', `Texto ${templateVersion} · Catálogo ${catalogVersion}`]
  ];
}
