/**
 * Studio and Plain: the app's two non-Material looks.
 *
 * Studio is taf.sh's default style. Its tokens are copied from
 * `taf.sh/src/styles/global.css` (warm grayscale + one accent) and its four
 * colour combos from `taf.sh/scripts/generate-skins.ts`. When taf.sh changes
 * them, change them here too; taf.sh is the source.
 *
 * Plain is Studio with the decoration taken out: no accent, no tinted
 * surfaces, near-square corners. Everything sits on one background and is
 * separated by hairlines.
 *
 * Both are expressed as an MD3 colour scheme so Paper components and every
 * screen that reads `theme.colors` pick them up without changes.
 */

import type { MD3Theme } from 'react-native-paper';
import { compositeOver } from './colorMath';

type SchemeColors = MD3Theme['colors'];

export type UiStyle = 'studio' | 'material' | 'plain';
export const UI_STYLES: UiStyle[] = ['studio', 'material', 'plain'];
export const DEFAULT_UI_STYLE: UiStyle = 'studio';

export type StudioColorId = 'teal' | 'amber' | 'indigo' | 'rose';
export const DEFAULT_STUDIO_COLOR: StudioColorId = 'teal';

interface Accent {
  accent: string;
  strong: string;
  contrast: string;
}

export interface StudioCombo {
  id: StudioColorId;
  name: string;
  light: Accent;
  dark: Accent;
}

export const STUDIO_COMBOS: StudioCombo[] = [
  {
    id: 'teal',
    name: 'Teal',
    light: { accent: '#0f7a6c', strong: '#0b5b50', contrast: '#ffffff' },
    dark: { accent: '#4fd1c5', strong: '#7ce3d9', contrast: '#04211f' },
  },
  {
    id: 'amber',
    name: 'Amber',
    light: { accent: '#b45309', strong: '#92400e', contrast: '#ffffff' },
    dark: { accent: '#fbbf24', strong: '#fcd34d', contrast: '#241a02' },
  },
  {
    id: 'indigo',
    name: 'Indigo',
    light: { accent: '#4338ca', strong: '#3730a3', contrast: '#ffffff' },
    dark: { accent: '#a5b4fc', strong: '#c7d2fe', contrast: '#12143a' },
  },
  {
    id: 'rose',
    name: 'Rose',
    light: { accent: '#be123c', strong: '#9f1239', contrast: '#ffffff' },
    dark: { accent: '#fda4af', strong: '#fecdd3', contrast: '#3a0a16' },
  },
];

export function studioComboFromId(id: string | null | undefined): StudioCombo {
  return STUDIO_COMBOS.find((combo) => combo.id === id) ?? STUDIO_COMBOS[0];
}

/** taf.sh's warm grayscale, light and dark. */
export const STUDIO_NEUTRALS = {
  light: {
    background: '#f6f1e9',
    surface: '#fdfaf4',
    elevated: '#fffdf8',
    border: '#ded4c5',
    borderStrong: '#c7b9a6',
    foreground: '#171615',
    secondary: '#3d3836',
    muted: '#5f5956',
    faint: '#857f7b',
  },
  dark: {
    background: '#0e0d0d',
    surface: '#151313',
    elevated: '#1c1a1a',
    border: '#2c2828',
    borderStrong: '#3b3737',
    foreground: '#f2f1f0',
    secondary: '#c4bfbe',
    muted: '#a19c9b',
    faint: '#77716f',
  },
} as const;

export type StudioNeutrals = (typeof STUDIO_NEUTRALS)['light'] | (typeof STUDIO_NEUTRALS)['dark'];

/**
 * MD3 roles for Studio or Plain.
 *
 * Elevation levels are flat on purpose: Studio separates things with hairlines,
 * not tonal lift, so level1 to level5 only step between surface and elevated.
 */
export function buildStudioScheme(
  style: 'studio' | 'plain',
  combo: StudioCombo,
  isDark: boolean,
): Partial<SchemeColors> {
  const n = isDark ? STUDIO_NEUTRALS.dark : STUDIO_NEUTRALS.light;
  const a = isDark ? combo.dark : combo.light;
  const plain = style === 'plain';

  const primary = plain ? n.foreground : a.accent;
  const onPrimary = plain ? n.background : a.contrast;
  const wash = (color: string, alpha: number) => compositeOver(color, n.background, alpha);

  return {
    primary,
    onPrimary,
    primaryContainer: plain ? wash(n.foreground, 0.08) : wash(a.accent, isDark ? 0.16 : 0.12),
    onPrimaryContainer: plain ? n.foreground : a.strong,
    secondary: n.muted,
    onSecondary: n.background,
    secondaryContainer: wash(n.foreground, isDark ? 0.1 : 0.07),
    onSecondaryContainer: n.foreground,
    tertiary: plain ? n.secondary : a.strong,
    onTertiary: n.background,
    tertiaryContainer: wash(n.foreground, 0.06),
    onTertiaryContainer: n.foreground,
    background: n.background,
    onBackground: n.foreground,
    surface: plain ? n.background : n.surface,
    onSurface: n.foreground,
    surfaceVariant: wash(n.foreground, isDark ? 0.07 : 0.05),
    onSurfaceVariant: n.muted,
    outline: n.borderStrong,
    outlineVariant: n.border,
    inverseSurface: n.foreground,
    inverseOnSurface: n.background,
    inversePrimary: isDark ? combo.light.accent : combo.dark.accent,
    surfaceDisabled: wash(n.foreground, 0.12),
    onSurfaceDisabled: n.faint,
    backdrop: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(23, 22, 21, 0.32)',
    elevation: plain
      ? {
          level0: 'transparent',
          level1: n.background,
          level2: n.background,
          level3: n.surface,
          level4: n.surface,
          level5: n.surface,
        }
      : {
          level0: 'transparent',
          level1: n.surface,
          level2: n.surface,
          level3: n.elevated,
          level4: n.elevated,
          level5: n.elevated,
        },
  };
}
