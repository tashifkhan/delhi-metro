import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  MD3DarkTheme,
  MD3LightTheme,
  adaptNavigationTheme,
  type MD3Theme,
} from 'react-native-paper';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';
import { lightScheme, darkScheme } from './colors';

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
  navTheme: typeof navigationLightTheme;
  isDark: boolean;
  semantic: SemanticColors;
}

const ThemeContext = createContext<AppTheme>({
  paperTheme: paperLightTheme,
  navTheme: navigationLightTheme,
  isDark: false,
  semantic: lightScheme,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo<AppTheme>(() => {
    const isDark = scheme === 'dark';
    return {
      paperTheme: isDark ? paperDarkTheme : paperLightTheme,
      navTheme: isDark ? navigationDarkTheme : navigationLightTheme,
      isDark,
      semantic: isDark ? darkScheme : lightScheme,
    };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
