export const DICTIONARY_SCHEMA_VERSION = '2.0';
export const PROMPT_VERSION = '3';

export const PARTS_OF_SPEECH = Object.freeze([
  '',
  'n.',
  'v.',
  'adj.',
  'adv.',
  'pron.',
  'prep.',
  'conj.',
  'det.',
  'interj.',
  'phrase',
]);

export const DICTIONARY_JSON_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'query', 'sourceLanguage', 'targetLanguage', 'entries'],
  properties: {
    schemaVersion: { type: 'string', const: DICTIONARY_SCHEMA_VERSION },
    query: { type: 'string', minLength: 1 },
    sourceLanguage: { type: 'string', minLength: 2 },
    targetLanguage: { type: 'string', minLength: 2 },
    entries: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['partOfSpeech', 'meanings'],
        properties: {
          partOfSpeech: { type: 'string', enum: PARTS_OF_SPEECH },
          meanings: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string', minLength: 1, maxLength: 80 },
          },
        },
      },
    },
  },
});
