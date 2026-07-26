import { normalizeTranslations } from '../core/result-normalizer.js';
import { fetchJson } from '../infrastructure/http/fetch-client.js';
import { readProviderJson, requireApiKey } from './provider-utils.js';

const ENDPOINT = 'https://api.cognitive.microsofttranslator.com';

const headers = (config) => ({
  'Content-Type': 'application/json',
  'Ocp-Apim-Subscription-Key': config.microsoftApiKey,
  ...(config.microsoftRegion
    ? { 'Ocp-Apim-Subscription-Region': config.microsoftRegion }
    : {}),
});

async function translate(request, config, context) {
  const params = new URLSearchParams({
    'api-version': '3.0',
    to: request.targetLanguage,
  });
  if (request.sourceLanguage !== 'auto') params.set('from', request.sourceLanguage);
  const response = await fetchJson(`${ENDPOINT}/translate?${params}`, {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify([{ Text: request.query }]),
    signal: context.signal,
  });
  return readProviderJson(response, 'Microsoft Translator');
}

export async function lookup(request, config = {}, context = {}) {
  requireApiKey(config.microsoftApiKey, 'Microsoft Translator');
  const data = await translate(request, config, context);
  const candidates = data.flatMap((item) =>
    (item.translations ?? []).map((translation) => ({
      pos: '',
      meaning: translation.text,
      quality: 100,
      source: 'Microsoft Translator',
    })));
  return normalizeTranslations(candidates);
}
