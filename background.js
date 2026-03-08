/**
 * DictBox — Chrome Dictionary Extension
 * Background Service Worker
 *
 * Handles omnibox events, translation requests, caching, and language detection.
 */

import { translateWithFallback } from './providers/index.js';

// ============================================================
// LRU Cache
// ============================================================
class LRUCache {
    constructor(maxSize = 200) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Delete the least recently used (first entry)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }
}

const translationCache = new LRUCache(200);

// ============================================================
// Default Settings
// ============================================================
const DEFAULT_SETTINGS = {
    provider: 'mymemory',
    targetLang: 'zh-CN',
    googleApiKey: '',
    microsoftApiKey: '',
    microsoftRegion: '',
    mymemoryEmail: '',
};

let currentSettings = { ...DEFAULT_SETTINGS };

// ============================================================
// Load settings from storage
// ============================================================
async function loadSettings() {
    try {
        const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
        currentSettings = { ...DEFAULT_SETTINGS, ...stored };
        console.log('[DictBox] Settings loaded:', currentSettings.provider, currentSettings.targetLang);
    } catch (err) {
        console.warn('[DictBox] Failed to load settings:', err);
    }
}

// Reload settings whenever they change
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        for (const [key, { newValue }] of Object.entries(changes)) {
            if (key in currentSettings) {
                currentSettings[key] = newValue;
            }
        }
        // Clear cache when settings change
        translationCache.clear();
        console.log('[DictBox] Settings updated:', JSON.stringify(currentSettings));
    }
});

// ============================================================
// Language Detection (heuristic by Unicode range)
// ============================================================
function detectSourceLang(text) {
    const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
    const koreanPattern = /[\uac00-\ud7af\u1100-\u11ff]/;
    const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf]/;
    const cyrillicPattern = /[\u0400-\u04ff]/;
    const arabicPattern = /[\u0600-\u06ff]/;
    const thaiPattern = /[\u0e00-\u0e7f]/;

    if (japanesePattern.test(text)) return 'ja';
    if (koreanPattern.test(text)) return 'ko';
    if (cjkPattern.test(text)) return 'zh-CN';
    if (cyrillicPattern.test(text)) return 'ru';
    if (arabicPattern.test(text)) return 'ar';
    if (thaiPattern.test(text)) return 'th';

    // Default: Latin script → auto detect
    return 'auto';
}

/**
 * Determine the "from" and "to" languages based on input.
 * If the source language matches the target language, reverse to English.
 */
function resolveLangPair(text) {
    const detected = detectSourceLang(text);
    let from = detected;
    let to = currentSettings.targetLang;

    // If source is the same as target, translate to English instead
    if (from === to || (from === 'zh-CN' && (to === 'zh-CN' || to === 'zh-TW'))) {
        to = 'en';
    }

    return { from, to };
}

// ============================================================
// Translation
// ============================================================
async function translateText(text) {
    const trimmed = text.trim();
    if (!trimmed) return { translations: [] };

    const { from, to } = resolveLangPair(trimmed);
    const cacheKey = `${currentSettings.provider}:${from}:${to}:${trimmed.toLowerCase()}`;

    // Check memory cache
    const cached = translationCache.get(cacheKey);
    if (cached) {
        console.log('[DictBox] Cache hit:', cacheKey);
        return cached;
    }

    // Build provider config
    const config = {
        email: currentSettings.mymemoryEmail,
        apiKey:
            currentSettings.provider === 'google'
                ? currentSettings.googleApiKey
                : currentSettings.provider === 'microsoft'
                    ? currentSettings.microsoftApiKey
                    : '',
        region: currentSettings.microsoftRegion,
    };

    console.log('[DictBox] Translating:', trimmed, `(${from} -> ${to})`, 'provider:', currentSettings.provider);

    const result = await translateWithFallback(currentSettings.provider, trimmed, from, to, config);

    console.log('[DictBox] Result:', JSON.stringify(result).substring(0, 300));

    // Cache the result
    translationCache.set(cacheKey, result);

    // Also persist to local storage for high-frequency words
    persistToLocalCache(cacheKey, result);

    return result;
}

// ============================================================
// Persistent cache for high-frequency words
// ============================================================
async function persistToLocalCache(key, value) {
    try {
        const stored = await chrome.storage.local.get({ _dictbox_cache: {} });
        const cache = stored._dictbox_cache || {};
        cache[key] = { value, timestamp: Date.now() };

        // Limit persistent cache to 500 entries
        const keys = Object.keys(cache);
        if (keys.length > 500) {
            keys
                .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
                .slice(0, keys.length - 500)
                .forEach((k) => delete cache[k]);
        }

        await chrome.storage.local.set({ _dictbox_cache: cache });
    } catch (e) {
        console.warn('[DictBox] Persistent cache write failed:', e);
    }
}

