import api from '../../browser/webextension-api.js';
import {
  DEFAULT_SECRETS,
  DEFAULT_SETTINGS,
  SENSITIVE_SETTING_KEYS,
} from '../../shared/settings.js';

export async function migrateSensitiveSettings() {
  const synced = await api.storage.sync.get(DEFAULT_SECRETS);
  const local = await api.storage.local.get(DEFAULT_SECRETS);
  const migrated = {};
  const keysToRemove = [];

  for (const key of SENSITIVE_SETTING_KEYS) {
    if (!local[key] && synced[key]) {
      migrated[key] = synced[key];
    }
    if (synced[key]) {
      keysToRemove.push(key);
    }
  }

  if (Object.keys(migrated).length > 0) {
    await api.storage.local.set(migrated);
  }
  if (keysToRemove.length > 0) {
    await api.storage.sync.remove(keysToRemove);
  }
}

export async function loadSettings() {
  await migrateSensitiveSettings();
  const [settings, secrets] = await Promise.all([
    api.storage.sync.get(DEFAULT_SETTINGS),
    api.storage.local.get(DEFAULT_SECRETS),
  ]);
  return { ...DEFAULT_SETTINGS, ...settings, ...DEFAULT_SECRETS, ...secrets };
}

export async function saveSettings(values) {
  const settings = {};
  const secrets = {};

  for (const [key, value] of Object.entries(values)) {
    if (SENSITIVE_SETTING_KEYS.includes(key)) {
      secrets[key] = value;
    } else if (key in DEFAULT_SETTINGS) {
      settings[key] = value;
    }
  }

  await Promise.all([
    api.storage.sync.set(settings),
    api.storage.local.set(secrets),
  ]);
}

export async function resetSettings() {
  await Promise.all([
    api.storage.sync.set(DEFAULT_SETTINGS),
    api.storage.local.set(DEFAULT_SECRETS),
  ]);
}
