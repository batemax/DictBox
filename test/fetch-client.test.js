import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson } from '../src/infrastructure/http/fetch-client.js';

test('keeps the timeout active while reading the response body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, { signal }) => ({
    ok: true,
    status: 200,
    text: () => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }),
  });

  try {
    await assert.rejects(
      fetchJson('https://example.test', {}, 10),
      { code: 'REQUEST_TIMEOUT' },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not call fetch when the external signal is already aborted', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return Response.json({});
  };
  const controller = new AbortController();
  controller.abort();

  try {
    await assert.rejects(
      fetchJson('https://example.test', { signal: controller.signal }),
      { code: 'REQUEST_ABORTED' },
    );
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('distinguishes an in-flight external cancellation from a timeout', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, { signal }) => ({
    ok: true,
    status: 200,
    text: () => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }),
  });
  const controller = new AbortController();

  try {
    const request = fetchJson(
      'https://example.test',
      { signal: controller.signal },
      1_000,
    );
    controller.abort();
    await assert.rejects(request, { code: 'REQUEST_ABORTED' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
