/**
 * Type helpers layered on top of the Material 3 type scale.
 *
 * Paper's `Text variant` already carries size, line height and weight for each
 * role, so prefer a variant over raw sizes. These helpers exist for the two
 * cases the scale doesn't cover: emphasising a variant without restating its
 * metrics, and rendering figures that must not jitter as they update.
 */

import type { TextStyle } from 'react-native';

export const weights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/** Bump a variant's weight for emphasis while keeping its size and leading. */
export const emphasis = {
  medium: { fontWeight: weights.medium },
  strong: { fontWeight: weights.semibold },
  heavy: { fontWeight: weights.bold },
} as const satisfies Record<string, TextStyle>;

/**
 * Lining figures of equal width. Use for fares, times, station codes and
 * counters so digits don't shift the layout when the value changes.
 */
export const tabular: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/**
 * Small tracked capitals for field labels and section metadata.
 *
 * The type scale alone can't separate a label from its value when both sit at
 * similar sizes — "FROM" and a station name read as equals. Casing and letter
 * spacing do the work that size can't, and keep labels quiet without fading
 * them to an unreadable grey.
 *
 * Pair with a `labelSmall` or `labelMedium` variant.
 */
export const overline: TextStyle = {
  textTransform: 'uppercase',
  letterSpacing: 1.1,
  fontWeight: weights.semibold,
};

export const typography = { weights, emphasis, tabular, overline } as const;
