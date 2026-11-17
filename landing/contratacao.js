const $ = id => document.getElementById(id);
const areas = ['intake', 'orders', 'order'];
const statuses = {
  triagem: 'Análise da equipe', rascunho: 'Minuta para conferência', preparando: 'Preparando assinatura',
  reconciliar: 'Conferência da integração', aguardando_assinatura: 'Aguardando assinatura',
  assinado: 'Assinado no sandbox', cancelado: 'Cancelado',
  aguardando: 'Aguardando', em_atendimento: 'Em atendimento', finalizado: 'Finalizado',
  desativado: 'Desativado', simulacao: 'Simulação registrada'
};
const triageAnswers = { yes: 'Sim', no: 'Não', unknown: 'A confirmar' };
const date = value => new Date(value).toLocaleString('pt-BR');
const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
let config;
let role;
let activeOrder;
let page = 0;
let requestId;
let requestFingerprint;
let widget;
let script;
let viewVersion = 0;

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function feedback(message = '', isError = false) {
  $('feedback').textContent = message;
  $('feedback').toggleAttribute('data-error', isError);
}

async function api(op, input, params = {}) {
  const query = new URLSearchParams({ op, ...params });
  const result = await fetch(`/api/contratacao?${query}`, {
    cache: 'no-store',
    ...(input && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  });
  const body = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(body.error ?? 'Serviço temporariamente indisponível.');
  return body;
}

function run(control, callback) {
  return async event => {
    event?.preventDefault();
    if (control.disabled) return;
    control.disabled = true;
    feedback();
    try {
      await callback();
    } catch (error) {
      feedback(error.message || 'Não foi possível concluir a operação.', true);
    } finally {
      control.disabled = false;
    }
  };
}

function show(area) {
  if (area !== 'order') {
    widget?.unmount();
    widget = null;
    activeOrder = null;
  }
  for (const key of areas) $(key).hidden = key !== area;
}

function choice(value, title) {
  const option = element('option', title);
  option.value = value;
  return option;
}

function button(text, callback, secondary = false) {
  const node = element('button', text, secondary ? 'secondary' : '');
  node.type = 'button';
  node.addEventListener('click', run(node, callback));
  return node;
}

function matchingService() {
  return config.services.find(service => service.id === $('draft').elements.serviceId.value);
}

function displayService() {
  const service = matchingService();
  $('service-name').textContent = service.name;
  $('service-price').textContent = money(service.cents);
  $('service-scope').textContent = service.scope;
  $('questions').replaceChildren(element('legend', 'Condições do serviço'));
  for (const [key, title] of service.questions) {
    const label = element('label', title);
    const select = element('select');
    select.name = key;
    select.required = true;
    select.append(choice('', 'Selecione'), ...Object.entries(triageAnswers).map(([value, name]) => choice(value, name)));
    label.append(select);
    $('questions').append(label);
  }
}

async function loadList(target = 0) {
  const version = ++viewVersion;
  const params = { page: target };
  if ($('filter').value) params.status = $('filter').value;
  const data = await api('list', null, params);
  if (version !== viewVersion) return;
  page = target;
  const list = $('order-list');
  list.replaceChildren();
  if (!data.rows.length) list.append(element('p', 'Nenhum pedido nesta página.'));
  for (const row of data.rows) {
    const entry = element('div', '', 'order-row');
    const info = element('div');
    info.append(element('strong', row.service), element('p', `${statuses[row.status]} · ${money(row.amount_cents)} · ${date(row.created_at)}`, 'fine'));
    if (role !== 'tester') info.append(element('p', `Pagamento: ${statuses[row.payment_status]} · Serviço: ${statuses[row.service_status]}`, 'fine'));
    entry.append(info, button('Abrir pedido', () => loadOrder(row.id), true));
    list.append(entry);
  }
  $('previous-page').disabled = page === 0;
  $('next-page').disabled = !data.more;
  $('pages').hidden = page === 0 && !data.more;
  show('orders');
}

function meta(name, value) {
  const group = element('div');
  group.append(element('dt', name), element('dd', value));
  $('order-meta').append(group);
}

function pdfLink(id, signed) {
  const link = element('a', signed ? 'Baixar PDF assinado' : 'Baixar minuta em PDF', 'button secondary');
  link.href = `/api/contratacao?${new URLSearchParams({ op: 'pdf', id, kind: signed ? 'signed' : 'draft' })}`;
  return link;
}

async function loadOrder(id, focus = true) {
  const version = ++viewVersion;
  const data = await api('status', null, { id });
  if (version !== viewVersion) return;
  renderOrder(data);
  if (focus) $('order-title').focus();
}

function confirmation(data, container) {
  const form = element('form');
  const accepted = element('input');
  accepted.type = 'checkbox';
  accepted.required = true;
  const label = element('label', '', 'check');
  label.append(accepted, 'Conferi a minuta e confirmo o envio desta versão para teste de assinatura.');
  form.append(label);
  const select = element('select');
  select.append(choice('email', 'Pela Clicksign, via e-mail de teste'));
  if (config.embedded) {
    const mode = element('label', 'Forma de assinatura');
    select.append(choice('embedded', 'Diretamente nesta página'));
    mode.append(select);
    form.append(mode);
  }
  const submit = element('button', 'Enviar para assinatura sandbox');
  submit.type = 'submit';
  form.append(submit);
  form.addEventListener('submit', run(submit, async () => {
    await api('submit', { id: data.id, hash: data.draftHash, confirmed: accepted.checked, mode: select.value });
    if (activeOrder === data.id) await loadOrder(data.id);
  }));
  container.append(form);
}

function adminActions(data, container) {
  const actions = element('div', '', 'toolbar');
  async function act(op, input = {}) {
    await api(op, { id: data.id, ...input });
    if (activeOrder === data.id) await loadOrder(data.id);
  }
  if (data.status === 'triagem' && !data.reviewed) actions.append(button('Registrar revisão', () => act('review')));
  if (data.envelopeId && ['preparando', 'reconciliar', 'aguardando_assinatura'].includes(data.status)) {
    actions.append(button('Sincronizar com Clicksign', () => act('sync')));
  }
  if (data.status === 'assinado' && data.serviceStatus !== 'finalizado') {
    const start = data.serviceStatus === 'aguardando';
    actions.append(button(start ? 'Iniciar atendimento de teste' : 'Finalizar atendimento de teste',
      () => act('service', { status: start ? 'em_atendimento' : 'finalizado' })));
  }
  if (actions.children.length) container.append(actions);
  const fields = [['Requerente adulto', triageAnswers[data.adult]], ...Object.entries(data.answers).map(([key, value]) =>
    [config.services.find(service => service.name === data.service)?.questions.find(q => q[0] === key)?.[1] ?? key, triageAnswers[value]])];
  const review = element('details');
  review.append(element('summary', 'Respostas da triagem'));
  const answers = element('ul');
  for (const [question, answer] of fields) answers.append(element('li', `${question} ${answer}`));
  review.append(answers);
  container.append(review);
  if (data.audit?.length) {
    const history = element('details');
    history.append(element('summary', 'Histórico de auditoria'));
    const items = element('ul', '', 'audit');
    for (const record of data.audit) {
      items.append(element('li', `${date(record.occurred_at)} · ${record.actor.split(':')[0]} · ${record.action.replaceAll('_', ' ')}${record.detail ? ` · ${record.detail}` : ''}`));
    }
    history.append(items);
    container.append(history);
  }
}

async function mountWidget(id, signer) {
  if (!script) {
    script = new Promise((resolve, reject) => {
      const node = element('script');
      node.src = 'https://cdn-public-library.clicksign.com/embedded/embedded.min-2.1.0.js';
      node.onload = resolve;
      node.onerror = () => {
        script = null;
        node.remove();
        reject(new Error('O componente de assinatura está indisponível. Tente atualizar a situação.'));
      };
      document.head.append(node);
    });
  }
  await script;
  if (activeOrder !== id || $('widget').hidden || widget) return;
  widget = new window.Clicksign(signer);
  widget.endpoint = 'https://sandbox.clicksign.com';
  widget.origin = location.origin;
  widget.on('signed', () => {
    if (activeOrder !== id) return;
    $('widget-note').textContent = 'Aguardando confirmação da Clicksign. Use Atualizar situação para consultar.';
  });
  widget.on('resized', event => {
    const height = Number(event.data?.height);
    if (height > 0 && height < 3000) $('clicksign-container').style.height = `${height}px`;
  });
  widget.mount('clicksign-container');
}

function renderOrder(data) {
  widget?.unmount();
  widget = null;
  $('clicksign-container').style.height = '';
  $('widget').hidden = true;
  activeOrder = data.id;
  $('order-title').textContent = data.service;
  $('order-status').textContent = statuses[data.status];
  $('order-meta').replaceChildren();
  meta('Cliente', data.name);
  meta('Referência', data.id);
  meta('Circunscrição informada', data.consulate);
  meta('Valor de teste', money(data.amountCents));
  meta('Pagamento', statuses[data.paymentStatus] + (data.paymentMethod ? ` · ${data.paymentMethod === 'pix' ? 'Pix' : 'Cartão'}` : ''));
  meta('Serviço', statuses[data.serviceStatus]);
  if (role !== 'tester' && data.providerStep) meta('Etapa Clicksign', data.providerStep.replaceAll('_', ' '));
  if (role !== 'tester' && data.envelopeId) meta('Envelope sandbox', data.envelopeId);
  const content = $('order-content');
  content.replaceChildren();
  if (data.reasons.length) {
    const reasons = element('ul');
    for (const reason of data.reasons) reasons.append(element('li', reason));
    content.append(element('p', data.reviewed ? 'A equipe registrou a revisão deste pedido.' : 'A equipe precisa revisar estes pontos antes de avançar.'), reasons);
  }
  if (data.sections && data.status === 'rascunho') {
    const document = element('article', '', 'document');
    document.append(element('h3', 'Minuta fictícia'));
    for (const [title, paragraph] of data.sections) document.append(element('h3', title), element('p', paragraph));
    content.append(document);
  }
  const files = element('div', '', 'toolbar');
  if (data.draftHash) files.append(pdfLink(data.id, false));
  if (data.signedHash) files.append(pdfLink(data.id, true));
  if (files.children.length) content.append(files);
  if (data.status === 'rascunho' && role === 'tester') {
    if (config.signing) confirmation(data, content);
    else content.append(element('p', 'A assinatura sandbox está pendente de configuração.', 'notice'));
  }
  if (data.status === 'aguardando_assinatura' && !data.widgetSigner && role === 'tester') {
    content.append(element('p', 'Abra o convite enviado ao endereço de teste configurado pela equipe.'));
  }
  if (['preparando', 'reconciliar'].includes(data.status)) {
    content.append(element('p', 'Use Atualizar situação. A equipe pode consultar a Clicksign se o envio precisar de conferência.'));
  }
  if (data.status === 'assinado' && role === 'tester') {
    const payments = element('div', '', 'toolbar');
    for (const [method, label] of [['pix', 'Simular Pix'], ['cartao', 'Simular cartão']]) {
      payments.append(button(label, async () => {
        await api('payment', { id: data.id, method });
        if (activeOrder === data.id) await loadOrder(data.id);
      }, true));
    }
    content.append(payments);
  }
  if (role !== 'tester') adminActions(data, content);
  show('order');
  if (data.widgetSigner) {
    $('widget').hidden = false;
    $('widget-note').textContent = 'Assinatura de teste pela Clicksign.';
    mountWidget(data.id, data.widgetSigner).catch(error => feedback(error.message, true));
  }
}

function newDraft() {
  viewVersion += 1;
  requestId = null;
  requestFingerprint = null;
  $('draft').reset();
  displayService();
  show('intake');
}

async function displaySession() {
  config = await api('config');
  role = config.role;
  $('access').hidden = Boolean(role);
  $('session').hidden = !role;
  $('page-title').textContent = role && role !== 'tester' ? 'Painel de contratações' : 'Contratação digital';
  if (!role) return show(null);
  $('new-order').hidden = role !== 'tester';
  $('status-filter').hidden = role === 'tester';
  $('orders-title').textContent = role === 'tester' ? 'Meus pedidos' : 'Contratos e solicitações';
  $('orders-button').textContent = role === 'tester' ? 'Meus pedidos' : 'Contratos';
  $('filter').value = '';
  if (role === 'tester') {
    const fields = $('draft').elements;
    fields.serviceId.replaceChildren(...config.services.map(service => choice(service.id, service.name)));
    fields.consulate.replaceChildren(choice('', 'Selecione'), ...config.consulates.map(value => choice(value, value)));
    for (const [key, value] of Object.entries(config.client)) fields[key].defaultValue = value;
  }
  await loadList();
}

const login = $('login');
const draft = $('draft');
login.elements.role.addEventListener('change', () => {
  $('credential-label').firstChild.textContent = login.elements.role.value === 'tester' ? 'Código de convite ' : 'Senha ';
});
login.addEventListener('submit', run(login.querySelector('button'), async () => {
  try {
    await api('login', { role: login.elements.role.value, password: login.elements.password.value });
  } finally {
    login.elements.password.value = '';
  }
  await displaySession();
}));
draft.elements.serviceId.addEventListener('change', displayService);
draft.addEventListener('submit', run(draft.querySelector('button'), async () => {
  const version = viewVersion;
  const fields = new FormData(draft);
  const service = matchingService();
  const answers = Object.fromEntries(service.questions.map(([key]) => [key, fields.get(key)]));
  const client = Object.fromEntries(Object.keys(config.client).map(key => [key, fields.get(key)]));
  const input = { serviceId: service.id, consulate: fields.get('consulate'), adult: fields.get('adult'), answers, client, acknowledged: fields.get('acknowledged') === 'on' };
  const fingerprint = JSON.stringify(input);
  if (requestFingerprint !== fingerprint) {
    requestId = crypto.randomUUID();
    requestFingerprint = fingerprint;
  }
  const data = await api('draft', { ...input, id: requestId });
  if (version === viewVersion) await loadOrder(data.id);
}));
$('filter').append(choice('', 'Todos'), ...Object.entries(statuses).slice(0, 7).map(([id, name]) => choice(id, name)));
$('filter').addEventListener('change', () => loadList().catch(error => feedback(error.message, true)));
$('logout').addEventListener('click', run($('logout'), async () => {
  await api('logout', {});
  viewVersion += 1;
  show(null);
  $('order-content').replaceChildren();
  $('order-list').replaceChildren();
  await displaySession();
}));
$('new-order').addEventListener('click', run($('new-order'), newDraft));
$('orders-button').addEventListener('click', run($('orders-button'), () => loadList()));
$('refresh').addEventListener('click', run($('refresh'), () => loadOrder(activeOrder)));
for (const [id, next] of [['previous-page', -1], ['next-page', 1]]) {
  $(id).addEventListener('click', () => loadList(page + next).catch(error => feedback(error.message, true)));
}
displaySession().then(() => feedback()).catch(error => feedback(error.message, true));
