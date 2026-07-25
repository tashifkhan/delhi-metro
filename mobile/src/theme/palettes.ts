/**
 * Color palettes.
 *
 * `dynamic` follows the device wallpaper (Material You, Android 12+); `metro`
 * is the app's hand-tuned house scheme. The rest are seeds expanded into
 * complete Material 3 schemes for light and dark by `buildScheme`.
 *
 * Ported from the palette system in the paisa app, adapted to Paper's MD3
 * shape — Paper models tonal surfaces as `elevation.level0..5` rather than as
 * M3-expressive's `surfaceContainer*` roles.
 */

import type { MD3Theme } from 'react-native-paper';
import { compositeOver, contrastingOn, darken, lighten, luminance } from './colorMath';
import { lightScheme, darkScheme } from './colors';

export interface Palette {
  id: string;
  label: string;
  /** Swatch shown in the picker. */
  seed: string;
  primaryLight: string;
  primaryDark: string;
  secondaryLight: string;
  secondaryDark: string;
  tertiaryLight: string;
  tertiaryDark: string;
  backgroundLight: string;
  backgroundDark: string;
}

export const DYNAMIC_PALETTE_ID = 'dynamic';
export const DEFAULT_PALETTE_ID = 'metro';

/**
 * The house palette. Its scheme is the hand-tuned one in `colors.ts` rather
 * than a generated expansion, so the default look is unchanged by this system.
 */
const METRO: Palette = {
  id: DEFAULT_PALETTE_ID,
  label: 'Metro',
  seed: '#005FAF',
  primaryLight: '#005FAF',
  primaryDark: '#A5C8FF',
  secondaryLight: '#3E8EBA',
  secondaryDark: '#93C5FD',
  tertiaryLight: '#1565C0',
  tertiaryDark: '#64B5F6',
  backgroundLight: '#FDFCFF',
  backgroundDark: '#000000',
};

