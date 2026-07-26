import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import {
  isDynamicThemeSupported,
  useMaterial3Theme,
} from '@pchmn/expo-material3-theme';
import {
  MD3DarkTheme,
  MD3LightTheme,
  adaptNavigationTheme,
  type MD3Theme,
} from 'react-native-paper';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { lightScheme, darkScheme } from './colors';
import { rgba } from './colorMath';
import {
  DYNAMIC_PALETTE_ID,
  buildScheme,
  paletteFromId,
  toAmoled,
  toHighContrast,
} from './palettes';
import {
  appSettingsRepository,
  DEFAULT_SETTINGS,
  type AppSettings,
} from '../storage/appSettingsRepository';

const IS_ANDROID_12_PLUS =
  Platform.OS === 'android' &&
  typeof Platform.Version === 'number' &&
  Platform.Version >= 31;
const DYNAMIC_THEME_AVAILABLE = IS_ANDROID_12_PLUS && isDynamicThemeSupported;
const FALLBACK_SOURCE_COLOR = '#005FAF';

function createPaperTheme(
  isDark: boolean,
  scheme: Partial<MD3Theme['colors']>,
): MD3Theme {
  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      ...scheme,
    },
  };
}

export const paperLightTheme: MD3Theme = createPaperTheme(false, lightScheme);
export const paperDarkTheme: MD3Theme = createPaperTheme(true, darkScheme);

/**
 * Semantic status roles. Deliberately fixed rather than palette-derived:
 * "disrupted" and "working lift" must stay legible as warning/success whatever
 * palette is chosen, so only accent roles follow the palette.
 */
export interface SemanticColors {
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;
  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;
  interchange: string;
  onInterchange: string;
  interchangeContainer: string;
  onInterchangeContainer: string;
}

/**
 * Named surface fills for recurring UI roles.
 *
 * Light and dark reach the same visual hierarchy by different means — light
 * leans on `surfaceVariant`/containers, dark on the tonal elevation ramp.
 * Resolving that once here keeps the choice consistent and stops the
 * `isDark ? level3 : surfaceVariant` ternary from being re-invented per file.
 */
export interface SurfaceFills {
  /** Inputs, inactive chips, item cards resting directly on the background. */
  subtle: string;
  /** Same role one level deeper — nested inside a card or sheet. */
  subtleStrong: string;
  /** Small badge sitting on top of a card; reads as punched-in. */
  inset: string;
  /** Tinted tile carrying the primary hue, for leading icons. */
  accentSubtle: string;
  /** Large hero card at the top of a screen. */
  hero: string;
  /** Translucent overlay chip layered on top of `hero`. */
  onHero: string;
  /** Primary text color legible against `hero`. */
  onHeroText: string;
  /** Selected segment inside a toggle group. */
  selected: string;
  /** Control floating above scrolling content (map zoom buttons). */
  floating: string;
  /**
   * Hairline that gives a card its edge.
   *
   * Elevation shadows are essentially invisible against a true-black
   * background, so in dark mode a card only reads as a distinct object if it
   * is outlined. In light mode the shadow already does that job and a border
   * would just add noise, so this goes transparent.
   */
  hairline: string;
}

function createFills(theme: MD3Theme, isDark: boolean): SurfaceFills {
  const { colors } = theme;
  return {
    subtle: isDark ? colors.elevation.level2 : colors.surfaceVariant,
    subtleStrong: isDark ? colors.elevation.level3 : colors.surfaceVariant,
    // Light `surface` equals `background`, which would make an inset badge
    // vanish against the card it sits on — `surfaceVariant` keeps the step.
    inset: isDark ? colors.elevation.level5 : colors.surfaceVariant,
    accentSubtle: isDark ? colors.elevation.level4 : colors.primaryContainer,
    hero: isDark ? colors.elevation.level3 : colors.primaryContainer,
    onHero: isDark ? colors.elevation.level5 : 'rgba(255, 255, 255, 0.72)',
    onHeroText: isDark ? colors.onSurface : colors.onPrimaryContainer,
    selected: isDark ? colors.primaryContainer : colors.surface,
    floating: isDark ? colors.elevation.level4 : colors.surface,
    hairline: isDark ? rgba(colors.outlineVariant, 0.55) : 'transparent',
  };
}

