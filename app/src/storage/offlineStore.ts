import { getDb } from './database';

/**
 * One JSON document per cache key.
 *
 * The web build keeps the same documents in `localStorage`
 * (`offlineStore.web.ts`). Both sides expose this shape so the services never
 * branch on platform.
 */
export interface OfflineDocument<T> {
  payload: T;
  savedAt: number;
}

/**
 * SQLite backing for the offline catalog.
 *
 * Rows are whole JSON documents rather than normalised tables: the app only
 * ever reads a catalog back in the shape the API returned it, and a schema
 * per response type would drift from those types the moment one changes.
 */
interface OfflineRow {
  payload_json: string;
  saved_at: number;
}

const memory = new Map<string, OfflineDocument<unknown>>();

export const offlineStore = {
  async get<T>(key: string): Promise<OfflineDocument<T> | null> {
    const cached = memory.get(key) as OfflineDocument<T> | undefined;
    if (cached) return cached;

    const db = await getDb();
    const row = await db.getFirstAsync<OfflineRow>(
      'SELECT payload_json, saved_at FROM offline_documents WHERE cache_key = ? LIMIT 1',
      [key],
    );
    if (!row) {
      return null;
    }
    try {
      const document = { payload: JSON.parse(row.payload_json) as T, savedAt: row.saved_at };
      memory.set(key, document);
      return document;
    } catch {
      return null;
    }
  },

  async put<T>(key: string, payload: T): Promise<number> {
    const document: OfflineDocument<T> = { payload, savedAt: Date.now() };
    memory.set(key, document);
    const db = await getDb();
    await db.runAsync(
      `
      INSERT INTO offline_documents (cache_key, payload_json, saved_at)
      VALUES (?, ?, ?)
      ON CONFLICT(cache_key)
      DO UPDATE SET
        payload_json = excluded.payload_json,
        saved_at = excluded.saved_at
      `,
      [key, JSON.stringify(document.payload), document.savedAt],
    );
    return document.savedAt;
  },
};
