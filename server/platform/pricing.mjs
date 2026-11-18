import { error } from './catalog.mjs';
const present = v => v !== null && v !== undefined && v !== '';
export function number(v, { percent = false, integer = false } = {}) {
  if (!present(v)) return null;
  if (!['string','number'].includes(typeof v) || !/^\d+(?:[.,]\d{1,4})?$/.test(String(v))) throw error(422, 'Informe um número positivo ou zero apurado.');
  const n = Number(String(v).replace(',','.'));
  if (!Number.isFinite(n) || n < 0 || n > (percent ? 100 : 1000000) || (integer && !Number.isInteger(n))) throw error(422, 'Número fora do intervalo.');
  return n;
}
const cents = n => Math.round((n + Number.EPSILON) * 100);
export function calculate(input) {
  const allowed = ['costMode','operating','hours','hourRate','partner','otherVariable','taxPercent','gatewayPercent','gatewayFixed','price','targetMargin','installments','financePercent','officialFees','externalClientPaid'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) throw error(422,'Campo de cálculo desconhecido.');
  if (input.costMode && !['direct','hours'].includes(input.costMode)) throw error(422,'Escolha custo direto ou por horas.');
  const p = Object.fromEntries(allowed.filter(k => k !== 'costMode').map(k => [k, number(input[k], { percent: /Percent|Margin/.test(k), integer: k === 'installments' })]));
  if (input.costMode === 'hours' && present(input.operating)) throw error(422,'Não duplique custo direto e custo por horas.');
  if (input.costMode === 'direct' && (present(input.hours) || present(input.hourRate))) throw error(422,'No modo direto, limpe horas e custo-hora.');
  const operating = input.costMode === 'direct' ? p.operating : input.costMode === 'hours' && p.hours !== null && p.hourRate !== null ? p.hours * p.hourRate : null;
  const missing = ['partner','otherVariable','taxPercent','gatewayPercent','gatewayFixed'].filter(k => p[k] === null);
  if (operating === null) missing.push('operationalCost');
  const complete = missing.length === 0;
  const variableBase = complete ? cents(operating) + cents(p.partner) + cents(p.otherVariable) + cents(p.gatewayFixed) : null;
  const price = p.price === null ? null : cents(p.price);
  const contribution = complete && price !== null ? price - variableBase - Math.round(price * (p.taxPercent + p.gatewayPercent) / 100) : null;
  const denominator = complete && p.targetMargin !== null ? 1 - (p.taxPercent + p.gatewayPercent + p.targetMargin) / 100 : null;
  if (denominator !== null && denominator <= 0) throw error(422,'Margem e percentuais não permitem calcular um preço.');
  if (p.installments !== null && (p.installments < 1 || p.installments > 12)) throw error(422,'Use de 1 a 12 parcelas no simulador.');
  const installmentTotal = price !== null && p.installments !== null && p.financePercent !== null ? Math.round(price * (1 + p.financePercent / 100)) : null;
  const installments = installmentTotal === null ? null : Array.from({ length: p.installments }, (_, i) => Math.floor(installmentTotal / p.installments) + (i < installmentTotal % p.installments ? 1 : 0));
  return { complete, missing, operatingCents: operating === null ? null : cents(operating), variableBaseCents: variableBase,
    priceCents: price, contributionCents: contribution, contributionPercent: contribution !== null && price > 0 ? contribution / price * 100 : null,
    suggestedPriceCents: denominator !== null ? Math.ceil(variableBase / denominator) : null, installmentsCents: installments,
    officialFeesCents: p.officialFees === null ? null : cents(p.officialFees), externalClientPaidCents: p.externalClientPaid === null ? null : cents(p.externalClientPaid),
    note: 'Simulação interna. Taxas oficiais/despesas pagas pelo cliente ficam fora da margem. Rateio fixo não deve ser lançado novamente como custo variável. Acréscimo de parcelamento informado é total, não taxa de provedor ou CET.' };
}
