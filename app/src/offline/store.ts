import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from '../storage/database';
import { isPackMeta, type PackMeta } from './model';

const FILE = `${FileSystem.documentDirectory ?? ''}offline-pack.json`;
const META_KEY = 'offlinePack';

/**
 * The pack body is a file in the app's documents folder, which the system
 * keeps until the app is removed. Its description sits in the settings
 * table so it can be read without opening the file.
 */
export const packStore = {
  async readMeta(): Promise<PackMeta | null> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', META_KEY);
      const parsed = row ? JSON.parse(row.value) : null;
      return isPackMeta(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async readBody(): Promise<string | null> {
    try {
      const info = await FileSystem.getInfoAsync(FILE);
      return info.exists ? await FileSystem.readAsStringAsync(FILE) : null;
    } catch {
      return null;
    }
  },

  async write(body: string, meta: PackMeta): Promise<void> {
    // Body first: a crash between the two writes leaves the old description
    // pointing at a newer body, which the next sync simply replaces.
    await FileSystem.writeAsStringAsync(FILE, body);
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      META_KEY,
      JSON.stringify(meta),
    );
  },

  async clear(): Promise<void> {
    await FileSystem.deleteAsync(FILE, { idempotent: true }).catch(() => undefined);
    const db = await getDb();
    await db.runAsync('DELETE FROM app_settings WHERE key = ?', META_KEY);
  },
};
