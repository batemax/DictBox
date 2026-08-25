import test from 'node:test';
import assert from 'node:assert/strict';
import { lookup } from '../src/providers/mock.js';

test('returns rich mock dictionary data without network access', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('mock provider must not call fetch');
  };

  try {
    const result = await lookup(
      { query: 'world', sourceLanguage: 'en', targetLanguage: 'zh-CN' },
      { mockDelayMs: 0 },
    );
    assert.equal(fetchCalls, 0);
    assert.equal(result.isMock, true);
    assert.equal(result.word, 'world');
    assert.equal(result.phonetic, '/wɜːrld/');
    assert.equal(result.entries[0].partOfSpeech, 'n.');
    assert.match(result.entries[0].meanings[0], /世界/u);
    assert.equal(result.translations[0].source, 'Mock');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns a typed no-result error for words outside the mock dictionary', async () => {
  await assert.rejects(
    lookup(
      { query: 'unknown', sourceLanguage: 'en', targetLanguage: 'zh-CN' },
      { mockDelayMs: 0 },
    ),
    { code: 'NO_RESULT' },
  );
});

test('supports cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    lookup(
      { query: 'world', sourceLanguage: 'en', targetLanguage: 'zh-CN' },
      { mockDelayMs: 0 },
      { signal: controller.signal },
    ),
    { code: 'REQUEST_ABORTED' },
  );
});

test('cancels an in-flight mock delay', async () => {
  const controller = new AbortController();
  const pending = lookup(
    { query: 'world', sourceLanguage: 'en', targetLanguage: 'zh-CN' },
    { mockDelayMs: 50 },
    { signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, { code: 'REQUEST_ABORTED' });
});
