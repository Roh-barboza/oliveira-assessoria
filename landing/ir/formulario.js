(() => {
    'use strict';

    const STORAGE_KEY = 'oliveira.irpf.2026.draft.v1';
    const SCHEMA_VERSION = '1.0.0';
    const form = document.getElementById('ir-form');
    const steps = [...document.querySelectorAll('.form-step')];
    const stepItems = [...document.querySelectorAll('#step-list li')];
    const prevButton = document.getElementById('prev-step');
    const nextButton = document.getElementById('next-step');
    const errorBox = document.getElementById('form-error');
    const progressValue = document.getElementById('progress-value');
    const progressBar = document.getElementById('progress-bar');
    const autosaveStatus = document.getElementById('autosave-status');
    const reviewSummary = document.getElementById('review-summary');
    const reviewAlert = document.getElementById('review-alert');
    let currentStep = 0;
    let saveTimer;

    const repeaters = {
        dependente: { list: 'dependentes-list', template: 'template-dependente', stateKey: 'dependentes' },
        alimentando: { list: 'alimentandos-list', template: 'template-alimentando', stateKey: 'alimentandos' },
        rendimento: { list: 'rendimentos-list', template: 'template-rendimento', stateKey: 'rendimentos' },
        pagamento: { list: 'pagamentos-list', template: 'template-pagamento', stateKey: 'pagamentos' },
        bem: { list: 'bens-list', template: 'template-bem', stateKey: 'bens' },
        divida: { list: 'dividas-list', template: 'template-divida', stateKey: 'dividas' }
    };

    function digits(value = '') {
        return String(value).replace(/\D/g, '');
    }

    function formatCpf(value) {
        return digits(value).slice(0, 11)
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }

    function formatPhone(value) {
        const raw = digits(value).slice(0, 11);
        if (raw.length <= 10) return raw.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => `${a ? `(${a})` : ''}${b ? ` ${b}` : ''}${c ? `-${c}` : ''}`);
        return raw.replace(/(\d{2})(\d{0,5})(\d{0,4})/, (_, a, b, c) => `${a ? `(${a})` : ''}${b ? ` ${b}` : ''}${c ? `-${c}` : ''}`);
    }

    function formatCep(value) {
        return digits(value).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
    }

    function isValidCpf(value) {
        const cpf = digits(value);
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        const calc = length => {
            let sum = 0;
            for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
            const rest = (sum * 10) % 11;
            return rest === 10 ? 0 : rest;
        };
        return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
    }

    function setFieldValue(field, value) {
        if (field.type === 'checkbox') {
            if (Array.isArray(value)) field.checked = value.includes(field.value);
            else field.checked = Boolean(value);
        } else if (field.type === 'radio') {
            field.checked = field.value === value;
        } else if (value !== undefined && value !== null) {
            field.value = value;
        }
    }

    function addRepeater(type, values = {}) {
        const config = repeaters[type];
        if (!config) return;
        const template = document.getElementById(config.template);
        const fragment = template.content.cloneNode(true);
        const card = fragment.querySelector('.repeat-card');
        card.querySelectorAll('[data-key]').forEach(field => setFieldValue(field, values[field.dataset.key]));
        card.querySelector('[data-remove]').addEventListener('click', () => {
            card.remove();
            queueSave();
            updateProgress();
        });
        card.addEventListener('input', queueSave);
        card.addEventListener('change', queueSave);
        document.getElementById(config.list).appendChild(fragment);
        updateProgress();
    }

    function serializeRepeaters() {
        const result = {};
        Object.entries(repeaters).forEach(([type, config]) => {
            result[config.stateKey] = [...document.querySelectorAll(`[data-item-type="${type}"]`)].map(card => {
                const item = {};
                card.querySelectorAll('[data-key]').forEach(field => { item[field.dataset.key] = field.value.trim(); });
                return item;
            });
        });
        return result;
    }

    function serializeSimpleFields() {
        const data = {};
        const grouped = new Set();
        form.querySelectorAll('[name]').forEach(field => {
            if (field.closest('.repeat-card') || grouped.has(field.name)) return;
            const sameName = [...form.querySelectorAll(`[name="${CSS.escape(field.name)}"]`)];
            if (field.type === 'checkbox') {
                data[field.name] = sameName.length > 1
                    ? sameName.filter(item => item.checked).map(item => item.value)
                    : field.checked;
            } else if (field.type === 'radio') {
                data[field.name] = sameName.find(item => item.checked)?.value || '';
            } else {
                data[field.name] = field.value.trim();
            }
            grouped.add(field.name);
        });
        return data;
    }

    function buildPayload() {
        const fields = serializeSimpleFields();
        const lists = serializeRepeaters();
        return {
            schemaVersion: SCHEMA_VERSION,
            service: 'IRPF',
            exercise: 2026,
            calendarYear: 2025,
            generatedAt: new Date().toISOString(),
            status: 'review_required',
            source: 'oliveira_ir_intake',
            taxpayer: {
                fullName: fields.nomeCompleto,
                cpf: digits(fields.cpf),
                birthDate: fields.dataNascimento,
                whatsapp: fields.whatsapp,
                email: fields.email,
                maritalStatus: fields.estadoCivil,
                mainOccupation: fields.ocupacaoPrincipal,
                occupationNature: fields.naturezaOcupacao,
                postalCode: digits(fields.cep),
                address: fields.enderecoCompleto,
                firstReturn: fields.primeiraDeclaracao,
                previousReceipt: fields.reciboAnterior
            },
            people: {
                hasDependents: fields.possuiDependentes,
                dependents: lists.dependentes,
                hasAlimonyRecipients: fields.possuiAlimentandos,
                alimonyRecipients: lists.alimentandos,
                notes: fields.pessoasObservacoes
            },
            income: { categories: fields.rendaCategorias || [], entries: lists.rendimentos, notes: fields.rendimentosObservacoes },
            payments: { categories: fields.pagamentoCategorias || [], entries: lists.pagamentos, notes: fields.pagamentosObservacoes },
            assets: { categories: fields.patrimonioCategorias || [], entries: lists.bens, debts: lists.dividas },
            specialSituations: { categories: fields.situacoes || [], details: fields.situacoesDetalhes },
            documents: fields.documentos || [],
            acknowledgements: {
                security: fields.securityAck,
                accuracy: fields.accuracyAck,
                finalReview: fields.reviewAck
            },
            automation: {
                credentialsIncluded: false,
                finalSubmissionAllowed: false,
                humanReviewRequired: true
            }
        };
    }

    function saveDraft() {
        const draft = { fields: serializeSimpleFields(), lists: serializeRepeaters(), savedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        autosaveStatus.textContent = `Rascunho salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    function queueSave() {
        window.clearTimeout(saveTimer);
        autosaveStatus.textContent = 'Salvando rascunho…';
        saveTimer = window.setTimeout(() => {
            saveDraft();
            updateProgress();
        }, 280);
    }

    function restoreDraft() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const draft = JSON.parse(raw);
            Object.entries(draft.fields || {}).forEach(([name, value]) => {
                form.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach(field => setFieldValue(field, value));
            });
            Object.entries(repeaters).forEach(([type, config]) => {
                (draft.lists?.[config.stateKey] || []).forEach(item => addRepeater(type, item));
            });
            updateConditionals();
            autosaveStatus.textContent = 'Rascunho recuperado deste dispositivo';
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    function updateConditionals() {
        form.querySelectorAll('[data-target]').forEach(toggle => {
            const target = document.getElementById(toggle.dataset.target);
            target.hidden = !toggle.checked;
        });
    }

    function validateCurrentStep() {
        errorBox.textContent = '';
        const current = steps[currentStep];
        const fields = [...current.querySelectorAll('input, select, textarea')].filter(field => !field.disabled && !field.closest('[hidden]'));
        let firstInvalid = null;
        fields.forEach(field => {
            field.removeAttribute('aria-invalid');
            if (!field.checkValidity()) {
                field.setAttribute('aria-invalid', 'true');
                firstInvalid ||= field;
            }
        });
        const cpfField = current.querySelector('[name="cpf"]');
        if (cpfField && cpfField.value && !isValidCpf(cpfField.value)) {
            cpfField.setAttribute('aria-invalid', 'true');
            firstInvalid ||= cpfField;
            errorBox.textContent = 'Confira o CPF informado antes de continuar.';
        }
        if (firstInvalid) {
            if (!errorBox.textContent) errorBox.textContent = 'Preencha os campos obrigatórios destacados antes de continuar.';
            firstInvalid.focus();
            return false;
        }
        return true;
    }

    function updateStepView() {
        steps.forEach((step, index) => step.classList.toggle('active', index === currentStep));
        stepItems.forEach((item, index) => {
            item.classList.toggle('active', index === currentStep);
            item.classList.toggle('complete', index < currentStep);
        });
        prevButton.hidden = currentStep === 0;
        nextButton.hidden = currentStep === steps.length - 1;
        nextButton.textContent = currentStep === steps.length - 2 ? 'Revisar ficha' : 'Continuar';
        errorBox.textContent = '';
        if (currentStep === steps.length - 1) renderReview();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        updateProgress();
        saveDraft();
    }

    function updateProgress() {
        const required = [...form.querySelectorAll('[required]')].filter(field => !field.closest('[hidden]'));
        const completedRequired = required.filter(field => field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.value.trim()).length;
        const base = required.length ? completedRequired / required.length : 0;
        const position = currentStep / (steps.length - 1);
        const percentage = Math.min(100, Math.round((base * .7 + position * .3) * 100));
        progressValue.textContent = `${percentage}% concluído`;
        progressBar.style.width = `${percentage}%`;
    }

    function countLabel(count, singular, plural) {
        return `${count} ${count === 1 ? singular : plural}`;
    }

    function escapeHtml(value = '') {
        return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
    }

    function renderReview() {
        const payload = buildPayload();
        const missing = [];
        if (!payload.income.entries.length && !payload.income.categories.length) missing.push('nenhum rendimento foi indicado');
        if (!payload.documents.length) missing.push('nenhum documento foi marcado como separado');
        if (payload.people.hasDependents && !payload.people.dependents.length) missing.push('dependentes foram marcados, mas nenhum foi cadastrado');
        if (payload.people.hasAlimonyRecipients && !payload.people.alimonyRecipients.length) missing.push('alimentandos foram marcados, mas nenhum foi cadastrado');

        reviewAlert.className = `review-alert ${missing.length ? 'warning' : 'ok'}`;
        reviewAlert.innerHTML = missing.length
            ? `<strong>Revise antes de gerar:</strong> ${escapeHtml(missing.join('; '))}.`
            : '<strong>Estrutura completa.</strong> A ficha está pronta para a conferência documental da equipe.';

        reviewSummary.innerHTML = `
            <article class="review-block"><h3>Titular</h3><dl>
                <dt>Nome</dt><dd>${escapeHtml(payload.taxpayer.fullName || 'Não informado')}</dd>
                <dt>CPF</dt><dd>${escapeHtml(formatCpf(payload.taxpayer.cpf) || 'Não informado')}</dd>
                <dt>Contato</dt><dd>${escapeHtml(payload.taxpayer.whatsapp || payload.taxpayer.email || 'Não informado')}</dd>
            </dl></article>
            <article class="review-block"><h3>Pessoas e registros</h3><dl>
                <dt>Dependentes</dt><dd>${countLabel(payload.people.dependents.length, 'cadastrado', 'cadastrados')}</dd>
                <dt>Alimentandos</dt><dd>${countLabel(payload.people.alimonyRecipients.length, 'cadastrado', 'cadastrados')}</dd>
                <dt>Rendimentos</dt><dd>${countLabel(payload.income.entries.length, 'registro', 'registros')}</dd>
                <dt>Pagamentos</dt><dd>${countLabel(payload.payments.entries.length, 'registro', 'registros')}</dd>
            </dl></article>
            <article class="review-block"><h3>Patrimônio e conferência</h3><dl>
                <dt>Bens e direitos</dt><dd>${countLabel(payload.assets.entries.length, 'registro', 'registros')}</dd>
                <dt>Dívidas</dt><dd>${countLabel(payload.assets.debts.length, 'registro', 'registros')}</dd>
                <dt>Situações especiais</dt><dd>${countLabel(payload.specialSituations.categories.length, 'marcada', 'marcadas')}</dd>
                <dt>Documentos separados</dt><dd>${countLabel(payload.documents.length, 'item', 'itens')}</dd>
            </dl></article>`;
    }

    function downloadPayload() {
        const reviewAck = form.querySelector('[name="reviewAck"]');
        if (!reviewAck.checked) {
            errorBox.textContent = 'Confirme a revisão da ficha antes de gerar o arquivo.';
            reviewAck.focus();
            return;
        }
        saveDraft();
        const payload = buildPayload();
        const safeName = (payload.taxpayer.fullName || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ficha-irpf-2026-${safeName || 'cliente'}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        errorBox.textContent = 'Ficha gerada com sucesso. Guarde o arquivo em local seguro.';
        errorBox.style.color = 'var(--success)';
    }

    document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => addRepeater(button.dataset.add)));
    document.querySelectorAll('[data-target]').forEach(toggle => toggle.addEventListener('change', () => {
        updateConditionals();
        const target = document.getElementById(toggle.dataset.target);
        if (toggle.checked && !target.querySelector('.repeat-card')) {
            const addButton = target.querySelector('[data-add]');
            if (addButton) addRepeater(addButton.dataset.add);
        }
        queueSave();
    }));

    form.addEventListener('input', event => {
        if (event.target.name === 'cpf' || event.target.dataset.key === 'cpf') event.target.value = formatCpf(event.target.value);
        if (event.target.name === 'whatsapp') event.target.value = formatPhone(event.target.value);
        if (event.target.name === 'cep') event.target.value = formatCep(event.target.value);
        queueSave();
    });
    form.addEventListener('change', queueSave);
    form.addEventListener('submit', event => event.preventDefault());

    nextButton.addEventListener('click', () => {
        if (!validateCurrentStep()) return;
        currentStep = Math.min(steps.length - 1, currentStep + 1);
        updateStepView();
    });
    prevButton.addEventListener('click', () => {
        currentStep = Math.max(0, currentStep - 1);
        updateStepView();
    });

    document.getElementById('download-json').addEventListener('click', downloadPayload);
    document.getElementById('clear-draft').addEventListener('click', () => {
        if (!window.confirm('Apagar todos os dados deste rascunho neste dispositivo?')) return;
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    });

    restoreDraft();
    updateConditionals();
    updateStepView();
})();
