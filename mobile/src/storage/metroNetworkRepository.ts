import { getDb } from './database';
import type { MetroNetwork } from '../network/NetworkContext';

const SETTING_KEY = 'metroNetwork';

interface SettingRow {
  value: string;
}

export const metroNetworkRepository = {
  async load(): Promise<MetroNetwork> {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<SettingRow>(
        'SELECT value FROM app_settings WHERE key = ? LIMIT 1',
        [SETTING_KEY],
      );
      return row?.value === 'nmrc' ? 'nmrc' : 'dmrc';
    } catch {
      return 'dmrc';
    }
  },

  async save(network: MetroNetwork): Promise<void> {
    try {
      const db = await getDb();
      await db.runAsync(
        'INSERT INTO app_settings (key, value) VALUES (?, ?) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [SETTING_KEY, network],
      );
    } catch {
      // Network switching should remain usable even if persistence fails.
    }
  },
};

