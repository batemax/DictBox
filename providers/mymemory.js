/**
 * MyMemory Translation Provider
 * Free API: https://api.mymemory.translated.net/get
 * Anonymous: 5000 chars/day | With email: 50000 chars/day
 */

const MYMEMORY_API = 'https://api.mymemory.translated.net/get';

/**
 * MyMemory requires both source and target in the langpair.
 * It supports ISO 639-1 and RFC3066 codes like zh-CN.
 * When source is 'auto', we default to 'en' since MyMemory
 * does not support empty source language.
 */
function resolveLangPair(from, to) {
    const sourceLang = (!from || from === 'auto') ? 'en' : from;
    const targetLang = to || 'zh-CN';
    return `${sourceLang}|${targetLang}`;
}

/**
 * @param {string} text - Text to translate
 * @param {string} from - Source language code (e.g. 'en', 'auto')
 * @param {string} to - Target language code (e.g. 'zh-CN')
 * @param {object} config - { email?: string }
 * @returns {Promise<{translations: Array<{pos: string, meaning: string}>}>}
 */
export async function translate(text, from, to, config = {}) {
    const langpair = resolveLangPair(from, to);

    const params = new URLSearchParams({
        q: text,
        langpair: langpair,
    });

    if (config.email) {
        params.set('de', config.email);
    }

    const url = `${MYMEMORY_API}?${params.toString()}`;

    console.log('[DictBox] MyMemory request:', url);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`MyMemory API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('[DictBox] MyMemory response:', JSON.stringify(data).substring(0, 500));

    // MyMemory returns 200 even for warnings; check responseStatus
    if (data.responseStatus && data.responseStatus !== 200 && data.responseStatus !== '200') {
        // Some status codes are warnings, not errors (e.g. 403 means quota exceeded)
        console.warn('[DictBox] MyMemory status:', data.responseStatus, data.responseDetails);
    }

    const translations = [];
    const mainTranslation = data.responseData?.translatedText;

    // Extract from matches for richer results (part-of-speech, multiple meanings)
    if (data.matches && data.matches.length > 0) {
        const seen = new Set();

        for (const match of data.matches) {
            const meaning = match.translation?.trim();
            if (!meaning || seen.has(meaning.toLowerCase())) continue;
            seen.add(meaning.toLowerCase());

            // MyMemory doesn't always provide POS; we mark as generic if absent
            const pos = match.subject || '';
            translations.push({
                pos: mapSubjectToPos(pos),
                meaning: meaning,
                quality: match.quality || 0,
                source: match['created-by'] || match.created_by || 'MyMemory',
            });
        }

        // Sort by quality descending
        translations.sort((a, b) => (parseFloat(b.quality) || 0) - (parseFloat(a.quality) || 0));
    }

    // If no matches, use the main translation
    if (translations.length === 0 && mainTranslation) {
        translations.push({
            pos: '',
            meaning: mainTranslation,
            quality: 100,
            source: 'MyMemory',
        });
    }

    // Deduplicate and limit to top 8 results
    return { translations: translations.slice(0, 8) };
}

/**
 * Map MyMemory subject/category to a part-of-speech abbreviation
 */
function mapSubjectToPos(subject) {
    if (!subject) return '';
    const s = subject.toLowerCase().trim();
    if (s === 'all' || s === 'general') return '';
    if (s.includes('noun') || s === 'n') return 'n.';
    if (s.includes('verb') || s === 'v') return 'v.';
    if (s.includes('adjective') || s === 'adj') return 'adj.';
    if (s.includes('adverb') || s === 'adv') return 'adv.';
    if (s.includes('preposition') || s === 'prep') return 'prep.';
    if (s.includes('pronoun') || s === 'pron') return 'pron.';
    if (s.includes('conjunction') || s === 'conj') return 'conj.';
    if (s.includes('interjection') || s === 'interj') return 'interj.';
    return '';
}

export const name = 'MyMemory';
export const requiresKey = false;
