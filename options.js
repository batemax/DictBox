/**
 * DictBox Options Page — Settings Management
 */

// ============================================================
// Default settings
// ============================================================
const DEFAULT_SETTINGS = {
    provider: 'mymemory',
    targetLang: 'zh-CN',
    googleApiKey: '',
    microsoftApiKey: '',
    microsoftRegion: '',
    mymemoryEmail: '',
};

// ============================================================
// DOM Elements
// ============================================================
const elements = {
    provider: document.getElementById('provider'),
    targetLang: document.getElementById('targetLang'),
    googleApiKey: document.getElementById('googleApiKey'),
    microsoftApiKey: document.getElementById('microsoftApiKey'),
    microsoftRegion: document.getElementById('microsoftRegion'),
    mymemoryEmail: document.getElementById('mymemoryEmail'),
    btnSave: document.getElementById('btn-save'),
    btnReset: document.getElementById('btn-reset'),
    toast: document.getElementById('toast'),
    // Provider config sections
    mymemoryConfig: document.getElementById('mymemory-config'),
    googleConfig: document.getElementById('google-config'),
    microsoftConfig: document.getElementById('microsoft-config'),
};

// ============================================================
// Provider config visibility
// ============================================================
function updateProviderConfigVisibility(provider) {
    elements.mymemoryConfig.style.display = provider === 'mymemory' ? 'block' : 'none';
    elements.googleConfig.style.display = provider === 'google' ? 'block' : 'none';
    elements.microsoftConfig.style.display = provider === 'microsoft' ? 'block' : 'none';
}

// ============================================================
// Toast notification
// ============================================================
let toastTimeout = null;

function showToast(message, type = 'success') {
    const toast = elements.toast;
    toast.textContent = message;
    toast.className = `toast ${type}`;

    // Force reflow for animation restart
    void toast.offsetHeight;
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ============================================================
// Load settings from storage
// ============================================================
async function loadSettings() {
    try {
        const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

        elements.provider.value = settings.provider;
        elements.targetLang.value = settings.targetLang;
        elements.googleApiKey.value = settings.googleApiKey;
        elements.microsoftApiKey.value = settings.microsoftApiKey;
        elements.microsoftRegion.value = settings.microsoftRegion;
        elements.mymemoryEmail.value = settings.mymemoryEmail;

        updateProviderConfigVisibility(settings.provider);
    } catch (err) {
        console.error('Failed to load settings:', err);
        showToast('加载设置失败', 'error');
    }
}

// ============================================================
// Save settings to storage
// ============================================================
async function saveSettings() {
    const settings = {
        provider: elements.provider.value,
        targetLang: elements.targetLang.value,
        googleApiKey: elements.googleApiKey.value.trim(),
        microsoftApiKey: elements.microsoftApiKey.value.trim(),
        microsoftRegion: elements.microsoftRegion.value.trim(),
        mymemoryEmail: elements.mymemoryEmail.value.trim(),
    };

    // Validate
    if (settings.provider === 'google' && !settings.googleApiKey) {
        showToast('请输入 Google API Key', 'error');
        elements.googleApiKey.focus();
        return;
    }

    if (settings.provider === 'microsoft' && !settings.microsoftApiKey) {
        showToast('请输入 Microsoft API Key', 'error');
        elements.microsoftApiKey.focus();
        return;
    }

    try {
        await chrome.storage.sync.set(settings);
        showToast('✓ 设置已保存', 'success');
    } catch (err) {
        console.error('Failed to save settings:', err);
        showToast('保存失败: ' + err.message, 'error');
    }
}

// ============================================================
// Reset to defaults
// ============================================================
async function resetSettings() {
    try {
        await chrome.storage.sync.set(DEFAULT_SETTINGS);
        await loadSettings();
        showToast('已恢复默认设置', 'info');
    } catch (err) {
        console.error('Failed to reset settings:', err);
        showToast('重置失败', 'error');
    }
}

// ============================================================
// Toggle password visibility
// ============================================================
function setupPasswordToggles() {
    document.querySelectorAll('.toggle-visibility').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.textContent = isPassword ? '🙈' : '👁';
            }
        });
    });
}

// ============================================================
// Event Listeners
// ============================================================
elements.provider.addEventListener('change', (e) => {
    updateProviderConfigVisibility(e.target.value);
});

elements.btnSave.addEventListener('click', saveSettings);
elements.btnReset.addEventListener('click', resetSettings);

// Keyboard shortcut: Ctrl+S / Cmd+S to save
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveSettings();
    }
});

// ============================================================
// Initialize
// ============================================================
setupPasswordToggles();
loadSettings();