async function getFromPersistentCache(key) {
    try {
        const stored = await chrome.storage.local.get({ _dictbox_cache: {} });
        const entry = stored._dictbox_cache?.[key];
        if (entry && Date.now() - entry.timestamp < 7 * 24 * 60 * 60 * 1000) {
            return entry.value;
        }
    } catch (e) {
        // ignore
    }
    return null;
}

// ============================================================
// Format results for Omnibox suggestions
// ============================================================
function formatSuggestions(result, query) {
    if (!result || !result.translations || result.translations.length === 0) {
        return [
            {
                content: `dictbox-no-result-${query}`,
                description: escapeXml(`[无结果] 未找到 "${query}" 的翻译`),
            },
        ];
    }

    const seen = new Set();
    return result.translations.map((t, idx) => {
        const pos = t.pos ? `${escapeXml(t.pos)} ` : '';
        const meaning = escapeXml(t.meaning);

        // content must be unique per suggestion; append index if needed
        let content = t.meaning;
        if (seen.has(content)) {
            content = `${t.meaning} (${idx + 1})`;
        }
        seen.add(content);

        return {
            content: content,
            description: `${pos}<match>${meaning}</match>`,
        };
    });
}

/**
 * Escape XML special chars for Omnibox description (which uses XML markup).
 * Note: Omnibox descriptions only support <match>, <dim>, <url> tags.
 * Emoji and other special characters may cause issues.
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ============================================================
// Debounce (timer-based, calls callback with result)
// ============================================================
let debounceTimer = null;
let lastRequestId = 0;

/**
 * Debounced translation that calls onResult when ready.
 * Uses a request ID to discard stale results.
 */
function debouncedTranslate(query, onResult, onError) {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }

    const requestId = ++lastRequestId;

    debounceTimer = setTimeout(() => {
        translateText(query)
            .then((result) => {
                // Only deliver if this is still the latest request
                if (requestId === lastRequestId) {
                    onResult(result);
                }
            })
            .catch((err) => {
                if (requestId === lastRequestId) {
                    onError(err);
                }
            });
    }, 600);
}

// ============================================================
// Omnibox Event Handlers
// ============================================================

// When the user starts typing after "db "
chrome.omnibox.onInputStarted.addListener(() => {
    console.log('[DictBox] Omnibox input started');
    loadSettings();
    chrome.omnibox.setDefaultSuggestion({
        description: 'DictBox - 输入单词或短语进行翻译...',
    });
});

// When the user's input changes
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const query = text.trim();
    if (!query) {
        chrome.omnibox.setDefaultSuggestion({
            description: 'DictBox - 输入单词或短语进行翻译...',
        });
        suggest([]);
        return;
    }

    // Wait for at least 2 characters before triggering translation
    if (query.length < 2) {
        chrome.omnibox.setDefaultSuggestion({
            description: 'DictBox - 继续输入...',
        });
        suggest([]);
        return;
    }

    console.log('[DictBox] Input changed:', query);

    chrome.omnibox.setDefaultSuggestion({
        description: `正在翻译 "${escapeXml(query)}" ...`,
    });

    // First check memory cache (synchronous)
    const { from, to } = resolveLangPair(query);
    const cacheKey = `${currentSettings.provider}:${from}:${to}:${query.toLowerCase()}`;
    const cached = translationCache.get(cacheKey);

    if (cached) {
        console.log('[DictBox] Memory cache hit for:', query);
        const suggestions = formatSuggestions(cached, query);
        if (suggestions.length > 0) {
            chrome.omnibox.setDefaultSuggestion({
                description: suggestions[0].description,
            });
            suggest(suggestions.slice(1));
        }
        return;
    }

    // Use debounced API call
    debouncedTranslate(
        query,
        (result) => {
            const suggestions = formatSuggestions(result, query);
            console.log('[DictBox] Suggestions:', suggestions.length);
            if (suggestions.length > 0) {
                chrome.omnibox.setDefaultSuggestion({
                    description: suggestions[0].description,
                });
                suggest(suggestions.slice(1));
            }
        },
        (err) => {
            console.error('[DictBox] Translation error:', err);
            chrome.omnibox.setDefaultSuggestion({
                description: `翻译出错: ${escapeXml(err.message).substring(0, 80)}`,
            });
        }
    );
});

// When the user selects a suggestion or presses Enter
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    console.log('[DictBox] Selected:', text, 'disposition:', disposition);

    // If the text starts with our internal prefix, ignore
    if (text.startsWith('dictbox-')) return;
});

// ============================================================
// Initialize
// ============================================================
loadSettings();
console.log('[DictBox] Service worker initialized');
