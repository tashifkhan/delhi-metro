import { createContext, useContext, useMemo, type ReactNode } from 'react';
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
import { lightScheme, darkScheme, darkSurfaceIdentity } from './colors';

const IS_ANDROID_12_PLUS =
  Platform.OS === 'android' &&
  typeof Platform.Version === 'number' &&
  Platform.Version >= 31;
const SHOULD_USE_DYNAMIC_THEME = IS_ANDROID_12_PLUS && isDynamicThemeSupported;
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
 * Semantic status roles. Deliberately fixed rather than wallpaper-derived:
 * "disrupted" and "working lift" must stay legible as warning/success even
 * when Material You swings the accent hue, so only accent roles go dynamic.
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
  };
}

interface AppTheme {
  paperTheme: MD3Theme;
  navTheme: NavigationTheme;
  isDark: boolean;
  semantic: SemanticColors;
  fills: SurfaceFills;
}

const ThemeContext = createContext<AppTheme>({
  paperTheme: paperLightTheme,
  navTheme: NavigationDefaultTheme,
  isDark: false,
  semantic: lightScheme,
  fills: createFills(paperLightTheme, false),
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
  const scheme = useColorScheme();
  const { theme: materialTheme } = useMaterial3Theme({
    fallbackSourceColor: FALLBACK_SOURCE_COLOR,
  });

  const value = useMemo<AppTheme>(() => {
    const isDark = scheme === 'dark';

    const lightMaterialScheme: Partial<MD3Theme['colors']> =
      SHOULD_USE_DYNAMIC_THEME ? materialTheme.light : lightScheme;

    // Dynamic dark keeps the wallpaper-derived accents and tonal ramp, but the
    // true-black background/surface are forced back on: they are the app's
    // dark-mode identity, and the library's default dark greys wash it out.
    const darkMaterialScheme: Partial<MD3Theme['colors']> =
      SHOULD_USE_DYNAMIC_THEME
        ? {
            ...materialTheme.dark,
            background: darkSurfaceIdentity.background,
            surface: darkSurfaceIdentity.surface,
          }
        : darkScheme;

    const materialLightTheme = createPaperTheme(false, lightMaterialScheme);
    const materialDarkTheme = createPaperTheme(true, darkMaterialScheme);

    const { LightTheme: navLight, DarkTheme: navDark } = adaptNavigationTheme({
      reactNavigationLight: NavigationDefaultTheme,
      reactNavigationDark: NavigationDarkTheme,
      materialLight: materialLightTheme,
      materialDark: materialDarkTheme,
    });

    const activeTheme = isDark ? materialDarkTheme : materialLightTheme;

    return {
      paperTheme: activeTheme,
      navTheme: isDark
        ? createNavigationTheme(navDark, materialDarkTheme, true)
        : createNavigationTheme(navLight, materialLightTheme, false),
      isDark,
      semantic: isDark ? darkScheme : lightScheme,
      fills: createFills(activeTheme, isDark),
    };
  }, [materialTheme.dark, materialTheme.light, scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export const themeRuntimeConfig = {
  isAndroid12Plus: IS_ANDROID_12_PLUS,
  shouldUseDynamicTheme: SHOULD_USE_DYNAMIC_THEME,
  fallbackSourceColor: FALLBACK_SOURCE_COLOR,
} as const;
