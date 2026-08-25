import api from '../browser/webextension-api.js';
import {
  loadSettings,
  resetSettings,
  saveSettings,
} from '../infrastructure/settings/settings-repository.js';
import { LANGUAGE_OPTIONS, LLM_MODEL_OPTIONS } from '../shared/settings.js';

const PROVIDER_IDS = ['mymemory', 'deepseek', 'openai', 'gemini', 'claude', 'custom'];
const PROVIDER_LABELS = Object.freeze({
  mymemory: '免费查询',
  openai: 'OpenAI',
  gemini: 'Gemini',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  custom: '自定义服务商',
});

const form = document.getElementById('settings-form');
const providerConfig = document.getElementById('provider-config');
const freeProviderNote = document.getElementById('free-provider-note');
const keyInput = document.getElementById('api-key');
const endpointInput = document.getElementById('endpoint');
const modelInput = document.getElementById('model');
const modelOptions = document.getElementById('model-options');
const sourceInput = document.getElementById('sourceLang');
const targetInput = document.getElementById('targetLang');
const connectionFeedback = document.getElementById('connection-feedback');
const saveFeedback = document.getElementById('save-feedback');
const saveButton = document.getElementById('btn-save');
const resetDialog = document.getElementById('reset-dialog');

let values = {};
let currentProvider = 'mymemory';
let feedbackTimer;
let savedSnapshot = '';

function fieldName(provider, suffix) {
  return `${provider}${suffix}`;
}

function isFreeProvider(provider = currentProvider) {
  return provider === 'mymemory';
}

function clearErrors() {
  for (const id of ['api-key-error', 'endpoint-error', 'model-error']) {
    const field = document.getElementById(id);
    field.hidden = true;
    field.textContent = '';
  }
  document.getElementById('language-warning').textContent = '';
}

function showError(id, message) {
  const field = document.getElementById(id);
  field.textContent = message;
  field.hidden = false;
}

function setPasswordHidden() {
  keyInput.type = 'password';
  const toggle = document.getElementById('password-toggle');
  toggle.textContent = '显示';
  toggle.setAttribute('aria-pressed', 'false');
}

function saveCurrentDraft() {
  if (isFreeProvider()) return;
  values[fieldName(currentProvider, 'ApiKey')] = keyInput.value.trim();
  values[fieldName(currentProvider, 'BaseUrl')] = endpointInput.value.trim();
  values[fieldName(currentProvider, 'Model')] = modelInput.value.trim();
}

function populateModelSuggestions(provider) {
  const options = LLM_MODEL_OPTIONS[provider] ?? [];
  modelOptions.replaceChildren(...options.map(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.label = label;
    return option;
  }));
}

function updateProviderStatuses() {
  for (const provider of PROVIDER_IDS.filter((id) => !isFreeProvider(id))) {
    const status = document.querySelector(`[data-provider-status="${provider}"]`);
    status.textContent = values[fieldName(provider, 'ApiKey')] ? '已配置' : '未配置';
    status.className = values[fieldName(provider, 'ApiKey')] ? 'configured' : '';
  }
}

function loadProvider(provider) {
  currentProvider = provider;
  setPasswordHidden();
  clearErrors();
  connectionFeedback.textContent = '';
  connectionFeedback.className = 'inline-feedback';

  const free = isFreeProvider(provider);
  providerConfig.hidden = free;
  freeProviderNote.hidden = !free;
  if (free) return;

  keyInput.value = values[fieldName(provider, 'ApiKey')] ?? '';
  endpointInput.value = values[fieldName(provider, 'BaseUrl')] ?? '';
  modelInput.value = values[fieldName(provider, 'Model')] ?? '';
  populateModelSuggestions(provider);
  keyInput.placeholder = `输入 ${PROVIDER_LABELS[provider]} API Key`;
  endpointInput.placeholder = provider === 'custom'
    ? 'https://api.example.com/v1'
    : `${PROVIDER_LABELS[provider]} API 地址`;
  modelInput.placeholder = provider === 'custom'
    ? '输入 OpenAI 兼容模型名称'
    : '选择或输入模型名称';
}

function checkLanguages() {
  const invalid = sourceInput.value !== 'auto' && sourceInput.value === targetInput.value;
  document.getElementById('language-warning').textContent = invalid
    ? '原语言和目标语言不能相同，请修改其中一项。'
    : '';
  return !invalid;
}

function validate() {
  clearErrors();
  let valid = checkLanguages();
  if (isFreeProvider()) return valid;

  if (!keyInput.value.trim()) {
    showError('api-key-error', '请填写 API Key。');
    valid = false;
  }
  try {
    const url = new URL(endpointInput.value);
    const localHttp = url.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) throw new Error('protocol');
  } catch {
    showError('endpoint-error', '请输入有效的 HTTPS 地址（本地服务可使用 HTTP）。');
    valid = false;
  }
  if (!modelInput.value.trim()) {
    showError('model-error', '请填写模型名称。');
    valid = false;
  }
  return valid;
}

