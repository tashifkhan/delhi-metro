import { readJson, writeJson } from './webStore';
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
    // Absent key means settings written before this option existed; haptics
    // were on then, so they stay on.
    hapticsEnabled: stored.hapticsEnabled !== false,
    animationStyle: readAnimationStyle(stored.animationStyle),
    uiStyle: UI_STYLES.includes(stored.uiStyle as UiStyle)
      ? (stored.uiStyle as UiStyle)
      : DEFAULT_SETTINGS.uiStyle,
    studioColor: STUDIO_COMBOS.some((combo) => combo.id === stored.studioColor)
      ? (stored.studioColor as StudioColorId)
      : DEFAULT_SETTINGS.studioColor,
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
