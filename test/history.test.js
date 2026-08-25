import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.chrome = {
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {},
    },
  },
};

const { mergeHistory } = await import('../src/infrastructure/history/history-repository.js');

test('moves a repeated query to the front and keeps five entries', () => {
  assert.deepEqual(
    mergeHistory(['world', 'design', 'resilient', 'hello', 'test'], 'DESIGN'),
    ['design', 'world', 'resilient', 'hello', 'test'],
  );
});

test('normalizes and truncates history', () => {
  assert.deepEqual(
    mergeHistory(['a', 'b', 'c', 'd', 'e'], '  New  '),
    ['new', 'a', 'b', 'c', 'd'],
  );
});
