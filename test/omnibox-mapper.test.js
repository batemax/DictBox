import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeXml,
  formatFirefoxSummary,
  formatSuggestions,
} from '../src/core/omnibox-mapper.js';

test('escapes XML characters', () => {
  assert.equal(escapeXml('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;');
});

test('maps translations into Omnibox suggestions', () => {
  const suggestions = formatSuggestions({
    translations: [{ pos: 'adj.', meaning: '美丽的' }],
  }, 'beautiful');
  assert.equal(suggestions.length, 1);
  assert.match(suggestions[0].description, /adj\./u);
  assert.match(suggestions[0].description, /<match>美丽的<\/match>/u);
});

test('maps plain descriptions for Firefox', () => {
  const suggestions = formatSuggestions({
    translations: [{ pos: 'adj.', meaning: '美丽的' }],
  }, 'beautiful', { useMarkup: false });
  assert.equal(suggestions[0].description, 'adj. 美丽的');
});

test('summarizes Firefox meanings without suggestion content', () => {
  const description = formatFirefoxSummary({
    translations: [
      { pos: 'n.', meaning: '蝙蝠侠' },
      { pos: 'n.', meaning: '蝙蝠人' },
      { pos: 'adj.', meaning: '像蝙蝠的' },
    ],
  }, 'batman');

  assert.equal(description, 'n. 蝙蝠侠、蝙蝠人；adj. 像蝙蝠的');
  assert.doesNotMatch(description, /dictbox-result|— db/u);
});
