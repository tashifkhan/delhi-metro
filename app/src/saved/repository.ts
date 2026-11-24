import { getDb } from '../storage/database';
import { decodeSaved, EMPTY_SAVED, type SavedState } from './model';

const KEY = 'saved';

/** Saved trips and places as one JSON value in the settings table. */
export const savedRepository = {
  async load(): Promise<SavedState> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        KEY,
      );
      return row ? decodeSaved(JSON.parse(row.value)) : EMPTY_SAVED;
    } catch {
      return EMPTY_SAVED;
    }
  },

  async save(state: SavedState): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      KEY,
      JSON.stringify(state),
    );
  },
};
