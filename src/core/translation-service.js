import { DICTIONARY_SCHEMA_VERSION, PROMPT_VERSION } from '../llm/dictionary-schema.js';
import { lookupWithProvider } from '../providers/registry.js';
import { isLlmProvider } from '../shared/settings.js';

export class TranslationService {
  constructor({ memoryCache, persistentCache, providerLookup = lookupWithProvider }) {
    this.memoryCache = memoryCache;
    this.persistentCache = persistentCache;
    this.providerLookup = providerLookup;
  }

  createCacheKey(provider, settings, request) {
    const model = isLlmProvider(provider) ? settings[`${provider}Model`] : 'default';
    return [
      provider,
      model,
      DICTIONARY_SCHEMA_VERSION,
      PROMPT_VERSION,
      request.sourceLanguage,
      request.targetLanguage,
      request.query.toLocaleLowerCase(),
    ].join(':');
  }

  async lookup(request, settings, context = {}) {
    const key = this.createCacheKey(settings.provider, settings, request);
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult) return memoryResult;

    const persistentResult = await this.persistentCache.get(key);
    if (persistentResult) {
      this.memoryCache.set(key, persistentResult);
      return persistentResult;
    }

    let result;
    let usedFallback = false;
    try {
      result = await this.providerLookup(settings.provider, request, settings, context);
    } catch (error) {
      const wasCancelled =
        context.signal?.aborted ||
        error.code === 'REQUEST_ABORTED' ||
        error.name === 'AbortError';
      const canFallback =
        !wasCancelled &&
        settings.enableFallback &&
        settings.fallbackProvider &&
        settings.fallbackProvider !== settings.provider &&
        !['AUTHENTICATION_FAILED', 'MISSING_API_KEY'].includes(error.code);
      if (!canFallback) throw error;
      result = await this.providerLookup(
        settings.fallbackProvider,
        request,
        settings,
        context,
      );
      usedFallback = true;
    }

    if (!usedFallback) {
      this.memoryCache.set(key, result);
      void this.persistentCache.set(key, result).catch(() => {
        // Cache failures must not block a completed translation from reaching Omnibox.
      });
    }
    return result;
  }
}
