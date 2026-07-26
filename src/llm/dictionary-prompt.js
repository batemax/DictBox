import {
  DICTIONARY_SCHEMA_VERSION,
  PARTS_OF_SPEECH,
} from './dictionary-schema.js';

export function createDictionaryPrompt({ query, sourceLanguage, targetLanguage }) {
  const jsonExample = {
    schemaVersion: DICTIONARY_SCHEMA_VERSION,
    query,
    sourceLanguage,
    targetLanguage,
    entries: [
      {
        partOfSpeech: 'n.',
        meanings: ['translated meaning'],
      },
    ],
  };

  return [
    'You are DictBox, a dictionary data generator.',
    `Return schemaVersion "${DICTIONARY_SCHEMA_VERSION}" dictionary data as one valid JSON object only.`,
    'Do not return Markdown, commentary, or fields outside the supplied schema.',
    'Keep common, distinct meanings ordered by frequency.',
    'Use an empty partOfSpeech only when it cannot be determined reliably.',
    `partOfSpeech must be one of: ${JSON.stringify(PARTS_OF_SPEECH)}.`,
    `query: ${JSON.stringify(query)}`,
    `sourceLanguage: ${JSON.stringify(sourceLanguage)}`,
    `targetLanguage: ${JSON.stringify(targetLanguage)}`,
    `JSON shape example: ${JSON.stringify(jsonExample)}`,
  ].join('\n');
}
