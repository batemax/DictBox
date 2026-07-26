import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dictionaryResultToTranslations,
  normalizeTranslations,
} from '../src/core/result-normalizer.js';

test('normalizes part of speech and removes duplicate translations', () => {
  assert.deepEqual(
    normalizeTranslations([
      { pos: 'noun', meaning: '词典' },
      { pos: 'n.', meaning: '词典' },
      { pos: 'verb', meaning: '查询' },
    ]),
    {
      translations: [
        { pos: 'n.', meaning: '词典' },
        { pos: 'v.', meaning: '查询' },
      ],
    },
  );
});

test('flattens dictionary entries for Omnibox', () => {
  const result = dictionaryResultToTranslations({
    provider: 'Test',
    entries: [{ partOfSpeech: 'adj.', meanings: ['美丽的', '出色的'] }],
  });
  assert.equal(result.translations.length, 2);
  assert.equal(result.translations[0].source, 'Test');
});
