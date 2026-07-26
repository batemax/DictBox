import api from '../../browser/webextension-api.js';

const STORAGE_KEY = '_dictbox_cache_v2';

export class PersistentCache {
  constructor({ maxSize = 500, ttlMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  async get(key) {
    const stored = await api.storage.local.get({ [STORAGE_KEY]: {} });
    const entry = stored[STORAGE_KEY]?.[key];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) return null;
    return entry.value;
  }

  async set(key, value) {
    const stored = await api.storage.local.get({ [STORAGE_KEY]: {} });
    const cache = stored[STORAGE_KEY] ?? {};
    cache[key] = { value, timestamp: Date.now() };

    const keys = Object.keys(cache);
    if (keys.length > this.maxSize) {
      keys
        .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
        .slice(0, keys.length - this.maxSize)
        .forEach((expiredKey) => delete cache[expiredKey]);
    }

    await api.storage.local.set({ [STORAGE_KEY]: cache });
  }
}
