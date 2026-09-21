(() => {
  'use strict';

  const BLOCKED_TYPES = new Set(['password', 'hidden', 'file']);
  const BLOCKED_TERMS = /senha|password|token|otp|autentica|captcha|código de acesso|codigo de acesso/i;

  function labelFor(element) {
    const explicit = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null;
    const wrapped = element.closest('label');
    const aria = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
    const placeholder = element.getAttribute('placeholder');
    return (explicit?.innerText || wrapped?.innerText || aria || placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  function safeSelector(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;
    if (element.name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(element.name)}"]`;
    return element.tagName.toLowerCase();
  }

  function scanPage() {
    const fields = [...document.querySelectorAll('input, select, textarea')]
      .filter(element => !BLOCKED_TYPES.has(element.type) && !BLOCKED_TERMS.test(`${element.name} ${element.id} ${labelFor(element)}`))
      .map(element => ({
        tag: element.tagName.toLowerCase(),
        type: element.type || null,
        name: element.name || null,
        id: element.id || null,
        label: labelFor(element),
        selectorHint: safeSelector(element),
        required: Boolean(element.required),
        disabled: Boolean(element.disabled),
        readonly: Boolean(element.readOnly)
      }));
    return {
      capturedAt: new Date().toISOString(),
      url: location.href,
      hostname: location.hostname,
      title: document.title,
      privacy: 'field_metadata_only_no_values',
      fields
    };
  }

  function getContext() {
    const isLab = ['localhost', '127.0.0.1'].includes(location.hostname);
    return {
      hostname: location.hostname,
      title: document.querySelector('h1, h2')?.textContent?.trim() || document.title,
      path: location.pathname,
      fillAdapterValidated: isLab && document.documentElement.dataset.oliveiraLab === 'irpf-2026'
    };
  }

  function setValue(selector, value) {
    const element = document.querySelector(selector);
    if (!element || element.disabled || element.readOnly || BLOCKED_TYPES.has(element.type) || !value) return false;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function fillLab(payload) {
    if (!getContext().fillAdapterValidated) throw new Error('Esta tela ainda não possui um mapa de preenchimento validado.');
    const fields = [
      ['[data-ir-field="taxpayer.fullName"]', payload.taxpayer?.fullName],
      ['[data-ir-field="taxpayer.cpf"]', payload.taxpayer?.cpf],
      ['[data-ir-field="taxpayer.birthDate"]', payload.taxpayer?.birthDate],
      ['[data-ir-field="taxpayer.address"]', payload.taxpayer?.address],
      ['[data-ir-field="taxpayer.mainOccupation"]', payload.taxpayer?.mainOccupation]
    ];
    const filled = fields.filter(([selector, value]) => setValue(selector, value)).length;
    return { filled, skipped: fields.length - filled, finalSubmission: false };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (message.type === 'OA_GET_CONTEXT') sendResponse(getContext());
      if (message.type === 'OA_SCAN_PAGE') sendResponse(scanPage());
      if (message.type === 'OA_FILL_CURRENT') sendResponse(fillLab(message.payload));
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return true;
  });
})();
