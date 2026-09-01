/**
 * Material 3 shape scale.
 *
 * M3 defines corner sizes as a small, fixed set so that radii read as a
 * deliberate system rather than per-component guesses. Component aliases below
 * map each UI role onto one of those steps — always prefer an alias over a
 * raw number so a role can be retuned in one place.
 */

export const shape = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 999,
} as const;

export const radius = {
  /** Small inline chips, code badges, status pills that aren't fully round. */
  badge: shape.sm,
  /** Icon tiles inside rows (28–36px squircles). */
  iconSmall: shape.md,
  /** Icon tiles leading a card (40–56px squircles). */
  icon: shape.lg,
  /** List cards, item cards, notification cards. */
  card: shape.lg,
  /** Large surfaces: hero cards, expandable sections, sheets. */
  hero: shape.xl,
  /** Text fields and segmented containers. */
  field: shape.lg,
  /** Fully rounded: filled buttons, assist chips, FAB extended. */
  pill: shape.full,
} as const;