function collectValues() {
  saveCurrentDraft();
  return {
    ...values,
    provider: currentProvider,
    useMockData: false,
    sourceLang: sourceInput.value,
    targetLang: targetInput.value,
  };
}

function snapshot(nextValues) {
  return JSON.stringify(nextValues, Object.keys(nextValues).sort());
}

function updateDirtyState() {
  const dirty = savedSnapshot && snapshot(collectValues()) !== savedSnapshot;
  saveButton.textContent = dirty ? '保存更改' : '已保存';
  saveButton.disabled = !dirty;
}

async function ensureCustomHostPermission(nextValues) {
  if (nextValues.provider !== 'custom') return;
  const url = new URL(nextValues.customBaseUrl);
  const permission = { origins: [`${url.origin}/*`] };
  const granted = await api.permissions.request(permission);
  if (!granted) {
    throw new Error('未获得该 API 域名的访问权限，无法连接自定义服务。');
  }
}

async function persist(nextValues, message = '设置已保存。', permissionChecked = false) {
  if (!permissionChecked) await ensureCustomHostPermission(nextValues);
  await saveSettings(nextValues);
  values = { ...nextValues };
  savedSnapshot = snapshot(nextValues);
  updateProviderStatuses();
  updateDirtyState();
  showSaveFeedback(message);
}

function populate(nextValues) {
  values = { ...nextValues, useMockData: false };
  currentProvider = PROVIDER_IDS.includes(values.provider) ? values.provider : 'mymemory';
  document.getElementById(`provider-${currentProvider}`).checked = true;
  sourceInput.value = values.sourceLang || 'auto';
  targetInput.value = values.targetLang || 'zh-CN';
  loadProvider(currentProvider);
  updateProviderStatuses();
  checkLanguages();
  savedSnapshot = snapshot(collectValues());
  updateDirtyState();
}

function showSaveFeedback(message, type = 'success') {
  saveFeedback.textContent = message;
  saveFeedback.className = `save-feedback ${type}`;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { saveFeedback.textContent = ''; }, 4000);
}

function closeSettings() {
  if (history.length > 1) history.back();
  else window.close();
}

sourceInput.replaceChildren(
  Object.assign(document.createElement('option'), { value: 'auto', textContent: '自动检测（推荐）' }),
  ...LANGUAGE_OPTIONS.map(({ value, label }) => Object.assign(document.createElement('option'), {
    value,
    textContent: label,
  })),
);
targetInput.replaceChildren(...LANGUAGE_OPTIONS.map(({ value, label }) =>
  Object.assign(document.createElement('option'), { value, textContent: label }),
));

for (const radio of document.querySelectorAll('input[name="provider"]')) {
  radio.addEventListener('change', () => {
    saveCurrentDraft();
    loadProvider(radio.value);
    updateProviderStatuses();
    updateDirtyState();
  });
}

document.getElementById('password-toggle').addEventListener('click', (event) => {
  const reveal = keyInput.type === 'password';
  keyInput.type = reveal ? 'text' : 'password';
  event.currentTarget.textContent = reveal ? '隐藏' : '显示';
  event.currentTarget.setAttribute('aria-pressed', String(reveal));
});

for (const control of [keyInput, endpointInput, modelInput, sourceInput, targetInput]) {
  control.addEventListener('input', updateDirtyState);
  control.addEventListener('change', () => {
    if (control === sourceInput || control === targetInput) checkLanguages();
    updateDirtyState();
  });
}

document.getElementById('test-connection').addEventListener('click', async () => {
  if (!validate()) {
    connectionFeedback.className = 'inline-feedback error';
    connectionFeedback.textContent = '请先修正配置项。';
    return;
  }
  const testValues = collectValues();
  connectionFeedback.className = 'inline-feedback';
  connectionFeedback.textContent = '正在连接服务商…';
  try {
    await ensureCustomHostPermission(testValues);
    const response = await api.runtime.sendMessage({
      type: 'dictbox:test-connection',
      settings: testValues,
    });
    if (!response?.ok) throw new Error(response?.error?.message);
    await persist(testValues, '连接成功，设置已保存。', true);
    connectionFeedback.className = 'inline-feedback success';
    connectionFeedback.textContent = '连接成功，已保存。';
  } catch (error) {
    connectionFeedback.className = 'inline-feedback error';
    connectionFeedback.textContent = error.message || '连接失败。';
  }
});

document.getElementById('btn-reset').addEventListener('click', () => {
  resetDialog.showModal();
});

resetDialog.addEventListener('close', async () => {
  if (resetDialog.returnValue !== 'confirm') return;
  await resetSettings();
  populate(await loadSettings());
  showSaveFeedback('已恢复默认设置并删除所有 API Key。');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validate()) return;
  try {
    await persist(collectValues());
  } catch (error) {
    showSaveFeedback(error.message || '保存失败。', 'error');
  }
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 's') {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.getElementById('close-settings').addEventListener('click', closeSettings);
document.getElementById('cancel-return').addEventListener('click', closeSettings);

const initialValues = await loadSettings();
if (initialValues.useMockData) {
  initialValues.useMockData = false;
  await saveSettings(initialValues);
}
populate(initialValues);
