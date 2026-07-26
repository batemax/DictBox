import { fetchJson } from '../infrastructure/http/fetch-client.js';
import { DICTIONARY_JSON_SCHEMA } from '../llm/dictionary-schema.js';
import { createDictionaryPrompt } from '../llm/dictionary-prompt.js';
import { finalizeLlmResult } from './llm-common.js';
import { readProviderJson, requireApiKey } from './provider-utils.js';

export async function lookup(request, config = {}, context = {}) {
  requireApiKey(config.openaiApiKey, 'OpenAI');
  const baseUrl = config.openaiBaseUrl.replace(/\/+$/u, '');
  const response = await fetchJson(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openaiModel,
      input: createDictionaryPrompt(request),
      max_output_tokens: 700,
      text: {
        format: {
          type: 'json_schema',
          name: 'dictbox_dictionary_result',
          strict: true,
          schema: DICTIONARY_JSON_SCHEMA,
        },
      },
    }),
    signal: context.signal,
  });
  const data = await readProviderJson(response, 'OpenAI');
  const outputText =
    data.output_text ??
    data.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === 'output_text')
      ?.text;
  return finalizeLlmResult(outputText, request, 'OpenAI');
}