export const PALETTES: Palette[] = [
  {
    id: DYNAMIC_PALETTE_ID,
    label: 'Wallpaper',
    seed: '#6750A4',
    primaryLight: '#6750A4',
    primaryDark: '#CFBCFF',
    secondaryLight: '#625B71',
    secondaryDark: '#CBC3DA',
    tertiaryLight: '#7E525A',
    tertiaryDark: '#F2B8C1',
    backgroundLight: '#FCF8FF',
    backgroundDark: '#16121A',
  },
  METRO,
  {
    id: 'forest',
    label: 'Forest',
    seed: '#0B6E4F',
    primaryLight: '#1B5E20',
    primaryDark: '#66BB6A',
    secondaryLight: '#33691E',
    secondaryDark: '#9CCC65',
    tertiaryLight: '#2E7D32',
    tertiaryDark: '#A5D6A7',
    backgroundLight: '#F1F8E9',
    backgroundDark: '#0D1A0D',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    seed: '#006064',
    primaryLight: '#006064',
    primaryDark: '#4DD0E1',
    secondaryLight: '#00838F',
    secondaryDark: '#80DEEA',
    tertiaryLight: '#0097A7',
    tertiaryDark: '#26C6DA',
    backgroundLight: '#F0FFFF',
    backgroundDark: '#0A1A1C',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    seed: '#E65100',
    primaryLight: '#E65100',
    primaryDark: '#FF9E80',
    secondaryLight: '#EF6C00',
    secondaryDark: '#FFCC80',
    tertiaryLight: '#F4511E',
    tertiaryDark: '#FF8A65',
    backgroundLight: '#FFF5F0',
    backgroundDark: '#1A120D',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    seed: '#7C5AB8',
    primaryLight: '#7C5AB8',
    primaryDark: '#CFBCFF',
    secondaryLight: '#635B70',
    secondaryDark: '#CBC3DA',
    tertiaryLight: '#7E525A',
    tertiaryDark: '#F2B8C1',
    backgroundLight: '#FCF8FF',
    backgroundDark: '#16121A',
  },
  {
    id: 'nord',
    label: 'Nord',
    seed: '#5E81AC',
    primaryLight: '#5E81AC',
    primaryDark: '#88C0D0',
    secondaryLight: '#4C566A',
    secondaryDark: '#D8DEE9',
    tertiaryLight: '#B48EAD',
    tertiaryDark: '#D8A9C4',
    backgroundLight: '#ECEFF4',
    backgroundDark: '#2E3440',
  },
  {
    id: 'tokyo_night',
    label: 'Tokyo Night',
    seed: '#3D5A80',
    primaryLight: '#3D5A80',
    primaryDark: '#7D9BC1',
    secondaryLight: '#6B5B95',
    secondaryDark: '#A89DC9',
    tertiaryLight: '#4A6B5C',
    tertiaryDark: '#8AB4A3',
    backgroundLight: '#F0F1F5',
    backgroundDark: '#1A1B26',
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    seed: '#4C6B9A',
    primaryLight: '#4C6B9A',
    primaryDark: '#9BA8CF',
    secondaryLight: '#B76B8F',
    secondaryDark: '#D4A5B8',
    tertiaryLight: '#B8763E',
    tertiaryDark: '#8AB8A8',
    backgroundLight: '#EFF1F5',
    backgroundDark: '#1E1E2E',
  },
  {
    id: 'gruvbox',
    label: 'Gruvbox',
    seed: '#9D5B3F',
    primaryLight: '#9D5B3F',
    primaryDark: '#D89B6A',
    secondaryLight: '#7A7556',
    secondaryDark: '#B0AE8A',
    tertiaryLight: '#4A7B7C',
    tertiaryDark: '#8AAFA8',
    backgroundLight: '#FBF1C7',
    backgroundDark: '#282828',
  },
  {
    id: 'rose_pine',
    label: 'Rose Pine',
    seed: '#907AA9',
    primaryLight: '#907AA9',
    primaryDark: '#C4A7E7',
    secondaryLight: '#B4637A',
    secondaryDark: '#EBBCBA',
    tertiaryLight: '#7A9A8A',
    tertiaryDark: '#9CCFD8',
    backgroundLight: '#FAF4ED',
    backgroundDark: '#232136',
  },
  {
    id: 'dracula',
    label: 'Dracula',
    seed: '#6272A4',
    primaryLight: '#6272A4',
    primaryDark: '#BD93F9',
    secondaryLight: '#44475A',
    secondaryDark: '#FF79C6',
    tertiaryLight: '#50FA7B',
    tertiaryDark: '#8BE9FD',
    backgroundLight: '#F8F8F2',
    backgroundDark: '#282A36',
  },
  {
    id: 'strawberry',
    label: 'Strawberry',
    seed: '#D81B60',
    primaryLight: '#D81B60',
    primaryDark: '#F48FB1',
    secondaryLight: '#6B4958',
    secondaryDark: '#D6B0C1',
    tertiaryLight: '#C2185B',
    tertiaryDark: '#F8BBD9',
    backgroundLight: '#FFF5F8',
    backgroundDark: '#1A1015',
  },
  {
    id: 'amber',
    label: 'Amber',
    seed: '#FF8F00',
    primaryLight: '#FF8F00',
    primaryDark: '#FFCA28',
    secondaryLight: '#FFA000',
    secondaryDark: '#FFD54F',
    tertiaryLight: '#FFB300',
    tertiaryDark: '#FFE082',
    backgroundLight: '#FFFBF0',
    backgroundDark: '#1A1508',
  },
  {
    id: 'mocha',
    label: 'Mocha',
    seed: '#795548',
    primaryLight: '#795548',
    primaryDark: '#BCAAA4',
    secondaryLight: '#5D4037',
    secondaryDark: '#A1887F',
    tertiaryLight: '#6D4C41',
    tertiaryDark: '#D7CCC8',
    backgroundLight: '#FFF9F5',
    backgroundDark: '#1A1512',
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    seed: '#212121',
    primaryLight: '#212121',
    primaryDark: '#E0E0E0',
    secondaryLight: '#424242',
    secondaryDark: '#BDBDBD',
    tertiaryLight: '#616161',
    tertiaryDark: '#9E9E9E',
    backgroundLight: '#FFFFFF',
    backgroundDark: '#0A0A0A',
  },
];

export function paletteFromId(id: string | null | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? METRO;
}

type SchemeColors = MD3Theme['colors'];

/**
 * Depth for a dark-mode container. Bright seeds (amber, coral) have to be
 * driven down harder than deep ones, or the light on-color sitting on top of
 * them falls below a readable contrast ratio.
 */
function containerDark(base: string): string {
  return darken(base, Math.min(0.75, 0.4 + luminance(base) * 0.4));
}

/** Tonal surface ramp: the accent laid over the background at rising alpha. */
function elevationRamp(accent: string, background: string): SchemeColors['elevation'] {
  return {
    level0: 'transparent',
    level1: compositeOver(accent, background, 0.05),
    level2: compositeOver(accent, background, 0.08),
    level3: compositeOver(accent, background, 0.11),
    level4: compositeOver(accent, background, 0.12),
    level5: compositeOver(accent, background, 0.14),
  };
}

