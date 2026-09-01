import { readJson, writeJson } from './webStore';
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

const STORAGE_KEY = 'dmrc:appSettings';
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

function decode(stored: Partial<AppSettings> | null): AppSettings {
  if (!stored) {
    return DEFAULT_SETTINGS;
  }
  return {
    themeMode: THEME_MODES.includes(stored.themeMode as ThemeMode)
      ? (stored.themeMode as ThemeMode)
      : DEFAULT_SETTINGS.themeMode,
    paletteId: stored.paletteId || DEFAULT_SETTINGS.paletteId,
    amoledDark: stored.amoledDark === true,
    highContrast: stored.highContrast === true,
  };
}

export const appSettingsRepository = {
  async load(): Promise<AppSettings> {
    return decode(readJson<Partial<AppSettings>>(STORAGE_KEY));
  },

  async save(settings: AppSettings): Promise<void> {
    writeJson(STORAGE_KEY, settings);
  },
};
