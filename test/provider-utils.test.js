import test from 'node:test';
import assert from 'node:assert/strict';
import { readProviderJson } from '../src/providers/provider-utils.js';

test('includes a provider JSON error message in failed responses', async () => {
  const response = new Response(
    JSON.stringify({ error: { message: 'Prompt must contain the word JSON' } }),
    { status: 400, headers: { 'Content-Type': 'application/json' } },
  );

  await assert.rejects(
    readProviderJson(response, 'DeepSeek'),
    {
      code: 'PROVIDER_UNAVAILABLE',
      message: 'DeepSeek request failed (400): Prompt must contain the word JSON',
    },
  );
});

test('marks only governor authentication failures as retryable', async () => {
  const response = new Response('Authentication Fails (governor)', { status: 401 });

  await assert.rejects(
    readProviderJson(response, 'DeepSeek'),
    {
      code: 'AUTHENTICATION_FAILED',
      retryable: true,
    },
  );
});