function buildLightScheme(p: Palette): Partial<SchemeColors> {
  const onSurface = '#1C1B1F';
  return {
    primary: p.primaryLight,
    // Derived, not fixed white: mid-tone seeds such as amber need dark text.
    onPrimary: contrastingOn(p.primaryLight),
    primaryContainer: compositeOver(p.primaryLight, '#FFFFFF', 0.18),
    onPrimaryContainer: darken(p.primaryLight, 0.46),
    secondary: p.secondaryLight,
    onSecondary: contrastingOn(p.secondaryLight),
    secondaryContainer: compositeOver(p.secondaryLight, '#FFFFFF', 0.16),
    onSecondaryContainer: darken(p.secondaryLight, 0.46),
    tertiary: p.tertiaryLight,
    onTertiary: contrastingOn(p.tertiaryLight),
    tertiaryContainer: compositeOver(p.tertiaryLight, '#FFFFFF', 0.16),
    onTertiaryContainer: darken(p.tertiaryLight, 0.46),
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#93000A',
    background: p.backgroundLight,
    onBackground: onSurface,
    surface: p.backgroundLight,
    onSurface,
    surfaceVariant: compositeOver(p.primaryLight, '#F0F0F0', 0.1),
    onSurfaceVariant: '#49454F',
    outline: compositeOver(p.secondaryLight, '#79747E', 0.5),
    outlineVariant: compositeOver(p.primaryLight, '#CAC4D0', 0.14),
    inverseSurface: p.backgroundDark,
    inverseOnSurface: '#F4EFF4',
    inversePrimary: p.primaryDark,
    elevation: elevationRamp(p.primaryLight, p.backgroundLight),
    surfaceDisabled: 'rgba(28, 27, 31, 0.12)',
    onSurfaceDisabled: 'rgba(28, 27, 31, 0.38)',
    backdrop: 'rgba(45, 49, 56, 0.4)',
  };
}

function buildDarkScheme(p: Palette): Partial<SchemeColors> {
  const onSurface = '#E6E1E5';
  return {
    primary: p.primaryDark,
    onPrimary: darken(p.primaryLight, 0.5),
    primaryContainer: containerDark(p.primaryLight),
    onPrimaryContainer: lighten(p.primaryDark, 0.18),
    secondary: p.secondaryDark,
    onSecondary: darken(p.secondaryLight, 0.5),
    secondaryContainer: containerDark(p.secondaryLight),
    onSecondaryContainer: lighten(p.secondaryDark, 0.18),
    tertiary: p.tertiaryDark,
    onTertiary: darken(p.tertiaryLight, 0.5),
    tertiaryContainer: containerDark(p.tertiaryLight),
    onTertiaryContainer: lighten(p.tertiaryDark, 0.18),
    error: '#FFB4AB',
    onError: '#690005',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',
    background: p.backgroundDark,
    onBackground: onSurface,
    surface: p.backgroundDark,
    onSurface,
    surfaceVariant: compositeOver(p.primaryDark, '#2A2A2A', 0.12),
    onSurfaceVariant: '#CAC4D0',
    outline: compositeOver(p.secondaryDark, '#938F99', 0.4),
    outlineVariant: compositeOver(p.primaryDark, '#49454F', 0.15),
    inverseSurface: p.backgroundLight,
    inverseOnSurface: '#313033',
    inversePrimary: p.primaryLight,
    elevation: elevationRamp(p.primaryDark, p.backgroundDark),
    surfaceDisabled: 'rgba(230, 225, 229, 0.12)',
    onSurfaceDisabled: 'rgba(230, 225, 229, 0.38)',
    backdrop: 'rgba(45, 49, 56, 0.4)',
  };
}

export function buildScheme(palette: Palette, isDark: boolean): Partial<SchemeColors> {
  // The house palette ships a hand-tuned scheme; generating it from the seed
  // would lose the deliberate true-black dark surfaces.
  if (palette.id === DEFAULT_PALETTE_ID) {
    return isDark ? darkScheme : lightScheme;
  }
  return isDark ? buildDarkScheme(palette) : buildLightScheme(palette);
}

/** Floor the dark surfaces to true black for OLED panels. */
export function toAmoled(colors: Partial<SchemeColors>): Partial<SchemeColors> {
  return {
    ...colors,
    background: '#000000',
    surface: '#000000',
    elevation: {
      level0: 'transparent',
      level1: '#0D0D0D',
      level2: '#141414',
      level3: '#1D1D1D',
      level4: '#212121',
      level5: '#262626',
    },
  };
}

/**
 * Firm up text and outlines. M3's default soft greys are pleasant but drop
 * below comfortable contrast for some users, especially outdoors.
 */
export function toHighContrast(
  colors: Partial<SchemeColors>,
  isDark: boolean,
): Partial<SchemeColors> {
  return {
    ...colors,
    onSurface: isDark ? '#FFFFFF' : '#000000',
    onBackground: isDark ? '#FFFFFF' : '#000000',
    onSurfaceVariant: isDark ? '#E6E1E5' : '#2A2730',
    outline: isDark ? '#C9C5D0' : '#4A4650',
    outlineVariant: isDark ? '#8E8A94' : '#79747E',
  };
}
