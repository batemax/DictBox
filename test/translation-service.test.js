import test from 'node:test';
import assert from 'node:assert/strict';
import { TranslationService } from '../src/core/translation-service.js';

test('returns a completed lookup without waiting for persistent cache writes', async () => {
  const expected = { translations: [{ pos: 'n.', meaning: '蜂蜜' }] };
  const service = new TranslationService({
    memoryCache: {
      get: () => null,
      set: () => {},
    },
    persistentCache: {
      get: async () => null,
      set: () => new Promise(() => {}),
    },
    providerLookup: async () => expected,
  });

  const result = await Promise.race([
    service.lookup(
      { query: 'honey', sourceLanguage: 'auto', targetLanguage: 'zh-CN' },
      { provider: 'deepseek', deepseekModel: 'deepseek-v4-flash' },
    ),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('lookup waited for the cache')), 100);
    }),
  ]);

  assert.deepEqual(result, expected);
});

test('does not cache fallback results under the primary provider key', async () => {
  let memoryWrites = 0;
  let persistentWrites = 0;
  const service = new TranslationService({
    memoryCache: {
      get: () => null,
      set: () => { memoryWrites += 1; },
    },
    persistentCache: {
      get: async () => null,
      set: async () => { persistentWrites += 1; },
    },
    providerLookup: async (provider) => {
      if (provider === 'deepseek') {
        throw Object.assign(new Error('DeepSeek unavailable'), {
          code: 'PROVIDER_UNAVAILABLE',
        });
      }
      return { translations: [{ pos: 'n.', meaning: '票' }] };
    },
  });

  const result = await service.lookup(
    { query: 'ticket', sourceLanguage: 'auto', targetLanguage: 'zh-CN' },
    {
      provider: 'deepseek',
      deepseekModel: 'deepseek-v4-flash',
      fallbackProvider: 'mymemory',
      enableFallback: true,
    },
  );

  assert.equal(result.translations[0].meaning, '票');
  assert.equal(memoryWrites, 0);
  assert.equal(persistentWrites, 0);
});

test('does not invoke fallback after the user cancels a lookup', async () => {
  const controller = new AbortController();
  let fallbackCalls = 0;
  const service = new TranslationService({
    memoryCache: {
      get: () => null,
      set: () => {},
    },
    persistentCache: {
      get: async () => null,
      set: async () => {},
    },
    providerLookup: async (provider) => {
      if (provider === 'deepseek') {
        controller.abort();
        throw Object.assign(new Error('cancelled'), { code: 'REQUEST_ABORTED' });
      }
      fallbackCalls += 1;
      return { translations: [{ pos: 'n.', meaning: '票' }] };
    },
  });

  await assert.rejects(
    service.lookup(
      { query: 'ticket', sourceLanguage: 'auto', targetLanguage: 'zh-CN' },
      {
        provider: 'deepseek',
        deepseekModel: 'deepseek-v4-flash',
        fallbackProvider: 'mymemory',
        enableFallback: true,
      },
      { signal: controller.signal },
    ),
    { code: 'REQUEST_ABORTED' },
  );
  assert.equal(fallbackCalls, 0);
});
