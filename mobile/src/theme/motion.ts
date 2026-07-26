/**
 * Material 3 motion tokens.
 *
 * M3 expresses motion as a duration scale plus a small set of easing curves.
 * The "emphasized" family is the signature one: it accelerates slowly and
 * decelerates hard, which is what makes M3 transitions feel weighted rather
 * than linear. Reach for a token here instead of an ad-hoc duration so motion
 * across the app shares one rhythm.
 */

import { Easing, type EasingFunction } from 'react-native';

/** Duration scale, in milliseconds. */
export const duration = {
  /** Small utility changes: state layers, selection, icon swaps. */
  short1: 50,
  short2: 100,
  short3: 150,
  short4: 200,
  /** Component-level transitions: expanding a card, switching a toggle. */
  medium1: 250,
  medium2: 300,
  medium3: 350,
  medium4: 400,
  /** Full-screen or large-area movement. */
  long1: 450,
  long2: 500,
} as const;

/**
 * Easing curves.
 *
 * `emphasized` is the default for anything the user initiated and will watch.
 * `standard` suits small, functional changes. The accelerate/decelerate
 * variants are for one-way movement — leaving and entering the screen.
 */
export const easing: Record<
  'emphasized' | 'emphasizedDecelerate' | 'emphasizedAccelerate' | 'standard',
  EasingFunction
> = {
  emphasized: Easing.bezier(0.2, 0.0, 0.0, 1.0),
  emphasizedDecelerate: Easing.bezier(0.05, 0.7, 0.1, 1.0),
  emphasizedAccelerate: Easing.bezier(0.3, 0.0, 0.8, 0.15),
  standard: Easing.bezier(0.2, 0.0, 0.0, 1.0),
};

/**
 * Spring matching M3's "expressive" spatial motion, for things that travel —
 * a switch thumb, a pressed card. Slight overshoot reads as physical.
 */
export const spring = {
  spatial: { stiffness: 380, damping: 30, mass: 1 },
  /** No overshoot: use where an overshoot would look like a glitch. */
  effect: { stiffness: 420, damping: 40, mass: 1 },
} as const;

export const motion = { duration, easing, spring } as const;
