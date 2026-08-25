import test from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
const createdTabs = [];
const defaultSuggestions = [];

function event(name) {
  return {
    addListener(listener) {
      listeners[name] = listener;
    },
  };
}

globalThis.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://dictbox-test/${path}`,
    onMessage: event('runtime:onMessage'),
  },
  storage: {
    sync: {
      get: async (defaults) => ({ ...defaults, useMockData: true }),
      set: async () => {},
      remove: async () => {},
    },
    local: {
      get: async (defaults) => ({ ...defaults }),
      set: async () => {},
      remove: async () => {},
    },
    onChanged: event('storage:onChanged'),
  },
  omnibox: {
    onInputStarted: event('omnibox:onInputStarted'),
    onInputChanged: event('omnibox:onInputChanged'),
    onInputCancelled: event('omnibox:onInputCancelled'),
    onInputEntered: event('omnibox:onInputEntered'),
    setDefaultSuggestion: async (suggestion) => {
      defaultSuggestions.push(suggestion);
    },
  },
  tabs: {
    create: async (details) => {
      createdTabs.push(details);
      return details;
    },
  },
};

const { resolveLookupRequest } = await import('../src/background/index.js');

test('background reverses automatic Chinese queries to English', () => {
  assert.deepEqual(resolveLookupRequest('你好', {
    sourceLang: 'auto',
    targetLang: 'zh-CN',
  }), {
    query: '你好',
    sourceLanguage: 'zh-CN',
    targetLanguage: 'en',
  });
});

test('background returns mock results through the extension message channel', async () => {
  const response = await new Promise((resolve) => {
    const keepChannelOpen = listeners['runtime:onMessage'](
      { type: 'dictbox:lookup', query: 'world' },
      {},
      resolve,
    );
    assert.equal(keepChannelOpen, true);
  });

  assert.equal(response.ok, true);
  assert.equal(response.result.word, 'world');
  assert.equal(response.result.isMock, true);
});

test('background maps no-result errors to a safe public response', async () => {
  const response = await new Promise((resolve) => {
    listeners['runtime:onMessage'](
      { type: 'dictbox:lookup', query: 'missing' },
      {},
      resolve,
    );
  });

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'NO_RESULT');
  assert.doesNotMatch(response.error.message, /stack|api.?key=/iu);
});

test('omnibox Enter opens the internal result page', async () => {
  listeners['omnibox:onInputEntered']('design');
  await Promise.resolve();
  assert.deepEqual(createdTabs.at(-1), {
    url: 'chrome-extension://dictbox-test/result.html?word=design',
  });
});

test('omnibox uses a short query debounce and returns mock suggestions', async () => {
  let suggestions = [];
  listeners['omnibox:onInputChanged']('resilient', (next) => { suggestions = next; });
  await new Promise((resolve) => setTimeout(resolve, 750));
  assert.ok(defaultSuggestions.some(({ description }) => /resilient/u.test(description)));
  assert.ok(defaultSuggestions.some(({ description }) => /有复原力/u.test(description)));
  assert.ok(Array.isArray(suggestions));
});

test('omnibox accepts a single-character query', async () => {
  const before = defaultSuggestions.length;
  listeners['omnibox:onInputChanged']('a', () => {});
  await new Promise((resolve) => setTimeout(resolve, 750));
  const updates = defaultSuggestions.slice(before);
  assert.ok(updates.length > 0);
  assert.ok(updates.every(({ description }) => !/继续输入/u.test(description)));
});
