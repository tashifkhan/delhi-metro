/**
 * Per-style shape and type decisions that a colour scheme can't express.
 *
 * Colours come from the MD3 scheme for every style. What differs beyond colour
 * lives here: corner radii, whether cards get a shadow or a hairline, and which
 * face numbers are set in. Read it with `useAppTheme().look` and prefer these
 * values over the static `radius` export, which only describes Material.
 */

import { Platform, type TextStyle } from 'react-native';
import { radius as materialRadius } from './shape';
import type { UiStyle } from './studio';

export interface LookRadius {
  badge: number;
  iconSmall: number;
  icon: number;
  card: number;
  hero: number;
  field: number;
  pill: number;
}

export interface Look {
  style: UiStyle;
  radius: LookRadius;
  /** Cards carry an M3 shadow (Material) or a hairline edge (Studio, Plain). */
  edge: 'shadow' | 'hairline';
  /** Paper's base roundness; its components multiply it. */
  paperRoundness: number;
  /** Times, fares, counts and codes. */
  figures: TextStyle;
  /** Plain sets labels and metadata in the monospace face too. */
  meta: TextStyle;
}

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
});

const tabularFigures: TextStyle = { fontVariant: ['tabular-nums'] };
const monoFigures: TextStyle = { fontFamily: MONO, fontVariant: ['tabular-nums'] };

export const LOOKS: Record<UiStyle, Look> = {
  material: {
    style: 'material',
    radius: { ...materialRadius },
    edge: 'shadow',
    paperRoundness: 4,
    figures: tabularFigures,
    meta: {},
  },
  studio: {
    style: 'studio',
    // taf.sh Studio draws cards at 7 and keeps buttons and chips fully round.
    radius: { badge: 4, iconSmall: 6, icon: 7, card: 7, hero: 10, field: 7, pill: 999 },
    edge: 'hairline',
    paperRoundness: 2.4,
    figures: monoFigures,
    meta: {},
  },
  plain: {
    style: 'plain',
    radius: { badge: 0, iconSmall: 2, icon: 2, card: 2, hero: 2, field: 2, pill: 2 },
    edge: 'hairline',
    paperRoundness: 0.5,
    figures: monoFigures,
    meta: { fontFamily: MONO },
  },
};

/**
 * Translate a Material radius into the active style's equivalent.
 *
 * Most call sites still pass the static Material values (`radius.hero` is 28,
 * `radius.card` 16). Shared components run them through this so every style
 * gets its own corners without touching each caller. Unknown values pass
 * through unchanged.
 */
export function adaptRadius(look: Look, value: number): number {
  if (look.style === 'material') return value;
  switch (value) {
    case materialRadius.pill:
      return look.radius.pill;
    case materialRadius.hero:
      return look.radius.hero;
    case materialRadius.card: // also icon and field (16)
      return look.radius.card;
    case materialRadius.iconSmall: // 12
      return look.radius.iconSmall;
    case materialRadius.badge: // 8
      return look.radius.badge;
    default:
      return value;
  }
}
