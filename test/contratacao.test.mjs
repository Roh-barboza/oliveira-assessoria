import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import endpoint from '../api/contratacao.mjs';
import { runtime } from '../server/contratacao/app.mjs';
import { services, testClient } from '../server/contratacao/catalog.mjs';
import { clicksign } from '../server/contratacao/clicksign.mjs';
import { digest, encryption } from '../server/contratacao/privacy.mjs';
import { adminPassword, invite, secret, testHarness, token } from './harness.mjs';

const origin = 'http://127.0.0.1:3000';
const env = { CONTRACTS_SANDBOX: '1', CONTRACTS_LOCAL: '1', CONTRACTS_ORIGIN: origin, CLICKSIGN_ENV: 'sandbox' };
const pdfBytes = Buffer.from('%PDF-1.7\nArquivo fictício');
const goodDraft = (id = randomUUID(), serviceId = 'aire') => ({
  id, serviceId, client: testClient, consulate: 'São Paulo', adult: 'yes', acknowledged: true,
  answers: Object.fromEntries(services[serviceId].questions.map(([key]) => [key, 'yes']))
});

function fakeTransport() {
  const ids = Object.fromEntries(['envelope','document','signer','agree','evidence'].map(key => [key, randomUUID()]));
  const calls = [];
  let state = 'running';
  let failed;
  let signed = true;
  let fileHost = 'clicksign-content-sandbox.s3.amazonaws.com';
  const fetcher = async (address, options) => {
    const url = new URL(address);
    const { method, body, headers } = options;
    const data = body && JSON.parse(body).data;
    calls.push({ method, path: url.pathname, data, headers, hostname: url.hostname });
    if (url.hostname === fileHost) return new Response(pdfBytes);
    assert.equal(url.hostname, 'sandbox.clicksign.com');
    assert.equal(headers.Authorization, token);
    assert.equal(options.redirect, 'error');
    const path = url.pathname;
    const item = (kind, attributes = {}) => Response.json({ data: { id: ids[kind], attributes } });
    if (failed && path.endsWith(failed)) return new Response(null, { status: 502 });
    if (method === 'GET' && path.endsWith('/events')) {
      return Response.json({ data: signed ? [{ attributes: { name: 'sign' } }] : [] });
    }
    if (method === 'GET' && path.endsWith('/documents')) {
      return Response.json({ data: [{ id: ids.document, attributes: { status: state }, links: { files: { signed: `https://${fileHost}/fixture.pdf` } } }] });
    }
    if (method === 'GET' || method === 'PATCH') return item('envelope', { status: state });
    if (path.endsWith('/envelopes')) return item('envelope');
    if (path.endsWith('/documents')) return item('document');
    if (path.endsWith('/signers')) return item('signer');
    if (path.endsWith('/requirements')) return item(data.attributes.action === 'agree' ? 'agree' : 'evidence');
    if (path.endsWith('/notifications')) return new Response(null, { status: 204 });
    assert.fail(`Unexpected provider route ${method} ${path}`);
  };
  return { ids, calls, fetcher, setState: value => { state = value; }, fail: value => { failed = value; }, signed: value => { signed = value; }, fileHost: value => { fileHost = value; } };
}

function http(app) {
  return (op, options = {}) => {
    const { cookie, body, raw, signature, id, kind, originHeader = origin } = options;
    const hasBody = raw !== undefined || body !== undefined;
    const url = new URL('/api/contratacao', origin);
    for (const [key, value] of Object.entries({ op, id, kind })) if (value) url.searchParams.set(key, value);
    const headers = new Headers({ origin: originHeader });
    if (cookie) headers.set('cookie', cookie);
    if (signature) headers.set('content-hmac', signature);
    if (hasBody) headers.set('content-type', 'application/json');
    return app(new Request(url, { method: hasBody ? 'POST' : 'GET', headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) }));
  };
}

