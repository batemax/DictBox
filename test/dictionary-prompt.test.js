import test from 'node:test';
import assert from 'node:assert/strict';
import { createDictionaryPrompt } from '../src/llm/dictionary-prompt.js';

test('includes explicit JSON instructions and a matching shape example', () => {
  const prompt = createDictionaryPrompt({
    query: 'hello',
    sourceLanguage: 'en',
    targetLanguage: 'zh-CN',
  });

  assert.match(prompt, /valid JSON object/u);
  assert.match(prompt, /JSON shape example/u);
  assert.match(prompt, /"schemaVersion":"2\.0"/u);
  assert.match(prompt, /"query":"hello"/u);
});
