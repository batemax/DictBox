import { dictionaryResultToTranslations } from '../core/result-normalizer.js';
import { validateDictionaryResult } from '../llm/response-validator.js';

export function finalizeLlmResult(rawResult, request, provider) {
  const dictionary = validateDictionaryResult(rawResult, request);
  return {
    ...dictionary,
    word: dictionary.query,
    provider,
    ...dictionaryResultToTranslations({ ...dictionary, provider }),
  };
}
