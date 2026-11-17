import { error } from './catalog.mjs';

export const methods = ['pix', 'cartao'];

// A future gateway adapter must create a hosted checkout and verify provider events
// against the contract, amount, and currency before any payment can become paid.
export function sandboxPayment({ method, amountCents, currency }) {
  if (!methods.includes(method)) throw error(422, 'Selecione Pix ou cartão.');
  return { method, amountCents, currency, status: 'simulacao' };
}
