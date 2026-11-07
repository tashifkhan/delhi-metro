import { readJson, writeJson } from './webStore';

/**
 * One JSON document per cache key, held in `localStorage`.
 *
 * Native keeps the same documents in SQLite (`offlineStoreRepository.ts`).
 * Both sides expose this shape so the services never branch on platform.
 */
export interface OfflineDocument<T> {
  payload: T;
  savedAt: number;
}

const memory = new Map<string, OfflineDocument<unknown>>();

export const offlineStore = {
  async get<T>(key: string): Promise<OfflineDocument<T> | null> {
    const cached = memory.get(key) as OfflineDocument<T> | undefined;
    if (cached) return cached;

    const stored = readJson<OfflineDocument<T>>(`dmrc:offline:${key}`);
    if (!stored || typeof stored.savedAt !== 'number' || !('payload' in stored)) {
      return null;
    }
    memory.set(key, stored);
    return stored;
  },

  async put<T>(key: string, payload: T): Promise<number> {
    const document: OfflineDocument<T> = { payload, savedAt: Date.now() };
    memory.set(key, document);
    writeJson(`dmrc:offline:${key}`, document);
    return document.savedAt;
  },
};
