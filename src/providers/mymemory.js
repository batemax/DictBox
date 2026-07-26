import { normalizeTranslations } from '../core/result-normalizer.js';
import { fetchJson } from '../infrastructure/http/fetch-client.js';
import { readProviderJson } from './provider-utils.js';

const ENDPOINT = 'https://api.mymemory.translated.net/get';

export async function lookup(request, config = {}, context = {}) {
  const from = request.sourceLanguage === 'auto' ? 'en' : request.sourceLanguage;
  const params = new URLSearchParams({
    q: request.query,
    langpair: `${from}|${request.targetLanguage}`,
  });
  if (config.mymemoryEmail) params.set('de', config.mymemoryEmail);

  const response = await fetchJson(`${ENDPOINT}?${params}`, { signal: context.signal });
  const data = await readProviderJson(response, 'MyMemory');
  const candidates = data.matches?.length
    ? data.matches.map((match) => ({
        pos: '',
        meaning: match.translation,
        quality: Number(match.quality) || 0,
        source: 'MyMemory',
      }))
    : [{
        pos: '',
        meaning: data.responseData?.translatedText,
        quality: 100,
        source: 'MyMemory',
      }];

  candidates.sort((a, b) => b.quality - a.quality);
  return normalizeTranslations(candidates);
}
