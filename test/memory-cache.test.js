import test from 'node:test';
import assert from 'node:assert/strict';
import { LruCache } from '../src/infrastructure/cache/memory-cache.js';

test('evicts the least recently used entry', () => {
  const cache = new LruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.get('b'), null);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
});
