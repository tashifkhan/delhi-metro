import { getDb } from './database';
import { DEFAULT_PALETTE_ID } from '../theme/palettes';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  themeMode: ThemeMode;
  paletteId: string;
  amoledDark: boolean;
  highContrast: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  paletteId: DEFAULT_PALETTE_ID,
  amoledDark: false,
  highContrast: false,
};

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

interface SettingRow {
  key: string;
  value: string;
}

/**
 * Settings live in a key-value table rather than a fixed-column row so adding
 * a preference later needs no migration — unknown keys are ignored and missing
 * ones fall back to `DEFAULT_SETTINGS`.
 */
function decode(rows: SettingRow[]): AppSettings {
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const themeMode = map.get('themeMode');
  const paletteId = map.get('paletteId');

  return {
    themeMode: THEME_MODES.includes(themeMode as ThemeMode)
      ? (themeMode as ThemeMode)
      : DEFAULT_SETTINGS.themeMode,
    paletteId: paletteId || DEFAULT_SETTINGS.paletteId,
    amoledDark: map.get('amoledDark') === 'true',
    highContrast: map.get('highContrast') === 'true',
  };
}

export const appSettingsRepository = {
  async load(): Promise<AppSettings> {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<SettingRow>('SELECT key, value FROM app_settings');
      return decode(rows);
    } catch {
      // A settings read must never keep the app from starting.
      return DEFAULT_SETTINGS;
    }
  },

  async save(settings: AppSettings): Promise<void> {
    const db = await getDb();
    const entries: [string, string][] = [
      ['themeMode', settings.themeMode],
      ['paletteId', settings.paletteId],
      ['amoledDark', String(settings.amoledDark)],
      ['highContrast', String(settings.highContrast)],
    ];

    await db.withTransactionAsync(async () => {
      for (const [key, value] of entries) {
        await db.runAsync(
          'INSERT INTO app_settings (key, value) VALUES (?, ?) ' +
            'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          key,
          value,
        );
      }
    });
  },
};
