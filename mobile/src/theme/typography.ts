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

export const typography = { weights, emphasis, tabular } as const;
