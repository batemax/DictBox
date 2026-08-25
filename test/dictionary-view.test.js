import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDictionaryText,
  languageLabel,
  partLabel,
  toDictionaryView,
} from '../src/core/dictionary-view.js';

test('creates a dictionary view from rich results', () => {
  const view = toDictionaryView({
    query: 'world',
    phonetic: '/wɜːrld/',
    sourceLanguage: 'en',
    targetLanguage: 'zh-CN',
    entries: [{ partOfSpeech: 'n.', meanings: ['世界'] }],
    example: 'Hello, world.',
    exampleTranslation: '你好，世界。',
    isMock: true,
  });
  assert.equal(view.word, 'world');
  assert.equal(view.entries[0].meanings[0], '世界');
  assert.equal(view.isMock, true);
  assert.match(formatDictionaryText(view), /名词: 世界/u);
});

test('groups legacy translations into dictionary entries', () => {
  const view = toDictionaryView({
    translations: [
      { pos: 'n.', meaning: '设计' },
      { pos: 'n.', meaning: '方案' },
      { pos: 'v.', meaning: '规划' },
    ],
  }, 'design');
  assert.deepEqual(view.entries, [
    { partOfSpeech: 'n.', meanings: ['设计', '方案'] },
    { partOfSpeech: 'v.', meanings: ['规划'] },
  ]);
});

test('merges repeated rich-result part-of-speech groups', () => {
  const view = toDictionaryView({
    entries: [
      { partOfSpeech: 'n.', meanings: ['超人', '英雄'] },
      { partOfSpeech: 'n.', meanings: ['英雄', '强者'] },
    ],
  }, 'superman');
  assert.deepEqual(view.entries, [
    { partOfSpeech: 'n.', meanings: ['超人', '英雄', '强者'] },
  ]);
});

test('provides localized labels', () => {
  assert.equal(partLabel('adj.'), '形容词');
  assert.equal(partLabel(''), '释义');
  assert.equal(languageLabel('zh-CN'), '简体中文');
});