async function login(call, role = 'tester') {
  const response = await call('login', { body: { role, password: role === 'tester' ? invite : adminPassword } });
  assert.equal(response.status, 200);
  const header = response.headers.get('set-cookie');
  assert.match(header, /HttpOnly; SameSite=Strict/);
  return header.split(';')[0];
}

test('o ambiente só habilita localhost ou preview e bloqueia produção mesmo com as flags ligadas', () => {
  assert.equal(typeof endpoint.fetch, 'function');
  assert.equal(runtime(env).local, true);
  assert.equal(runtime({ ...env, VERCEL: '1', VERCEL_ENV: 'production' }), null);
  assert.equal(runtime({ ...env, VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'production' }), null);
  assert.equal(runtime({ ...env, CLICKSIGN_ENV: 'production' }), null);
  assert.throws(() => runtime({ ...env, CONTRACTS_ORIGIN: 'http://example.test' }));
  assert.equal(runtime({ ...env, VERCEL: '1', VERCEL_ENV: 'preview', CONTRACTS_ORIGIN: 'https://preview.example.test' }).local, false);
});

test('PDF e dados privados autenticam o contexto e detectam alterações', () => {
  const crypto = encryption('12'.repeat(32));
  const sealed = crypto.seal(pdfBytes, 'contrato-a:pdf');
  assert.deepEqual(crypto.open(sealed, 'contrato-a:pdf'), pdfBytes);
  assert.throws(() => crypto.open(sealed, 'contrato-b:pdf'));
  sealed[sealed.length - 1] ^= 1;
  assert.throws(() => crypto.open(sealed, 'contrato-a:pdf'));
});

