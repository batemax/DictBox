import test from 'node:test';
import assert from 'node:assert/strict';
import { lookup } from '../src/providers/deepseek.js';

test('retries transient governor authentication failures', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response('Authentication Fails (governor)', { status: 401 });
    }
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            schemaVersion: '2.0',
            query: 'ticket',
            sourceLanguage: 'auto',
            targetLanguage: 'zh-CN',
            entries: [{ partOfSpeech: 'n.', meanings: ['票'] }],
          }),
        },
      }],
    });
  };

  try {
    const result = await lookup(
      { query: 'ticket', sourceLanguage: 'auto', targetLanguage: 'zh-CN' },
      {
        deepseekApiKey: 'sk-test',
        deepseekBaseUrl: 'https://api.deepseek.com',
        deepseekModel: 'deepseek-v4-flash',
      },
    );
    assert.equal(callCount, 2);
    assert.equal(result.translations[0].meaning, '票');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
