const POS_ALIASES = new Map([
  ['noun', 'n.'],
  ['n', 'n.'],
  ['verb', 'v.'],
  ['v', 'v.'],
  ['adjective', 'adj.'],
  ['adj', 'adj.'],
  ['adverb', 'adv.'],
  ['adv', 'adv.'],
  ['pronoun', 'pron.'],
  ['preposition', 'prep.'],
  ['conjunction', 'conj.'],
  ['determiner', 'det.'],
  ['interjection', 'interj.'],
  ['phrase', 'phrase'],
]);

export function normalizePartOfSpeech(value = '') {
  const normalized = String(value).trim().toLowerCase().replace(/\.$/u, '');
  return POS_ALIASES.get(normalized) ?? (value === '' ? '' : String(value).trim());
}

export function normalizeTranslations(translations, limit = 8) {
  const seen = new Set();
  const result = [];

  for (const translation of translations ?? []) {
    const meaning = String(translation.meaning ?? '').trim();
    const pos = normalizePartOfSpeech(translation.pos);
    if (!meaning) continue;
    const key = `${pos}\u0000${meaning.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...translation, pos, meaning });
    if (result.length >= limit) break;
  }

  return { translations: result };
}

export function dictionaryResultToTranslations(result) {
  const translations = [];
  for (const entry of result.entries) {
    for (const meaning of entry.meanings) {
      translations.push({
        pos: entry.partOfSpeech,
        meaning,
        quality: 100,
        source: result.provider ?? 'LLM',
      });
    }
  }
  return normalizeTranslations(translations);
}
