import api from '../browser/webextension-api.js';
import { loadSettings, resetSettings, saveSettings } from '../infrastructure/settings/settings-repository.js';
import {
  DEFAULT_SECRETS,
  DEFAULT_SETTINGS,
  LLM_MODEL_OPTIONS,
  PROVIDERS,
} from '../shared/settings.js';

const fieldIds = [
  ...Object.keys(DEFAULT_SETTINGS),
  ...Object.keys(DEFAULT_SECRETS),
].filter((key) => !['fallbackProvider'].includes(key));

const elements = Object.fromEntries(
  fieldIds.map((id) => [id, document.getElementById(id)]),
);
elements.btnSave = document.getElementById('btn-save');
elements.btnReset = document.getElementById('btn-reset');
elements.toast = document.getElementById('toast');

let toastTimeout;

function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => elements.toast.classList.remove('show'), 2500);
}

function updateProviderConfigVisibility(providerId) {
  for (const provider of PROVIDERS) {
    const section = document.getElementById(`${provider.id}-config`);
    if (section) section.style.display = provider.id === providerId ? 'block' : 'none';
  }
}

function populateModelOptions() {
  for (const [providerId, models] of Object.entries(LLM_MODEL_OPTIONS)) {
    const select = elements[`${providerId}Model`];
    if (!select) continue;
    select.replaceChildren(...models.map(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
  }
}

function populateForm(settings) {
  for (const id of fieldIds) {
    const element = elements[id];
    if (!element) continue;
    if (element.type === 'checkbox') {
      element.checked = Boolean(settings[id]);
    } else {
      if (
        element.tagName === 'SELECT'
        && id.endsWith('Model')
        && settings[id]
        && ![...element.options].some(({ value }) => value === settings[id])
      ) {
        const customOption = document.createElement('option');
        customOption.value = settings[id];
        customOption.textContent = `${settings[id]}（已保存）`;
        element.append(customOption);
      }
      element.value = settings[id] ?? '';
    }
  }
  updateProviderConfigVisibility(settings.provider);
}

function readForm() {
  const values = {};
  for (const id of fieldIds) {
    const element = elements[id];
    if (!element) continue;
    values[id] = element.type === 'checkbox' ? element.checked : element.value.trim();
  }
  values.fallbackProvider = 'mymemory';
  return values;
}

function validate(values) {
  const keyName = `${values.provider}ApiKey`;
  if (values.provider !== 'mymemory' && !values[keyName]) {
    throw new Error('请填写当前服务的 API Key');
  }
  if (PROVIDERS.some((provider) => provider.id === values.provider && provider.kind === 'llm')) {
    const modelName = `${values.provider}Model`;
    const baseUrlName = `${values.provider}BaseUrl`;
    if (!values[modelName]) throw new Error('请填写模型名称');
    if (!values[baseUrlName]) throw new Error('请填写 API 地址');

    let url;
    try {
      url = new URL(values[baseUrlName]);
    } catch {
      throw new Error('API 地址格式不正确');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('API 地址仅支持 HTTP 或 HTTPS');
    }
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      throw new Error('非本地 API 地址必须使用 HTTPS');
    }
  }
}

async function ensureHostPermission(values) {
  const provider = PROVIDERS.find(({ id }) => id === values.provider);
  if (provider?.kind !== 'llm') return;

  const url = new URL(values[`${values.provider}BaseUrl`]);
  const originPattern = `${url.protocol}//${url.hostname}/*`;
  const permission = { origins: [originPattern] };
  if (await api.permissions.contains(permission)) return;
  if (!await api.permissions.request(permission)) {
    throw new Error('未授予该 API 地址的访问权限');
  }
}

async function initialize() {
  try {
    populateForm(await loadSettings());
  } catch {
    showToast('加载设置失败', 'error');
  }
}

elements.provider.addEventListener('change', (event) => {
  updateProviderConfigVisibility(event.target.value);
});

elements.btnSave.addEventListener('click', async () => {
  try {
    const values = readForm();
    validate(values);
    await ensureHostPermission(values);
    await saveSettings(values);
    showToast('✓ 设置已保存');
  } catch (error) {
    showToast(error.message || '保存失败', 'error');
  }
});

elements.btnReset.addEventListener('click', async () => {
  await resetSettings();
  populateForm({ ...DEFAULT_SETTINGS, ...DEFAULT_SECRETS });
  showToast('已恢复默认设置', 'info');
});

document.querySelectorAll('.toggle-visibility').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    elements.btnSave.click();
  }
});

populateModelOptions();
initialize();
