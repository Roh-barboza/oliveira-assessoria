import pricing from '../../docs/etapa-3-preparacao/MODELO-PRECIFICACAO.json' with { type: 'json' };
import matrix from '../../docs/etapa-2-final/MATRIZ-CONSOLIDADA.json' with { type: 'json' };
export const error = (status, message) => Object.assign(Error(message), { status });
export const testClient = { name: 'Cliente Demonstração', email: 'cliente@example.invalid' };
export const accepted = ['IT-01', 'IT-02', 'IT-03', 'IT-08', 'BR-04'];
export const catalog = accepted.map(id => {
  const s = matrix.servicos.find(x => x.id === id);
  const p = s.proposta_revisao_final;
  const variants = pricing.linhas.filter(x => x.servico_id === id).map(x => ({ id: x.id_modelo, name: x.modalidade.replace(' — hipótese',''),
    revisions: p?.revisoes, period: x.proposta_acompanhamento || p?.acompanhamento, scope: p?.atividades || s.atividades_propostas,
    deliveries: p?.entregas || s.entregas_propostas, exclusions: s.atividades_excluidas, external: s.despesas_externas }));
  if(id==='BR-04')for(const v of variants){
    v.scope=v.id==='documental-basico'?['Inventário dos itens apresentados, classificação e conferência de legibilidade e dados aparentes; índice e lista de lacunas.']:v.id==='documental-intermediario'?['Inventário, digitalização dos itens aceitos, classificação e preparação de pasta/dossiê para a finalidade definida.']:['Preparação de dossiê e controle de solicitações externas permitidas, expressamente autorizadas; coordenação de prestadores quando discriminada.'];
    v.deliveries=v.id==='documental-basico'?['Índice dos itens e checklist de lacunas, sem pedidos externos.']:v.id==='documental-intermediario'?['Pasta digital estruturada, índice e checklist, sem execução automática de pedidos externos.']:['Pasta digital, índice, histórico de pedidos permitidos e despesas discriminadas.'];
  }
  return { id, name: s.nome, variants, status: 'orçamento; liberação comercial pendente', days: id === 'IT-03' ? 7 : id === 'IT-08' ? 15 : 30 };
});
export const pricingSeed = () => pricing.linhas.map(x => ({ id: x.id_modelo, serviceId: x.servico_id, name: x.nome_servico,
  modality: x.modalidade, costs: {}, approved: false, version: 1 }));
export function serviceFor(id, variant) {
  const s = catalog.find(x => x.id === id); if (!s) throw error(422, 'Serviço adiado ou candidato; fora do piloto inicial.');
  const v = s.variants.find(x => x.id === variant); if (!v) throw error(422, 'Modalidade inválida.'); return { service: s, variant: v };
}
export const fixture = Buffer.from('OLIVEIRA_TEST_DOCUMENT\nDocumento sintetico da plataforma Oliveira. Sem dados pessoais reais.\n', 'utf8');
export function cleanText(value, max = 400) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw error(422, 'Texto inválido ou acima do limite.');
  return value.trim();
}
export function validateAnswers(input, { partial = false } = {}) {
  const permitted = ['region','consulate','citizenship','cadastre','updateType','purpose','items','additional','difficulty','adult'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !permitted.includes(k))) throw error(422, 'Campos não permitidos. Nunca envie credenciais ou dados de portais.');
  const result = {};
  for (const [k,v] of Object.entries(input)) result[k] = cleanText(v, k === 'items' ? 800 : 250);
  if (!partial && !result.region) throw error(422, 'Informe a localidade.');
  return result;
}