test('fluxo HTTP: triagem, PDF, autorização, idempotência, Clicksign v3, webhook, Pix/cartão e painel', async t => {
  const transport = fakeTransport();
  const provider = clicksign({ CLICKSIGN_ACCESS_TOKEN: token, CLICKSIGN_WEBHOOK_SECRET: secret,
    CLICKSIGN_TEST_EMAIL: 'sandbox@example.test', CLICKSIGN_EMBEDDED_SANDBOX: '1' }, transport.fetcher);
  const { database, pool, app } = await testHarness(origin, provider);
  t.after(() => database.close());
  const call = http(app);
  const owner = await login(call);
  const other = await login(call);
  const jennifer = await login(call, 'jennifer');
  const rodrigo = await login(call, 'rodrigo');

  assert.equal((await call('draft', { body: goodDraft() })).status, 401);
  assert.equal((await call('draft', { cookie: owner, originHeader: 'https://unrelated.example.test', body: goodDraft() })).status, 403);
  assert.equal((await call('draft', { cookie: owner, body: { ...goodDraft(), client: { ...testClient, email: 'outro@example.test' } } })).status, 422);

  const triage = { ...goodDraft(randomUUID(), 'renovacao'), adult: 'no', consulate: 'Brasília' };
  const reviewRow = await (await call('draft', { cookie: owner, body: triage })).json();
  assert.equal(reviewRow.status, 'triagem');
  assert.equal(reviewRow.reasons.length, 2);
  assert.equal((await call('pdf', { cookie: owner, id: triage.id })).status, 404);
  assert.equal((await call('review', { cookie: owner, body: { id: triage.id } })).status, 403);
  assert.equal((await (await call('review', { cookie: rodrigo, body: { id: triage.id } })).json()).reviewed, true);

  const input = goodDraft(randomUUID(), 'passaporte');
  const id = input.id;
  const drafts = await Promise.all([0, 1].map(() => call('draft', { cookie: owner, body: input })));
  const [first, duplicate] = await Promise.all(drafts.map(response => response.json()));
  assert.equal(first.status, 'rascunho');
  assert.equal(first.draftHash, duplicate.draftHash);
  assert.equal(first.amountCents, 44900);
  assert.match(first.sections.flat().join(' '), /R\$\s449,00/);
  assert.equal((await call('draft', { cookie: owner, body: { ...input, adult: 'no' } })).status, 409);
  assert.equal((await call('status', { cookie: other, id })).status, 404);
  assert.equal((await call('pdf', { cookie: other, id })).status, 404);
  const draftResponse = await call('pdf', { cookie: owner, id });
  const downloadable = Buffer.from(await draftResponse.arrayBuffer());
  assert.match(draftResponse.headers.get('content-disposition'), /^attachment/);
  assert.equal(draftResponse.headers.get('cache-control'), 'no-store');
  assert.equal(digest(downloadable), first.draftHash);
  assert.equal((await PDFDocument.load(downloadable)).getPageCount(), 1);
  const { rows: [stored] } = await pool.query('SELECT draft_pdf, private_data FROM contratacao.contracts WHERE id=$1', [id]);
  assert.ok(!Buffer.from(stored.draft_pdf).includes(Buffer.from('%PDF')));
  assert.ok(!Buffer.from(stored.private_data).includes(Buffer.from(testClient.name)));

  const submission = { id, hash: first.draftHash, confirmed: true, mode: 'email' };
  assert.equal((await call('submit', { cookie: owner, body: { ...submission, hash: '0'.repeat(64) } })).status, 409);
  const submissions = await Promise.all([0, 1].map(() => call('submit', { cookie: owner, body: submission })));
  assert.ok(submissions.every(response => response.status === 200));
  assert.deepEqual(transport.calls.map(call => [call.method, call.path.split('/').at(-1)]), [
    ['POST', 'envelopes'], ['POST', 'documents'], ['POST', 'signers'], ['POST', 'requirements'],
    ['POST', 'requirements'], ['PATCH', transport.ids.envelope], ['POST', 'notifications']
  ]);
  assert.equal(transport.calls[2].data.attributes.email, 'sandbox@example.test');
  assert.equal(transport.calls[2].data.attributes.has_documentation, false);
  assert.equal(transport.calls[4].data.attributes.auth, 'email');
  assert.equal(transport.calls[4].data.relationships.document.data.id, transport.ids.document);
  assert.equal(digest(Buffer.from(transport.calls[1].data.attributes.content_base64.split(',')[1], 'base64')), first.draftHash);

  assert.equal((await call('payment', { cookie: owner, body: { id, method: 'pix' } })).status, 409);
  const event = (name, occurred_at = '2026-11-17T15:00:00Z') => JSON.stringify({
    event: { name, occurred_at }, document: { key: transport.ids.document }
  });
  const signedEvent = raw => call('webhook', { raw, signature: `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}` });
  assert.equal((await call('webhook', { raw: event('auto_close'), signature: `sha256=${'0'.repeat(64)}` })).status, 401);
  assert.equal((await signedEvent(event('sign'))).status, 200);
  assert.equal((await (await call('status', { cookie: owner, id })).json()).status, 'aguardando_assinatura');
  transport.setState('closed');
  transport.signed(false);
  assert.equal((await signedEvent(event('close'))).status, 503);
  transport.signed(true);
  transport.fileHost('files-unapproved.example.test');
  assert.equal((await signedEvent(event('auto_close'))).status, 503);
  assert.ok(!transport.calls.some(call => call.hostname === 'files-unapproved.example.test'));
  transport.fileHost('clicksign-content-sandbox.s3.amazonaws.com');
  assert.equal((await signedEvent(event('auto_close'))).status, 200);
  assert.equal((await signedEvent(event('auto_close'))).status, 200);
  assert.equal((await signedEvent(event('cancel', '2026-11-17T14:00:00Z'))).status, 200);
  assert.equal((await call('pdf', { cookie: other, id, kind: 'signed' })).status, 404);
  const signed = await call('pdf', { cookie: owner, id, kind: 'signed' });
  assert.deepEqual(Buffer.from(await signed.arrayBuffer()), pdfBytes);
  assert.equal((await call('payment', { cookie: owner, body: { id, method: 'invalid' } })).status, 422);
  for (const method of ['pix', 'cartao']) {
    const payment = await (await call('payment', { cookie: owner, body: { id, method } })).json();
    assert.equal(payment.paymentMethod, method);
    assert.equal(payment.paymentStatus, 'simulacao');
  }
  assert.equal((await call('service', { cookie: jennifer, body: { id, status: 'finalizado' } })).status, 409);
  await call('service', { cookie: jennifer, body: { id, status: 'em_atendimento' } });
  await call('service', { cookie: rodrigo, body: { id, status: 'finalizado' } });
  const admin = await (await call('status', { cookie: jennifer, id })).json();
  assert.equal(admin.serviceStatus, 'finalizado');
  assert.equal(admin.audit.filter(item => item.action === 'assinado').length, 1);
  assert.ok(admin.audit.some(item => item.actor.startsWith('rodrigo:')));
  assert.equal((await (await call('list', { cookie: other })).json()).rows.length, 0);
  assert.equal((await (await call('list', { cookie: jennifer })).json()).rows.length, 2);
  await call('logout', { cookie: owner, body: {} });
  assert.equal((await call('status', { cookie: owner, id })).status, 401);
});

