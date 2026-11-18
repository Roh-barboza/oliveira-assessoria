import { randomUUID } from 'node:crypto';
import { catalogVersion, consulates, contractText, error, services, templateVersion, testClient, validateDraft } from './catalog.mjs';
import { clicksign, readBytes } from './clicksign.mjs';
import { sandboxPayment } from './payment.mjs';
import { digest, encryption, equalHex, passwordHash, randomToken, uuid, validWebhook } from './privacy.mjs';
import { renderPdf } from './pdf.mjs';
import { audit, rate, transaction } from './store.mjs';

const sessionAge = 7 * 24 * 60 * 60;
const terminal = new Set(['assinado', 'cancelado']);
const nonFinalEvents = new Set(['sign', 'refusal']);
const webhookEvents = new Set(['sign', 'auto_close', 'close', 'deadline', 'cancel', 'refusal']);
const ops = {
  GET: new Set(['config', 'list', 'status', 'pdf']),
  POST: new Set(['login', 'logout', 'draft', 'submit', 'payment', 'sync', 'review', 'service', 'webhook'])
};
const adminOps = new Set(['sync', 'review', 'service']);

export const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
};

const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: { ...responseHeaders, ...headers } });

export function runtime(env) {
  if (env.CONTRACTS_SANDBOX !== '1' || env.CLICKSIGN_ENV !== 'sandbox') return null;
  const local = env.VERCEL !== '1' && !env.VERCEL_ENV && env.CONTRACTS_LOCAL === '1';
  const preview = env.VERCEL === '1' && env.VERCEL_ENV === 'preview'
    && (!env.VERCEL_TARGET_ENV || env.VERCEL_TARGET_ENV === 'preview');
  if (!preview && !local) return null;
  const url = new URL(env.CONTRACTS_ORIGIN);
  if (url.origin !== env.CONTRACTS_ORIGIN || url.username || url.password
      || (preview && url.protocol !== 'https:')
      || (local && (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('CONTRACTS_ORIGIN incompatível com o ambiente');
  }
  return { origin: url.origin, local, cookie: local ? 'oliveira_teste' : '__Host-oliveira_teste' };
}

export function createApp({ pool, env, settings, provider = clicksign(env) }) {
  const crypto = encryption(env.CONTRACT_ENCRYPTION_KEY);
  const isAdmin = actor => actor.role !== 'tester';
  const actorId = actor => `${actor.role}:${actor.actor}`;
  const cookie = (token, age) => `${settings.cookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${settings.local ? '' : '; Secure'}`;
  const providerError = () => error(503, 'A consulta à Clicksign sandbox está indisponível. Tente sincronizar novamente.');

  function sessionHash(request) {
    const token = (request.headers.get('cookie') ?? '').split(';').map(s => s.trim())
      .find(value => value.startsWith(`${settings.cookie}=`))?.slice(settings.cookie.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(token ?? '') ? digest(token) : null;
  }

  async function session(request) {
    const hash = sessionHash(request);
    if (!hash) return null;
    const { rows: [row] } = await pool.query('SELECT actor, role FROM contratacao.sessions WHERE token_hash=$1 AND expires_at > now()', [hash]);
    return row;
  }

  async function limit(scope, count, seconds) {
    if (!await rate(pool, scope, count, seconds)) throw error(429, 'Muitas tentativas. Aguarde antes de tentar novamente.');
  }

  async function login(request, body) {
    const { role, password } = body;
    if (!['tester', 'jennifer', 'rodrigo'].includes(role) || typeof password !== 'string' || password.length > 256) {
      throw error(401, 'Credenciais inválidas.');
    }
    const ip = settings.local ? 'local' : (request.headers.get('x-vercel-forwarded-for') ?? 'unknown').split(',').at(-1).trim();
    await limit(`login:${digest(ip)}`, 12, 900);
    await limit('login:global', 80, 900);
    let valid;
    if (role === 'tester') {
      valid = equalHex(digest(password), env.CONTRACT_TEST_INVITE_SHA256);
    } else {
      const stored = env[`CONTRACT_ADMIN_${role.toUpperCase()}_SCRYPT`] ?? '';
      const [salt, hash] = stored.split(':');
      valid = /^[0-9a-f]{32}$/.test(salt) && equalHex(await passwordHash(password, salt), hash);
    }
    if (!valid) throw error(401, 'Credenciais inválidas.');
    const token = randomToken();
    await transaction(pool, async db => {
      const previous = sessionHash(request);
      if (previous) await db.query('DELETE FROM contratacao.sessions WHERE token_hash=$1', [previous]);
      await db.query("INSERT INTO contratacao.sessions VALUES ($1, $2, $3, now() + interval '7 days')",
        [digest(token), randomUUID(), role]);
    });
    return json({ role }, 200, { 'Set-Cookie': cookie(token, sessionAge) });
  }

  async function owned(id, actor) {
    if (!uuid(id)) throw error(404, 'Pedido não encontrado.');
    const { rows: [row] } = await pool.query(`
      SELECT * FROM contratacao.contracts WHERE id=$1 AND ($2::boolean OR owner_id=$3)`,
    [id, isAdmin(actor), actor.actor]);
    if (!row) throw error(404, 'Pedido não encontrado.');
    return row;
  }

  function details(row, actor) {
    const data = JSON.parse(crypto.open(row.private_data, `${row.id}:dados`).toString());
    return {
      id: row.id, name: data.client.name, service: data.serviceName, consulate: data.consulate,
      status: row.status, serviceStatus: row.service_status, paymentStatus: row.payment_status, paymentMethod: row.payment_method,
      amountCents: row.amount_cents, currency: row.currency, reasons: row.triage_reasons,
      reviewed: Boolean(row.reviewed_at), updatedAt: row.updated_at, createdAt: row.created_at,
      draftHash: row.draft_hash, signedHash: row.signed_hash,
      ...(row.draft_hash && { sections: data.sections }),
      ...(row.status === 'aguardando_assinatura' && row.signature_mode === 'embedded' && row.owner_id === actor.actor
        && { widgetSigner: row.signer_id }),
      ...(isAdmin(actor) && { envelopeId: row.envelope_id, documentId: row.document_id, providerStep: row.provider_step,
        templateVersion: row.template_version, catalogVersion: row.catalog_version, answers: data.answers, adult: data.adult })
    };
  }

  async function draft(body, actor) {
    if (isAdmin(actor)) throw error(403, 'Use um convite de teste para criar um pedido.');
    if (!uuid(body.id)) throw error(422, 'Identificador de pedido inválido.');
    const data = validateDraft(body);
    const { id } = body;
    const fingerprint = digest(JSON.stringify(data));
    await limit(`draft:${actor.actor}`, 12, 3600);
    const date = new Date();
    const service = services[data.serviceId];
    const sections = data.reasons.length ? null : contractText(id, data);
    const pdf = sections ? await renderPdf(sections, date) : null;
    const snapshot = { ...data, serviceName: service.name, sections };
    return transaction(pool, async db => {
      const { rows: [inserted] } = await db.query(`
        INSERT INTO contratacao.contracts
          (id, owner_id, request_hash, service_id, catalog_version, template_version, amount_cents, private_data,
           draft_pdf, draft_hash, triage_reasons, status, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING RETURNING *`,
      [id, actor.actor, fingerprint, data.serviceId, catalogVersion, templateVersion, service.cents,
        crypto.seal(Buffer.from(JSON.stringify(snapshot)), `${id}:dados`), pdf && crypto.seal(pdf, `${id}:minuta`),
        pdf && digest(pdf), data.reasons, pdf ? 'rascunho' : 'triagem', date]);
      if (inserted) {
        await audit(db, id, actorId(actor), 'pedido_criado', inserted.status);
        return details(inserted, actor);
      }
      const { rows: [existing] } = await db.query('SELECT * FROM contratacao.contracts WHERE id=$1 AND owner_id=$2', [id, actor.actor]);
      if (!existing || existing.request_hash !== fingerprint) throw error(409, 'Identificador já utilizado. Crie um novo pedido.');
      return details(existing, actor);
    });
  }

  async function submit(row, body, actor) {
    if (row.owner_id !== actor.actor || isAdmin(actor)) throw error(403, 'A confirmação é exclusiva da sessão que criou o pedido.');
    const { hash, mode, confirmed } = body;
    if (confirmed !== true || !equalHex(hash, row.draft_hash)) throw error(409, 'Confira e confirme a versão exata do PDF.');
    if (row.status !== 'rascunho') return details(row, actor);
    if (row.template_version !== templateVersion || row.catalog_version !== catalogVersion) throw error(409, 'A minuta está desatualizada. Crie outro pedido.');
    if (!provider.available) throw error(503, 'A assinatura sandbox ainda não foi configurada.');
    if (!(mode === 'email' || (mode === 'embedded' && provider.embedded))) throw error(422, 'Modo de assinatura indisponível.');
    const pdf = crypto.open(row.draft_pdf, `${row.id}:minuta`);
    if (!equalHex(digest(pdf), hash)) throw error(409, 'A integridade da minuta precisa ser verificada.');
    await limit(`submit:${actor.actor}`, 6, 3600);
    await limit('submit:global', 30, 3600);
    const claimed = await transaction(pool, async db => {
      const { rows: [record] } = await db.query(`
        UPDATE contratacao.contracts SET status='preparando', signature_mode=$2, provider_step='confirmado', updated_at=now()
        WHERE id=$1 AND status='rascunho' AND draft_hash=$3 RETURNING *`, [row.id, mode, hash]);
      if (record) await audit(db, row.id, actorId(actor), 'minuta_confirmada', hash);
      return record;
    });
    if (!claimed) return details(await owned(row.id, actor), actor);

    async function checkpoint(step, ids = {}) {
      await transaction(pool, async db => {
        await db.query(`
          UPDATE contratacao.contracts SET provider_step=$2,
            envelope_id=COALESCE($3::uuid, envelope_id), document_id=COALESCE($4::uuid, document_id),
            signer_id=COALESCE($5::uuid, signer_id),
            status=CASE WHEN $2='enviado' AND status='preparando' THEN 'aguardando_assinatura' ELSE status END,
            updated_at=now() WHERE id=$1`,
        [row.id, step, ids.envelope ?? null, ids.document ?? null, ids.signer ?? null]);
        await audit(db, row.id, 'clicksign-sandbox', 'etapa_integracao', step);
      });
    }
    try {
      await provider.submit(claimed, pdf, checkpoint);
    } catch {
      await transaction(pool, async db => {
        await db.query("UPDATE contratacao.contracts SET status='reconciliar', updated_at=now() WHERE id=$1 AND status='preparando'", [row.id]);
        await audit(db, row.id, 'clicksign-sandbox', 'integracao_interrompida');
      });
    }
    return details(await owned(row.id, actor), actor);
  }

  async function reconcile(row, source, eventKey) {
    if (terminal.has(row.status) || !row.envelope_id) return !row.envelope_id ? false : true;
    if (eventKey && (await pool.query('SELECT 1 FROM contratacao.webhooks WHERE event_hash=$1', [eventKey])).rows.length) return true;
    let remote;
    try {
      remote = await provider.current(row);
    } catch {
      throw providerError();
    }
    if (eventKey && !remote.status) {
      // Sign and refusal notifications can arrive while the envelope is still open.
      if (!nonFinalEvents.has(source)) return false;
    }
    if (eventKey && remote.status === 'aguardando_assinatura' && !nonFinalEvents.has(source)) return false;
    await transaction(pool, async db => {
      const { rows: [locked] } = await db.query('SELECT status FROM contratacao.contracts WHERE id=$1 FOR UPDATE', [row.id]);
      if (terminal.has(locked.status)) return;
      if (eventKey) {
        const { rowCount } = await db.query('INSERT INTO contratacao.webhooks (event_hash, contract_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [eventKey, row.id]);
        if (!rowCount) return;
      }
      if (remote.status && locked.status !== remote.status) {
        await db.query(`UPDATE contratacao.contracts SET status=$2, signed_pdf=$3, signed_hash=$4, updated_at=now() WHERE id=$1`,
          [row.id, remote.status, remote.pdf ? crypto.seal(remote.pdf, `${row.id}:assinado`) : null, remote.pdf ? digest(remote.pdf) : null]);
        await audit(db, row.id, 'clicksign-sandbox', remote.status, eventKey ? source : 'sincronizacao_manual');
      } else if (eventKey) {
        await audit(db, row.id, 'clicksign-sandbox', 'webhook_recebido', source);
      }
    });
    return true;
  }

  async function readJson(request) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw error(415, 'Envie JSON.');
    const raw = await readBytes(request.body, 128 * 1024);
    let body;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      throw error(400, 'JSON inválido.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw error(400, 'JSON inválido.');
    return body;
  }

  async function webhook(request) {
    if (!provider.available || !env.CLICKSIGN_WEBHOOK_SECRET) throw error(503, 'Webhook sandbox indisponível.');
    const raw = await readBytes(request.body, 1024 * 1024);
    if (!validWebhook(raw, request.headers.get('content-hmac'), env.CLICKSIGN_WEBHOOK_SECRET)) throw error(401, 'Assinatura inválida.');
    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      throw error(400, 'JSON inválido.');
    }
    const name = payload?.event?.name;
    const id = payload?.document?.key;
    if (!webhookEvents.has(name) || !uuid(id)) return json({ received: true });
    const { rows: [row] } = await pool.query('SELECT * FROM contratacao.contracts WHERE document_id=$1', [id]);
    if (row) {
      const occurred = payload.event.occurred_at;
      const eventKey = typeof occurred === 'string' && Number.isFinite(Date.parse(occurred))
        ? digest(JSON.stringify([id, name, new Date(occurred).toISOString()]))
        : digest(raw);
      if (!await reconcile(row, name, eventKey)) throw providerError();
    }
    return json({ received: true });
  }

  return async function handle(request) {
    try {
      const url = new URL(request.url);
      const op = url.searchParams.get('op') ?? 'config';
      if (!ops[request.method]?.has(op)) throw error(404, 'Operação indisponível.');
      if (op === 'webhook') return await webhook(request);
      if (url.origin !== settings.origin || (request.method === 'POST' && request.headers.get('origin') !== settings.origin)) {
        throw error(403, 'Origem não autorizada.');
      }
      if (op === 'login') return await login(request, await readJson(request));
      const actor = await session(request);
      if (op === 'config') {
        return json({
          role: actor?.role ?? null, signing: provider.available, embedded: provider.available && provider.embedded,
          consulates, client: testClient,
          services: Object.entries(services).map(([id, { name, cents, scope, questions }]) => ({ id, name, cents, scope, questions }))
        });
      }
      if (!actor) throw error(401, 'Entre para acessar a contratação de testes.');
      if (adminOps.has(op) && !isAdmin(actor)) throw error(403, 'Acesso exclusivo da equipe.');
      if (op === 'logout') {
        await pool.query('DELETE FROM contratacao.sessions WHERE token_hash=$1', [sessionHash(request)]);
        return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
      }
      if (op === 'list') {
        const page = Number(url.searchParams.get('page') ?? 0);
        if (!Number.isInteger(page) || page < 0 || page > 1000) throw error(422, 'Página inválida.');
        const status = url.searchParams.get('status');
        const { rows } = await pool.query(`
          SELECT id, service_id, status, payment_status, service_status, amount_cents, created_at FROM contratacao.contracts
          WHERE ($1::boolean OR owner_id=$2) AND ($3::text IS NULL OR status=$3)
          ORDER BY created_at DESC, id DESC LIMIT 21 OFFSET $4`, [isAdmin(actor), actor.actor, status, page * 20]);
        return json({ rows: rows.slice(0, 20).map(row => ({ ...row, service: services[row.service_id].name })), more: rows.length > 20 });
      }
      const body = request.method === 'POST' ? await readJson(request) : null;
      if (op === 'draft') return json(await draft(body, actor), 201);
      const row = await owned(body?.id ?? url.searchParams.get('id'), actor);
      if (op === 'status') {
        const info = details(row, actor);
        if (isAdmin(actor)) {
          const { rows } = await pool.query('SELECT actor, action, detail, occurred_at FROM contratacao.audit WHERE contract_id=$1 ORDER BY id DESC LIMIT 100', [row.id]);
          info.audit = rows;
        }
        return json(info);
      }
      if (op === 'pdf') {
        const signed = url.searchParams.get('kind') === 'signed';
        const encrypted = signed ? row.signed_pdf : row.draft_pdf;
        if (!encrypted) throw error(404, 'PDF indisponível.');
        const pdf = crypto.open(encrypted, `${row.id}:${signed ? 'assinado' : 'minuta'}`);
        if (!equalHex(digest(pdf), signed ? row.signed_hash : row.draft_hash)) throw error(409, 'Integridade do PDF inválida.');
        await audit(pool, row.id, actorId(actor), 'pdf_consultado', signed ? 'assinado' : 'minuta');
        return new Response(pdf, { headers: { ...responseHeaders, 'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="oliveira-${signed ? 'assinado' : 'minuta'}-${row.id}.pdf"` } });
      }
      if (op === 'submit') return json(await submit(row, body, actor));
      if (op === 'sync') {
        if (!row.envelope_id || !provider.available) throw error(409, 'O pedido não tem um envelope conhecido para consultar.');
        await limit(`sync:${actor.actor}`, 30, 3600);
        await reconcile(row, 'manual');
      }
      if (op === 'review' || op === 'service' || op === 'payment') {
        await transaction(pool, async db => {
          const { rows: [current] } = await db.query('SELECT * FROM contratacao.contracts WHERE id=$1 FOR UPDATE', [row.id]);
          if (op === 'review') {
            if (current.status !== 'triagem') throw error(409, 'A revisão está disponível para pedidos em triagem.');
            if (current.reviewed_at) return;
            await db.query('UPDATE contratacao.contracts SET reviewed_at=now(), updated_at=now() WHERE id=$1', [row.id]);
            await audit(db, row.id, actorId(actor), 'triagem_revisada');
          }
          if (op === 'payment') {
            if (row.owner_id !== actor.actor || current.status !== 'assinado') throw error(409, 'A simulação está disponível ao titular após a assinatura.');
            const payment = sandboxPayment({ method: body.method, amountCents: current.amount_cents, currency: current.currency });
            if (current.payment_method === payment.method) return;
            await db.query("UPDATE contratacao.contracts SET payment_status='simulacao', payment_method=$2, updated_at=now() WHERE id=$1", [row.id, payment.method]);
            await audit(db, row.id, actorId(actor), 'pagamento_simulado', payment.method);
          }
          if (op === 'service') {
            if (current.status !== 'assinado') throw error(409, 'O atendimento de teste exige um contrato assinado.');
            if (current.service_status === body.status && body.status !== 'aguardando') return;
            const next = { aguardando: 'em_atendimento', em_atendimento: 'finalizado' }[current.service_status];
            if (!next || next !== body.status) throw error(409, 'Transição de atendimento inválida.');
            await db.query('UPDATE contratacao.contracts SET service_status=$2, updated_at=now() WHERE id=$1', [row.id, next]);
            await audit(db, row.id, actorId(actor), 'atendimento_atualizado', next);
          }
        });
      }
      return json(details(await owned(row.id, actor), actor));
    } catch (err) {
      // Do not log request bodies, secrets, Clicksign responses, or database error details.
      return err.status && err.status < 600 ? json({ error: err.message }, err.status) : json({ error: 'Serviço de testes temporariamente indisponível.' }, 503);
    }
  };
}
