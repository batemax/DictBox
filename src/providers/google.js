import { normalizeTranslations } from '../core/result-normalizer.js';
import { fetchJson } from '../infrastructure/http/fetch-client.js';
import { readProviderJson, requireApiKey } from './provider-utils.js';

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

export async function lookup(request, config = {}, context = {}) {
  requireApiKey(config.googleApiKey, 'Google Translate');
  const params = new URLSearchParams({
    key: config.googleApiKey,
    q: request.query,
    target: request.targetLanguage,
    format: 'text',
  });
  if (request.sourceLanguage !== 'auto') params.set('source', request.sourceLanguage);

  const response = await fetchJson(`${ENDPOINT}?${params}`, { signal: context.signal });
  const data = await readProviderJson(response, 'Google Translate');
  return normalizeTranslations((data.data?.translations ?? []).map((item) => ({
    pos: '',
    meaning: item.translatedText,
    quality: 100,
    source: 'Google Translate',
  })));
}
