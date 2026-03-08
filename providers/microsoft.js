/**
 * Microsoft Dictionary API Provider
 * Primary: Dictionary Lookup API (/dictionary/lookup) — provides POS tags
 * Fallback: Translator API (/translate) — for phrases or when dictionary lookup fails
 *
 * Endpoint: https://api.cognitive.microsofttranslator.com
 * Requires Subscription Key
 */

const MS_API = 'https://api.cognitive.microsofttranslator.com';

/**
 * Build common headers for Microsoft API requests.
 */
function buildHeaders(config) {
    const headers = {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Content-Type': 'application/json',
    };
    if (config.region) {
        headers['Ocp-Apim-Subscription-Region'] = config.region;
    }
    return headers;
}

/**
 * Microsoft Dictionary API requires explicit from/to language codes.
 * When source is 'auto', we first detect the language, then call dictionary.
 */
async function detectLanguage(text, config) {
    const url = `${MS_API}/detect?api-version=3.0`;
    const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(config),
        body: JSON.stringify([{ Text: text }]),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
        return data[0].language;
    }
    return null;
}

/**
 * Dictionary Lookup — provides part-of-speech tags and multiple meanings.
 * This is the PRIMARY method for single words.
 *
 * Endpoint: POST /dictionary/lookup?api-version=3.0&from={from}&to={to}
 */
async function dictionaryLookup(text, from, to, config) {
    const params = new URLSearchParams({
        'api-version': '3.0',
        from: from,
        to: to,
    });

    const url = `${MS_API}/dictionary/lookup?${params.toString()}`;

    console.log('[DictBox] Microsoft Dictionary request:', url, 'text:', text);

    const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(config),
        body: JSON.stringify([{ Text: text }]),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `${response.status} ${response.statusText}`;
        throw new Error(`Microsoft Dictionary API error: ${errMsg}`);
    }

    const data = await response.json();
    console.log('[DictBox] Microsoft Dictionary response:', JSON.stringify(data).substring(0, 500));

    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    const translations = [];
    for (const entry of data) {
        if (entry.translations) {
            for (const t of entry.translations) {
                translations.push({
                    pos: t.posTag ? mapPosTag(t.posTag) : '',
                    meaning: t.displayTarget,
                    quality: (t.confidence || 0) * 100,
                    source: 'Microsoft Dictionary',
                });
            }
        }
    }

    if (translations.length === 0) return null;

    // Sort by confidence descending
    translations.sort((a, b) => b.quality - a.quality);
    return { translations: translations.slice(0, 8) };
}

/**
 * Translation API — fallback for phrases or when dictionary has no results.
 *
 * Endpoint: POST /translate?api-version=3.0&to={to}
 */
async function translatorTranslate(text, from, to, config) {
    const params = new URLSearchParams({
        'api-version': '3.0',
        to: to,
    });

    if (from && from !== 'auto') {
        params.set('from', from);
    }

    const url = `${MS_API}/translate?${params.toString()}`;

    console.log('[DictBox] Microsoft Translate request:', url);

    const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(config),
        body: JSON.stringify([{ Text: text }]),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `${response.status} ${response.statusText}`;
        throw new Error(`Microsoft Translate API error: ${errMsg}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Microsoft Translate returned no results.');
    }

    const translations = [];
    for (const item of data) {
        if (item.translations) {
            for (const t of item.translations) {
                translations.push({
                    pos: '',
                    meaning: t.text,
                    quality: 100,
                    source: 'Microsoft Translate',
                    detectedLanguage: item.detectedLanguage?.language || from,
                });
            }
        }
    }

    if (translations.length === 0) {
        throw new Error('Microsoft Translate returned no translations.');
    }

    return { translations };
}

/**
 * Main translate function — Dictionary first, Translate API as fallback.
 *
 * Strategy:
 * 1. If source language is known → try Dictionary Lookup (provides POS)
 * 2. If source is 'auto' → detect language first, then try Dictionary
 * 3. If Dictionary returns no results → fall back to Translate API
 */
export async function translate(text, from, to, config = {}) {
    if (!config.apiKey) {
        throw new Error('Microsoft Translator requires an API Key. Please configure it in the extension settings.');
    }

    let sourceLang = from;

    // Step 1: Resolve source language if auto
    if (!sourceLang || sourceLang === 'auto') {
        try {
            const detected = await detectLanguage(text, config);
            if (detected) {
                sourceLang = detected;
                console.log('[DictBox] Microsoft detected language:', sourceLang);
            }
        } catch (e) {
            console.warn('[DictBox] Language detection failed:', e.message);
        }
    }

    // Step 2: Try Dictionary Lookup (requires known source language)
    if (sourceLang && sourceLang !== 'auto') {
        try {
            const dictResult = await dictionaryLookup(text, sourceLang, to, config);
            if (dictResult && dictResult.translations.length > 0) {
                console.log('[DictBox] Dictionary lookup succeeded with', dictResult.translations.length, 'results');
                return dictResult;
            }
        } catch (e) {
            console.warn('[DictBox] Dictionary lookup failed:', e.message, '→ falling back to Translate API');
        }
    }

    // Step 3: Fallback to Translate API
    console.log('[DictBox] Using Translate API as fallback');
    return translatorTranslate(text, from, to, config);
}

function mapPosTag(tag) {
    const map = {
        ADJ: 'adj.',
        ADV: 'adv.',
        CONJ: 'conj.',
        DET: 'det.',
        NOUN: 'n.',
        PREP: 'prep.',
        PRON: 'pron.',
        VERB: 'v.',
        OTHER: '',
    };
    return map[tag] || tag || '';
}

export const name = 'Microsoft Dictionary';
export const requiresKey = true;