interface AppTheme {
  paperTheme: MD3Theme;
  navTheme: NavigationTheme;
  isDark: boolean;
  semantic: SemanticColors;
  fills: SurfaceFills;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** False until stored settings have been read, to avoid a theme flash. */
  settingsLoaded: boolean;
  /** Whether this device can source colors from the wallpaper. */
  dynamicAvailable: boolean;
}

const ThemeContext = createContext<AppTheme>({
  paperTheme: paperLightTheme,
  navTheme: NavigationDefaultTheme,
  isDark: false,
  semantic: lightScheme,
  fills: createFills(paperLightTheme, false),
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  settingsLoaded: false,
  dynamicAvailable: DYNAMIC_THEME_AVAILABLE,
});

function createNavigationTheme(
  base: NavigationTheme,
  theme: MD3Theme,
  isDark: boolean,
): NavigationTheme {
  return {
    ...base,
    colors: {
      ...base.colors,
      background: theme.colors.background,
      card: isDark ? theme.colors.elevation.level2 : theme.colors.surface,
      text: theme.colors.onSurface,
      border: theme.colors.outlineVariant,
      primary: theme.colors.primary,
    },
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { theme: materialTheme } = useMaterial3Theme({
    fallbackSourceColor: FALLBACK_SOURCE_COLOR,
  });

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    appSettingsRepository.load().then((stored) => {
      if (!active) return;
      setSettings(stored);
      setSettingsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    // Apply optimistically so the UI repaints on tap; the write is a
    // background concern and must not make the toggle feel laggy.
    setSettings((current) => {
      const next = { ...current, ...patch };
      void appSettingsRepository.save(next);
      return next;
    });
  }, []);

  const value = useMemo<AppTheme>(() => {
    const isDark =
      settings.themeMode === 'system'
        ? systemScheme === 'dark'
        : settings.themeMode === 'dark';

    const palette = paletteFromId(settings.paletteId);
    const useDynamic = palette.id === DYNAMIC_PALETTE_ID && DYNAMIC_THEME_AVAILABLE;

    // Wallpaper mode keeps the tonal surfaces Material You generates. Forcing
    // them to black here would make the AMOLED setting a no-op in this mode —
    // pure black is the toggle's job, not the palette's.
    let scheme: Partial<MD3Theme['colors']> = useDynamic
      ? isDark
        ? materialTheme.dark
        : materialTheme.light
      : buildScheme(palette, isDark);

    if (isDark && settings.amoledDark) {
      scheme = toAmoled(scheme);
    }
    if (settings.highContrast) {
      scheme = toHighContrast(scheme, isDark);
    }

    const activeTheme = createPaperTheme(isDark, scheme);

    // adaptNavigationTheme wants both, so pair the active theme with a plain
    // counterpart rather than rebuilding the unused side from the palette.
    const { LightTheme: navLight, DarkTheme: navDark } = adaptNavigationTheme({
      reactNavigationLight: NavigationDefaultTheme,
      reactNavigationDark: NavigationDarkTheme,
      materialLight: isDark ? paperLightTheme : activeTheme,
      materialDark: isDark ? activeTheme : paperDarkTheme,
    });

    return {
      paperTheme: activeTheme,
      navTheme: createNavigationTheme(isDark ? navDark : navLight, activeTheme, isDark),
      isDark,
      semantic: isDark ? darkScheme : lightScheme,
      fills: createFills(activeTheme, isDark),
      settings,
      updateSettings,
      settingsLoaded,
      dynamicAvailable: DYNAMIC_THEME_AVAILABLE,
    };
  }, [
    materialTheme.dark,
    materialTheme.light,
    systemScheme,
    settings,
    settingsLoaded,
    updateSettings,
  ]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export const themeRuntimeConfig = {
  isAndroid12Plus: IS_ANDROID_12_PLUS,
  shouldUseDynamicTheme: DYNAMIC_THEME_AVAILABLE,
  fallbackSourceColor: FALLBACK_SOURCE_COLOR,
} as const;
