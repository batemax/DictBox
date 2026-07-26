import { fetchJson } from '../infrastructure/http/fetch-client.js';
import { createDictionaryPrompt } from '../llm/dictionary-prompt.js';
import { finalizeLlmResult } from './llm-common.js';
import { readProviderJson, requireApiKey } from './provider-utils.js';

const RETRY_DELAYS_MS = [100, 300];

function waitForRetry(delayMs, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function lookupOnce(request, config, context) {
  const baseUrl = config.deepseekBaseUrl.replace(/\/+$/u, '');
  const response = await fetchJson(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.deepseekModel,
      messages: [{ role: 'user', content: createDictionaryPrompt(request) }],
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      max_tokens: 700,
      temperature: 0.1,
    }),
    signal: context.signal,
  });
  const data = await readProviderJson(response, 'DeepSeek');
  return finalizeLlmResult(data.choices?.[0]?.message?.content, request, 'DeepSeek');
}

export async function lookup(request, config = {}, context = {}) {
  requireApiKey(config.deepseekApiKey, 'DeepSeek');

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await lookupOnce(request, config, context);
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (!error.retryable || delay === undefined || context.signal?.aborted) throw error;
      await waitForRetry(delay, context.signal);
    }
  }
}
