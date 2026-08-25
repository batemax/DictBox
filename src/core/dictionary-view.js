import { LANGUAGE_LABELS } from '../shared/settings.js';

const PART_LABELS = Object.freeze({
  'n.': '名词',
  'v.': '动词',
  'adj.': '形容词',
  'adv.': '副词',
  'pron.': '代词',
  'prep.': '介词',
  'conj.': '连词',
  'det.': '限定词',
  'interj.': '感叹词',
  phrase: '短语',
});

export function partLabel(value) {
  return (PART_LABELS[value] ?? value) || '释义';
}

export function toDictionaryView(result, query = '') {
  const fallbackEntries = new Map();
  for (const translation of result?.translations ?? []) {
    const partOfSpeech = translation.pos || '';
    const meanings = fallbackEntries.get(partOfSpeech) ?? [];
    meanings.push(String(translation.meaning ?? '').trim());
    fallbackEntries.set(partOfSpeech, meanings.filter(Boolean));
  }

  const rawEntries = Array.isArray(result?.entries) && result.entries.length > 0
    ? result.entries
    : [...fallbackEntries.entries()].map(([partOfSpeech, meanings]) => ({
        partOfSpeech,
        meanings,
      }));

  const groupedEntries = new Map();
  for (const entry of rawEntries) {
    const partOfSpeech = String(entry.partOfSpeech || '');
    const meanings = groupedEntries.get(partOfSpeech) ?? [];
    for (const meaning of entry.meanings ?? []) {
      const normalized = String(meaning).trim();
      if (normalized && !meanings.some((value) => value.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
        meanings.push(normalized);
      }
    }
    groupedEntries.set(partOfSpeech, meanings);
  }

  return {
    word: String(result?.word || result?.query || query).trim(),
    phonetic: String(result?.phonetic || '').trim(),
    sourceLanguage: String(result?.sourceLanguage || 'auto'),
    targetLanguage: String(result?.targetLanguage || 'zh-CN'),
    entries: [...groupedEntries.entries()]
      .map(([partOfSpeech, meanings]) => ({ partOfSpeech, meanings }))
      .filter((entry) => entry.meanings.length > 0),
    example: String(result?.example || '').trim(),
    exampleTranslation: String(result?.exampleTranslation || '').trim(),
    provider: String(result?.provider || result?.translations?.[0]?.source || ''),
    isMock: Boolean(result?.isMock),
  };
}

export function formatDictionaryText(view) {
  const definitions = view.entries.map((entry) =>
    `${partLabel(entry.partOfSpeech)}: ${entry.meanings.join('；')}`,
  );
  return [
    `${view.word}${view.phonetic ? ` ${view.phonetic}` : ''}`,
    ...definitions,
    view.example,
    view.exampleTranslation,
  ].filter(Boolean).join('\n');
}

export function languageLabel(code) {
  return LANGUAGE_LABELS[code] ?? code;
}
