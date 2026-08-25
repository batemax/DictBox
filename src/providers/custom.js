import { fetchJson } from '../infrastructure/http/fetch-client.js';
import { createDictionaryPrompt } from '../llm/dictionary-prompt.js';
import { finalizeLlmResult } from './llm-common.js';
import { readProviderJson, requireApiKey } from './provider-utils.js';

export async function lookup(request, config = {}, context = {}) {
  requireApiKey(config.customApiKey, '自定义服务商');
  const baseUrl = config.customBaseUrl.replace(/\/+$/u, '');
  const response = await fetchJson(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.customApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.customModel,
      messages: [{ role: 'user', content: createDictionaryPrompt(request) }],
      response_format: { type: 'json_object' },
    }),
    signal: context.signal,
  });
  const data = await readProviderJson(response, '自定义服务商');
  return finalizeLlmResult(data.choices?.[0]?.message?.content, request, '自定义服务商');
}
