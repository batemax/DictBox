import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDictionaryResult } from '../src/llm/response-validator.js';

const request = {
  query: 'beautiful',
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
};

const validResult = {
  schemaVersion: '2.0',
  query: 'beautiful',
  sourceLanguage: 'en',
  targetLanguage: 'zh-CN',
  entries: [{ partOfSpeech: 'adj.', meanings: ['美丽的'] }],
};

test('accepts a valid dictionary result', () => {
  assert.deepEqual(validateDictionaryResult(validResult, request), validResult);
});

test('accepts JSON wrapped in one Markdown fence', () => {
  const wrapped = `\`\`\`json\n${JSON.stringify(validResult)}\n\`\`\``;
  assert.deepEqual(validateDictionaryResult(wrapped, request), validResult);
});

test('rejects unknown fields', () => {
  assert.throws(
    () => validateDictionaryResult({ ...validResult, commentary: 'hello' }, request),
    { code: 'INVALID_MODEL_OUTPUT' },
  );
});

test('rejects mismatched queries', () => {
  assert.throws(
    () => validateDictionaryResult({ ...validResult, query: 'other' }, request),
    { code: 'INVALID_MODEL_OUTPUT' },
  );
});

test('normalizes common part-of-speech aliases before validation', () => {
  const result = validateDictionaryResult({
    ...validResult,
    entries: [{ partOfSpeech: 'noun', meanings: ['美人'] }],
  }, request);

  assert.equal(result.entries[0].partOfSpeech, 'n.');
});
