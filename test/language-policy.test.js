import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSourceLanguage,
  resolveLanguagePair,
} from '../src/core/language-policy.js';

test('detects supported scripts', () => {
  assert.equal(detectSourceLanguage('hello'), 'auto');
  assert.equal(detectSourceLanguage('你好'), 'zh-CN');
  assert.equal(detectSourceLanguage('こんにちは'), 'ja');
  assert.equal(detectSourceLanguage('안녕하세요'), 'ko');
  assert.equal(detectSourceLanguage('привет'), 'ru');
});

test('reverses matching target language to English', () => {
  assert.deepEqual(resolveLanguagePair('你好', 'zh-CN'), {
    from: 'zh-CN',
    to: 'en',
  });
});
