/**
 * Google Cloud Translation API v2 Provider
 * Endpoint: https://translation.googleapis.com/language/translate/v2
 * Requires API Key
 */

const GOOGLE_API = 'https://translation.googleapis.com/language/translate/v2';

/**
 * @param {string} text - Text to translate
 * @param {string} from - Source language code ('auto' for autodetect)
 * @param {string} to - Target language code
 * @param {object} config - { apiKey: string }
 * @returns {Promise<{translations: Array<{pos: string, meaning: string}>}>}
 */
export async function translate(text, from, to, config = {}) {
    if (!config.apiKey) {
        throw new Error('Google Translate requires an API Key. Please configure it in the extension settings.');
    }

    const params = new URLSearchParams({
        key: config.apiKey,
        q: text,
        target: to,
        format: 'text',
    });

    if (from && from !== 'auto') {
        params.set('source', from);
    }

    const url = `${GOOGLE_API}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `${response.status} ${response.statusText}`;
        throw new Error(`Google Translate API error: ${errMsg}`);
    }

    const data = await response.json();
    const results = data.data?.translations || [];

    const translations = results.map((t) => ({
        pos: '',
        meaning: t.translatedText,
        quality: 100,
        source: 'Google',
        detectedLanguage: t.detectedSourceLanguage || from,
    }));

    if (translations.length === 0) {
        throw new Error('Google Translate returned no results.');
    }

    return { translations };
}

export const name = 'Google Translate';
export const requiresKey = true;
