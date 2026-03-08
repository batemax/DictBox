/**
 * Provider Factory — unified translation interface
 * Routes to the appropriate translation provider based on user config.
 */

import * as mymemory from './mymemory.js';
import * as google from './google.js';
import * as microsoft from './microsoft.js';

const providers = {
    mymemory,
    google,
    microsoft,
};

/**
 * Get the list of available providers and their metadata.
 */
export function getProviderList() {
    return Object.entries(providers).map(([key, provider]) => ({
        id: key,
        name: provider.name,
        requiresKey: provider.requiresKey,
    }));
}

/**
 * Translate text using the specified provider.
 *
 * @param {string} providerId - 'mymemory' | 'google' | 'microsoft'
 * @param {string} text - Text to translate
 * @param {string} from - Source language ('auto' for autodetect)
 * @param {string} to - Target language
 * @param {object} config - Provider-specific config (apiKey, email, region, etc.)
 * @returns {Promise<{translations: Array<{pos: string, meaning: string}>}>}
 */
export async function translate(providerId, text, from, to, config = {}) {
    const provider = providers[providerId];
    if (!provider) {
        throw new Error(`Unknown translation provider: ${providerId}`);
    }

    return provider.translate(text, from, to, config);
}

/**
 * Translate with fallback — if primary provider fails, try MyMemory.
 */
export async function translateWithFallback(providerId, text, from, to, config = {}) {
    try {
        return await translate(providerId, text, from, to, config);
    } catch (err) {
        console.warn(`[DictBox] ${providerId} failed: ${err.message}, falling back to MyMemory`);
        if (providerId !== 'mymemory') {
            return translate('mymemory', text, from, to, config);
        }
        throw err;
    }
}
