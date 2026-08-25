import api from '../../browser/webextension-api.js';

export const HISTORY_KEY = '_dictbox_recent_queries_v3';
export const HISTORY_LIMIT = 5;

export function mergeHistory(history, query, limit = HISTORY_LIMIT) {
  const normalized = String(query ?? '').trim().toLocaleLowerCase();
  if (!normalized) return [...history].slice(0, limit);
  return [normalized, ...history.filter((item) => item !== normalized)].slice(0, limit);
}

export async function getHistory() {
  const stored = await api.storage.local.get({ [HISTORY_KEY]: [] });
  return Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
}

export async function addHistory(query) {
  const next = mergeHistory(await getHistory(), query);
  await api.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}

export async function clearHistory() {
  await api.storage.local.set({ [HISTORY_KEY]: [] });
}

export async function setHistory(history) {
  const next = Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [];
  await api.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}

export async function removeHistory(query) {
  const normalized = String(query ?? '').trim().toLocaleLowerCase();
  return setHistory((await getHistory()).filter((item) => item !== normalized));
}
