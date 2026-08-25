import api from '../browser/webextension-api.js';
import {
  escapeXml,
  formatFirefoxSummary,
  formatSuggestions,
} from '../core/omnibox-mapper.js';
import { resolveLanguagePair } from '../core/language-policy.js';
import { TranslationService } from '../core/translation-service.js';
import { LruCache } from '../infrastructure/cache/memory-cache.js';
import { PersistentCache } from '../infrastructure/cache/persistent-cache.js';
import { loadSettings } from '../infrastructure/settings/settings-repository.js';
import { DEFAULT_SECRETS, DEFAULT_SETTINGS } from '../shared/settings.js';

const memoryCache = new LruCache(200);
const persistentCache = new PersistentCache();
const translationService = new TranslationService({ memoryCache, persistentCache });
const isFirefox = api.runtime.getURL('').startsWith('moz-extension://');
const settingKeys = new Set([
  ...Object.keys(DEFAULT_SETTINGS),
  ...Object.keys(DEFAULT_SECRETS),
]);

let settings = { ...DEFAULT_SETTINGS, ...DEFAULT_SECRETS };
let settingsReady = loadSettings()
  .then((loadedSettings) => {
    settings = loadedSettings;
    return loadedSettings;
  })
  .catch(() => settings);
let debounceTimer = null;
let activeController = null;
let activeQuery = '';
let lastCompletedQuery = '';
let requestId = 0;

api.storage.onChanged.addListener((changes) => {
  if (!Object.keys(changes).some((key) => settingKeys.has(key))) return;
  settingsReady = loadSettings()
    .then((loadedSettings) => {
      settings = loadedSettings;
      return loadedSettings;
    })
    .catch(() => settings);
  memoryCache.clear();
});

function updateDefaultSuggestion(description) {
  void api.omnibox.setDefaultSuggestion({ description }).catch(() => {
    // A failed UI refresh must not create an unhandled promise rejection.
  });
}

function showSuggestions(suggest, result, query) {
  const provider = escapeXml(result?.provider || settings.provider || 'DictBox');
  if (isFirefox) {
    const description = `${provider} · ${formatFirefoxSummary(result, query)}`;
    // Firefox does not repaint an asynchronously updated default suggestion.
    // Submit one compact real suggestion instead. The invisible word joiner keeps
    // it distinct from the current input without exposing an internal result ID.
    suggest([{ content: `${query}\u2060`, description }]);
    return;
  }

  const suggestions = formatSuggestions(result, query, { useMarkup: !isFirefox });
  updateDefaultSuggestion(`<dim>${provider}</dim> · ${suggestions[0].description}`);
  suggest(suggestions.slice(1));
}

async function lookup(query, context = {}) {
  await settingsReady;
  return lookupWithSettings(query, settings, context);
}

export function resolveLookupRequest(query, selectedSettings) {
  const resolved = resolveLanguagePair(query, selectedSettings.targetLang);
  const usesAutomaticSource = !selectedSettings.sourceLang || selectedSettings.sourceLang === 'auto';
  const sourceLanguage = usesAutomaticSource ? resolved.from : selectedSettings.sourceLang;
  const targetLanguage = usesAutomaticSource ? resolved.to : selectedSettings.targetLang;
  return { query, sourceLanguage, targetLanguage };
}

function lookupWithSettings(query, selectedSettings, context = {}) {
  return translationService.lookup(
    resolveLookupRequest(query, selectedSettings),
    selectedSettings,
    context,
  );
}

function publicError(error) {
  const messages = {
    NO_RESULT: error.message,
    MISSING_API_KEY: '请先在插件设置中填写 API Key。',
    AUTHENTICATION_FAILED: 'API Key 验证失败，请检查后重试。',
    RATE_LIMITED: '服务请求过于频繁，请稍后重试。',
    PROVIDER_UNAVAILABLE: '暂时无法连接查询服务，请检查网络后重试。',
    INVALID_MODEL_OUTPUT: '服务返回了无法识别的释义，请重试。',
  };
  return {
    code: error?.code || 'LOOKUP_FAILED',
    message: messages[error?.code] || '查询失败，请稍后重试。',
  };
}

api.omnibox.onInputStarted.addListener(() => {
  settingsReady = loadSettings()
    .then((loadedSettings) => {
      settings = loadedSettings;
      return loadedSettings;
    })
    .catch(() => settings);
  updateDefaultSuggestion('DictBox - 输入单词或短语进行查询...');
});

api.omnibox.onInputChanged.addListener((text, suggest) => {
  const query = text.trim();
  if (
    query === activeQuery
    && (debounceTimer || (activeController && !activeController.signal.aborted))
  ) {
    return;
  }

  requestId += 1;
  const currentRequestId = requestId;

  if (debounceTimer) clearTimeout(debounceTimer);
  activeController?.abort();
  activeQuery = query;

  if (query.length < 1) {
    activeQuery = '';
    updateDefaultSuggestion(
      query ? 'DictBox - 继续输入...' : 'DictBox - 输入单词或短语进行查询...',
    );
    suggest([]);
    return;
  }

  updateDefaultSuggestion(`正在查询 "${escapeXml(query)}" ...`);

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    const controller = new AbortController();
    activeController = controller;
    try {
      const result = await lookup(query, { signal: controller.signal });
      if (currentRequestId === requestId) {
        lastCompletedQuery = query;
        showSuggestions(suggest, result, query);
      }
    } catch (error) {
      if (currentRequestId !== requestId) return;
      updateDefaultSuggestion(`查询失败: ${escapeXml(publicError(error).message).slice(0, 80)}`);
      suggest([]);
    } finally {
      if (activeController === controller) activeController = null;
      if (currentRequestId === requestId) activeQuery = '';
    }
  }, 500);
});

api.omnibox.onInputCancelled.addListener(() => {
  requestId += 1;
  activeQuery = '';
  if (debounceTimer) clearTimeout(debounceTimer);
  activeController?.abort();
});

api.omnibox.onInputEntered.addListener((content) => {
  const selectedSuggestion = String(content).startsWith('dictbox-result-');
  const query = (selectedSuggestion ? lastCompletedQuery : content).trim();
  if (!query) return;
  const url = api.runtime.getURL(`result.html?word=${encodeURIComponent(query)}`);
  void api.tabs.create({ url });
});

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!['dictbox:lookup', 'dictbox:test-connection'].includes(message?.type)) return false;
  if (message.type === 'dictbox:test-connection') {
    const testSettings = { ...settings, ...message.settings };
    lookupWithSettings('world', testSettings)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: publicError(error) }));
    return true;
  }
  const query = String(message.query ?? '').trim();
  if (!query) {
    sendResponse({
      ok: false,
      error: { code: 'EMPTY_QUERY', message: '请输入要查询的单词。' },
    });
    return false;
  }

  lookup(query)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: publicError(error) }));
  return true;
});