test('falha ambígua conserva os IDs e não cria um segundo envelope; widget é do titular', async t => {
  const transport = fakeTransport();
  const provider = clicksign({ CLICKSIGN_ACCESS_TOKEN: token, CLICKSIGN_WEBHOOK_SECRET: secret,
    CLICKSIGN_TEST_EMAIL: 'sandbox@example.test', CLICKSIGN_EMBEDDED_SANDBOX: '1' }, transport.fetcher);
  const { database, app } = await testHarness(origin, provider);
  t.after(() => database.close());
  const call = http(app);
  const owner = await login(call);
  const admin = await login(call, 'jennifer');
  const input = goodDraft(randomUUID(), 'inscricao');
  const row = await (await call('draft', { cookie: owner, body: input })).json();
  transport.fail('/notifications');
  const submission = { id: row.id, hash: row.draftHash, confirmed: true, mode: 'email' };
  assert.equal((await (await call('submit', { cookie: owner, body: submission })).json()).status, 'reconciliar');
  await call('submit', { cookie: owner, body: submission });
  assert.equal(transport.calls.filter(call => call.path.endsWith('/envelopes') && call.method === 'POST').length, 1);
  const info = await (await call('status', { cookie: admin, id: row.id })).json();
  assert.equal(info.envelopeId, transport.ids.envelope);
  assert.equal(info.providerStep, 'notificar_signatario');

  const embeddedTransport = fakeTransport();
  const widgetProvider = clicksign({ CLICKSIGN_ACCESS_TOKEN: token, CLICKSIGN_WEBHOOK_SECRET: secret,
    CLICKSIGN_TEST_EMAIL: 'sandbox@example.test', CLICKSIGN_EMBEDDED_SANDBOX: '1' }, embeddedTransport.fetcher);
  const widgetTest = await testHarness(origin, widgetProvider);
  t.after(() => widgetTest.database.close());
  const widgetCall = http(widgetTest.app);
  const tester = await login(widgetCall);
  const reviewer = await login(widgetCall, 'rodrigo');
  const widgetRow = await (await widgetCall('draft', { cookie: tester, body: goodDraft() })).json();
  const widget = await (await widgetCall('submit', { cookie: tester, body: {
    id: widgetRow.id, hash: widgetRow.draftHash, confirmed: true, mode: 'embedded'
  } })).json();
  assert.equal(widget.status, 'aguardando_assinatura');
  assert.equal(widget.widgetSigner, embeddedTransport.ids.signer);
  assert.equal(embeddedTransport.calls[4].data.attributes.auth, 'embedded_signature');
  assert.ok(!embeddedTransport.calls.some(call => call.path.endsWith('/notifications')));
  assert.equal((await (await widgetCall('status', { cookie: reviewer, id: widget.id })).json()).widgetSigner, undefined);
});
