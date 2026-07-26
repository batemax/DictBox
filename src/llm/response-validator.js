import { DictBoxError } from '../core/errors.js';
import { normalizePartOfSpeech } from '../core/result-normalizer.js';
import {
  DICTIONARY_SCHEMA_VERSION,
  PARTS_OF_SPEECH,
} from './dictionary-schema.js';

const ROOT_KEYS = ['entries', 'query', 'schemaVersion', 'sourceLanguage', 'targetLanguage'];
const ENTRY_KEYS = ['meanings', 'partOfSpeech'];

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

export function parseJsonText(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '');
  try {
    return JSON.parse(withoutFence);
  } catch (error) {
    throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Model returned invalid JSON.', {
      cause: error,
    });
  }
}

export function validateDictionaryResult(value, expected) {
  const data = parseJsonText(value);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Dictionary result must be an object.');
  }
  if (!hasOnlyKeys(data, ROOT_KEYS)) {
    throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Dictionary result contains unknown fields.');
  }
  if (data.schemaVersion !== DICTIONARY_SCHEMA_VERSION) {
    throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Unsupported dictionary schema version.');
  }
  if (data.query !== expected.query || data.targetLanguage !== expected.targetLanguage) {
    throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Dictionary result does not match the request.');
  }
  if (typeof data.sourceLanguage !== 'string' || data.sourceLanguage.length < 2) {
    throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Invalid source language.');
  }
  if (!Array.isArray(data.entries) || data.entries.length < 1 || data.entries.length > 6) {
    throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Dictionary entries must contain 1 to 6 items.');
  }

  const entries = data.entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || !hasOnlyKeys(entry, ENTRY_KEYS)) {
      throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Invalid dictionary entry.');
    }
    const partOfSpeech = normalizePartOfSpeech(entry.partOfSpeech);
    if (!PARTS_OF_SPEECH.includes(partOfSpeech)) {
      throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Invalid part of speech.');
    }
    if (!Array.isArray(entry.meanings) || entry.meanings.length < 1 || entry.meanings.length > 4) {
      throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Meanings must contain 1 to 4 items.');
    }
    const meanings = entry.meanings.map((meaning) => {
      if (typeof meaning !== 'string' || !meaning.trim() || meaning.length > 80) {
        throw new DictBoxError('INVALID_MODEL_OUTPUT', 'Invalid dictionary meaning.');
      }
      return meaning.trim();
    });
    return { partOfSpeech, meanings: [...new Set(meanings)] };
  });

  return { ...data, entries };
}
