import { fetchJson } from '../infrastructure/http/fetch-client.js';
import { createDictionaryPrompt } from '../llm/dictionary-prompt.js';
import { finalizeLlmResult } from './llm-common.js';
import { readProviderJson, requireApiKey } from './provider-utils.js';

export async function lookup(request, config = {}, context = {}) {
  requireApiKey(config.claudeApiKey, 'Claude');
  const baseUrl = config.claudeBaseUrl.replace(/\/+$/u, '');
  const response = await fetchJson(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'x-api-key': config.claudeApiKey,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.claudeModel,
      max_tokens: 700,
      messages: [{ role: 'user', content: createDictionaryPrompt(request) }],
    }),
    signal: context.signal,
  });
  const data = await readProviderJson(response, 'Claude');
  const text = data.content?.filter((item) => item.type === 'text').map((item) => item.text).join('');
  return finalizeLlmResult(text, request, 'Claude');
}
