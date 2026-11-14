/**
 * Material You colour roles generated from one seed colour.
 *
 * Uses Google's material-color-utilities, the same code Android runs to turn a
 * wallpaper into a scheme, so every surface and container step is the real M3
 * tone rather than an accent laid over black at some alpha.
 *
 * Paper still names tonal surfaces `elevation.level1..5`, so those carry the
 * M3 surface container roles: level1 is surfaceContainerLow, level2
 * surfaceContainer, level3 surfaceContainerHigh, level5 surfaceContainerHighest.
 */

import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  argbFromHex,
  hexFromArgb,
  type DynamicColor,
  type DynamicScheme,
} from '@material/material-color-utilities';
import type { MD3Theme } from 'react-native-paper';

type SchemeColors = MD3Theme['colors'];

function role(color: DynamicColor, scheme: DynamicScheme): string {
  return hexFromArgb(color.getArgb(scheme));
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function materialScheme(seed: string, isDark: boolean): SchemeColors {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), isDark, 0);
  const c = MaterialDynamicColors;
  const get = (color: DynamicColor) => role(color, scheme);
  const onSurface = get(c.onSurface);

  return {
    primary: get(c.primary),
    onPrimary: get(c.onPrimary),
    primaryContainer: get(c.primaryContainer),
    onPrimaryContainer: get(c.onPrimaryContainer),
    secondary: get(c.secondary),
    onSecondary: get(c.onSecondary),
    secondaryContainer: get(c.secondaryContainer),
    onSecondaryContainer: get(c.onSecondaryContainer),
    tertiary: get(c.tertiary),
    onTertiary: get(c.onTertiary),
    tertiaryContainer: get(c.tertiaryContainer),
    onTertiaryContainer: get(c.onTertiaryContainer),
    error: get(c.error),
    onError: get(c.onError),
    errorContainer: get(c.errorContainer),
    onErrorContainer: get(c.onErrorContainer),
    background: get(c.surface),
    onBackground: onSurface,
    surface: get(c.surface),
    onSurface,
    surfaceVariant: get(c.surfaceVariant),
    onSurfaceVariant: get(c.onSurfaceVariant),
    outline: get(c.outline),
    outlineVariant: get(c.outlineVariant),
    shadow: get(c.shadow),
    scrim: get(c.scrim),
    inverseSurface: get(c.inverseSurface),
    inverseOnSurface: get(c.inverseOnSurface),
    inversePrimary: get(c.inversePrimary),
    elevation: {
      level0: 'transparent',
      level1: get(c.surfaceContainerLow),
      level2: get(c.surfaceContainer),
      level3: get(c.surfaceContainerHigh),
      level4: get(c.surfaceContainerHigh),
      level5: get(c.surfaceContainerHighest),
    },
    surfaceDisabled: withAlpha(onSurface, 0.12),
    onSurfaceDisabled: withAlpha(onSurface, 0.38),
    backdrop: withAlpha(get(c.scrim), 0.4),
  };
}

/** The lowest container step, which Paper has no slot for. */
export function containerLowest(seed: string, isDark: boolean): string {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), isDark, 0);
  return role(MaterialDynamicColors.surfaceContainerLowest, scheme);
}
