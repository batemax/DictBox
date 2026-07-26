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
  if (isFirefox) {
    const description = formatFirefoxSummary(result, query);
    // Firefox does not repaint an asynchronously updated default suggestion.
    // Submit one compact real suggestion instead. The invisible word joiner keeps
    // it distinct from the current input without exposing an internal result ID.
    suggest([{ content: `${query}\u2060`, description }]);
    return;
  }

  const suggestions = formatSuggestions(result, query, { useMarkup: !isFirefox });
  updateDefaultSuggestion(suggestions[0].description);
  suggest(suggestions.slice(1));
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

  if (query.length < 2) {
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
    await settingsReady;
    const { from, to } = resolveLanguagePair(query, settings.targetLang);
    try {
      const result = await translationService.lookup(
        { query, sourceLanguage: from, targetLanguage: to },
        settings,
        { signal: controller.signal },
      );
      if (currentRequestId === requestId) showSuggestions(suggest, result, query);
    } catch (error) {
      if (currentRequestId !== requestId) return;
      updateDefaultSuggestion(`查询失败: ${escapeXml(error.message).slice(0, 80)}`);
      suggest([]);
    } finally {
      if (activeController === controller) activeController = null;
      if (currentRequestId === requestId) activeQuery = '';
    }
  }, 600);
});

api.omnibox.onInputCancelled.addListener(() => {
  requestId += 1;
  activeQuery = '';
  if (debounceTimer) clearTimeout(debounceTimer);
  activeController?.abort();
});

api.omnibox.onInputEntered.addListener(() => {
  // V2 keeps the interaction inside Omnibox; detailed-result navigation is deferred.
});
