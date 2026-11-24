import { getDb } from './database';
import { DEFAULT_PALETTE_ID } from '../theme/palettes';
import { readAnimationStyle, type AnimationStyle } from '../theme/animationPreferences';
import {
  DEFAULT_STUDIO_COLOR,
  DEFAULT_UI_STYLE,
  STUDIO_COMBOS,
  UI_STYLES,
  type StudioColorId,
  type UiStyle,
} from '../theme/studio';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  themeMode: ThemeMode;
  paletteId: string;
  amoledDark: boolean;
  highContrast: boolean;
  hapticsEnabled: boolean;
  animationStyle: AnimationStyle;
  /** Studio (taf.sh's default look), Material 3, or Plain. */
  uiStyle: UiStyle;
  /** Accent combo for Studio. */
  studioColor: StudioColorId;
  /** Show smart card fares first. */
  smartCard: boolean;
  /** Refresh the offline pack on open and when the connection returns. */
  offlineAutoSync: boolean;
  /** Only auto-sync on Wi-Fi. */
  offlineWifiOnly: boolean;
  /** First-launch questions answered or skipped. */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  paletteId: DEFAULT_PALETTE_ID,
  amoledDark: false,
  highContrast: false,
  hapticsEnabled: true,
  animationStyle: 'slide',
  uiStyle: DEFAULT_UI_STYLE,
  studioColor: DEFAULT_STUDIO_COLOR,
  smartCard: false,
  offlineAutoSync: true,
  offlineWifiOnly: false,
  onboarded: false,
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
    // Absent key means a settings row written before this option existed;
    // haptics were on then, so they stay on.
    hapticsEnabled: map.get('hapticsEnabled') !== 'false',
    animationStyle: readAnimationStyle(map.get('animationStyle')),
    uiStyle: UI_STYLES.includes(map.get('uiStyle') as UiStyle)
      ? (map.get('uiStyle') as UiStyle)
      : DEFAULT_SETTINGS.uiStyle,
    studioColor: STUDIO_COMBOS.some((combo) => combo.id === map.get('studioColor'))
      ? (map.get('studioColor') as StudioColorId)
      : DEFAULT_SETTINGS.studioColor,
    smartCard: map.get('smartCard') === 'true',
    offlineAutoSync: map.get('offlineAutoSync') !== 'false',
    offlineWifiOnly: map.get('offlineWifiOnly') === 'true',
    onboarded: map.get('onboarded') === 'true',
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
      ['hapticsEnabled', String(settings.hapticsEnabled)],
      ['animationStyle', settings.animationStyle],
      ['uiStyle', settings.uiStyle],
      ['studioColor', settings.studioColor],
      ['smartCard', String(settings.smartCard)],
      ['offlineAutoSync', String(settings.offlineAutoSync)],
      ['offlineWifiOnly', String(settings.offlineWifiOnly)],
      ['onboarded', String(settings.onboarded)],
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
