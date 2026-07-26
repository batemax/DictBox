import { fetchJson } from '../infrastructure/http/fetch-client.js';
import { DICTIONARY_JSON_SCHEMA } from '../llm/dictionary-schema.js';
import { createDictionaryPrompt } from '../llm/dictionary-prompt.js';
import { finalizeLlmResult } from './llm-common.js';
import { readProviderJson, requireApiKey } from './provider-utils.js';

export async function lookup(request, config = {}, context = {}) {
  requireApiKey(config.geminiApiKey, 'Gemini');
  const model = encodeURIComponent(config.geminiModel);
  const baseUrl = config.geminiBaseUrl.replace(/\/+$/u, '');
  const response = await fetchJson(
    `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: createDictionaryPrompt(request) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: DICTIONARY_JSON_SCHEMA,
          maxOutputTokens: 700,
        },
      }),
      signal: context.signal,
    },
  );
  const data = await readProviderJson(response, 'Gemini');
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
  return finalizeLlmResult(text, request, 'Gemini');
}
