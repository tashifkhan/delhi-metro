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
import { lightScheme, darkScheme } from './colors';

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

// Build Paper themes
export const paperLightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...lightScheme,
  },
};

export const paperDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...darkScheme,
  },
};

// Adapt navigation themes to match Paper
const { LightTheme: navLight, DarkTheme: navDark } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
  materialLight: paperLightTheme,
  materialDark: paperDarkTheme,
});

export const navigationLightTheme = {
  ...navLight,
  colors: {
    ...navLight.colors,
    background: lightScheme.background,
    card: lightScheme.surface,
    text: lightScheme.onSurface,
    border: lightScheme.outlineVariant,
    primary: lightScheme.primary,
  },
};

export const navigationDarkTheme = {
  ...navDark,
  colors: {
    ...navDark.colors,
    background: darkScheme.background,
    card: darkScheme.elevation.level2,
    text: darkScheme.onSurface,
    border: darkScheme.outlineVariant,
    primary: darkScheme.primary,
  },
};

// Semantic colors not in Paper's type
export interface SemanticColors {
  success: string;
  successContainer: string;
  warning: string;
  warningContainer: string;
  interchange: string;
}

interface AppTheme {
  paperTheme: MD3Theme;
  navTheme: NavigationTheme;
  isDark: boolean;
  semantic: SemanticColors;
}

const ThemeContext = createContext<AppTheme>({
  paperTheme: paperLightTheme,
  navTheme: NavigationDefaultTheme,
  isDark: false,
  semantic: lightScheme,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const { theme: materialTheme } = useMaterial3Theme({
    fallbackSourceColor: FALLBACK_SOURCE_COLOR,
  });

  const value = useMemo<AppTheme>(() => {
    const isDark = scheme === 'dark';
    const lightMaterialScheme: Partial<MD3Theme['colors']> =
      SHOULD_USE_DYNAMIC_THEME ? materialTheme.light : lightScheme;
    const darkMaterialScheme: Partial<MD3Theme['colors']> =
      SHOULD_USE_DYNAMIC_THEME ? materialTheme.dark : darkScheme;

    const materialLightTheme = createPaperTheme(false, lightMaterialScheme);
    const materialDarkTheme = createPaperTheme(true, darkMaterialScheme);

    const { LightTheme: navLight, DarkTheme: navDark } = adaptNavigationTheme({
      reactNavigationLight: NavigationDefaultTheme,
      reactNavigationDark: NavigationDarkTheme,
      materialLight: materialLightTheme,
      materialDark: materialDarkTheme,
    });

    const navigationLightTheme: NavigationTheme = {
      ...navLight,
      colors: {
        ...navLight.colors,
        background: materialLightTheme.colors.background,
        card: materialLightTheme.colors.surface,
        text: materialLightTheme.colors.onSurface,
        border: materialLightTheme.colors.outlineVariant,
        primary: materialLightTheme.colors.primary,
      },
    };

    const navigationDarkTheme: NavigationTheme = {
      ...navDark,
      colors: {
        ...navDark.colors,
        background: materialDarkTheme.colors.background,
        card: materialDarkTheme.colors.elevation.level2,
        text: materialDarkTheme.colors.onSurface,
        border: materialDarkTheme.colors.outlineVariant,
        primary: materialDarkTheme.colors.primary,
      },
    };

    return {
      paperTheme: isDark ? materialDarkTheme : materialLightTheme,
      navTheme: isDark ? navigationDarkTheme : navigationLightTheme,
      isDark,
      semantic: isDark ? darkScheme : lightScheme,
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
