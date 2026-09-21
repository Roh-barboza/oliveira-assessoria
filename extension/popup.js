(() => {
  'use strict';

  const STORAGE_KEY = 'oliveiraIrpfClient';
  const fileInput = document.getElementById('file-input');
  const emptyState = document.getElementById('empty-state');
  const clientState = document.getElementById('client-state');
  const clientName = document.getElementById('client-name');
  const clientMeta = document.getElementById('client-meta');
  const clientProgress = document.getElementById('client-progress');
  const pageContext = document.getElementById('page-context');
  const scanResult = document.getElementById('scan-result');
  const copyMapButton = document.getElementById('copy-map');
  const fillButton = document.getElementById('fill-page');
  const actionStatus = document.getElementById('action-status');
  let client = null;
  let latestMap = null;

  function validateClient(data) {
    if (!data || data.service !== 'IRPF' || data.exercise !== 2026 || !data.taxpayer?.fullName) {
      throw new Error('Esta ficha não segue o formato IRPF 2026 esperado.');
    }
    if (data.automation?.credentialsIncluded) throw new Error('A ficha não pode conter credenciais.');
    const hasCredentialKey = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) =>
      (key !== 'credentialsIncluded' && /password|senha|token|otp|captcha|credential|credencial/i.test(key)) || hasCredentialKey(child)
    );
    if (hasCredentialKey(data)) throw new Error('A ficha contém um campo de credencial não permitido.');
    return data;
  }

  function completion(data) {
    const groups = [
      data.taxpayer?.fullName,
      data.taxpayer?.cpf,
      data.taxpayer?.birthDate,
      data.taxpayer?.address,
      data.income?.entries?.length || data.income?.categories?.length,
      data.documents?.length
    ];
    return Math.round((groups.filter(Boolean).length / groups.length) * 100);
  }

  function renderClient() {
    emptyState.hidden = Boolean(client);
    clientState.hidden = !client;
    if (!client) return;
    const percent = completion(client);
    clientName.textContent = client.taxpayer.fullName;
    clientMeta.textContent = `IRPF ${client.exercise} • ${percent}% estruturado`;
    clientProgress.style.width = `${percent}%`;
  }

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function sendToPage(message) {
    const tab = await activeTab();
    if (!tab?.id) throw new Error('Nenhuma aba ativa encontrada.');
    const response = await chrome.tabs.sendMessage(tab.id, message);
    if (response?.error) throw new Error(response.error);
    return response;
  }

  async function updatePageContext() {
    try {
      const context = await sendToPage({ type: 'OA_GET_CONTEXT' });
      pageContext.textContent = `${context.title || 'Tela sem título'} • ${context.hostname}`;
      fillButton.disabled = !client || !context.fillAdapterValidated;
      if (!context.fillAdapterValidated) actionStatus.textContent = 'Mapeamento de preenchimento ainda não validado para esta tela.';
    } catch {
      pageContext.textContent = 'Abra o Meu Imposto de Renda após o login manual.';
      fillButton.disabled = true;
    }
  }

  fileInput.addEventListener('change', async () => {
    actionStatus.textContent = '';
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      client = validateClient(JSON.parse(await file.text()));
      await chrome.storage.local.set({ [STORAGE_KEY]: client });
      renderClient();
      await updatePageContext();
    } catch (error) {
      actionStatus.textContent = error.message;
    } finally {
      fileInput.value = '';
    }
  });

  document.getElementById('remove-client').addEventListener('click', async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
    client = null;
    renderClient();
    fillButton.disabled = true;
  });

  document.getElementById('scan-page').addEventListener('click', async () => {
    actionStatus.textContent = '';
    try {
      latestMap = await sendToPage({ type: 'OA_SCAN_PAGE' });
      scanResult.hidden = false;
      scanResult.textContent = `${latestMap.fields.length} campos encontrados. Nenhum valor da página foi coletado.`;
      copyMapButton.hidden = false;
    } catch {
      actionStatus.textContent = 'Não foi possível mapear esta aba. Confirme se ela está no portal compatível.';
    }
  });

  copyMapButton.addEventListener('click', async () => {
    if (!latestMap) return;
    await navigator.clipboard.writeText(JSON.stringify(latestMap, null, 2));
    copyMapButton.textContent = 'Mapa copiado';
  });

  fillButton.addEventListener('click', async () => {
    if (!client) return;
    actionStatus.textContent = 'Preenchendo apenas os campos mapeados…';
    try {
      const result = await sendToPage({ type: 'OA_FILL_CURRENT', payload: client });
      actionStatus.textContent = `${result.filled} campos preenchidos. ${result.skipped} campos ignorados para revisão.`;
    } catch (error) {
      actionStatus.textContent = error.message || 'O preenchimento foi interrompido com segurança.';
    }
  });

  chrome.storage.local.get(STORAGE_KEY).then(result => {
    client = result[STORAGE_KEY] || null;
    renderClient();
    updatePageContext();
  });
})();
