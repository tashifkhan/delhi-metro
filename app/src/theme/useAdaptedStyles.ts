import { useMemo } from 'react';
import { useAppTheme } from './ThemeContext';
import type { Look } from './look';

const RADIUS_KEYS = [
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderTopStartRadius',
  'borderTopEndRadius',
  'borderBottomStartRadius',
  'borderBottomEndRadius',
] as const;

type StyleObject = Record<string, unknown>;

/**
 * A Material corner, by size, to the active style's corner for the same role.
 * Circles and pills are left alone: a value at least half the element's
 * smaller side is a shape (a dot, a station marker), not a corner.
 */
export function adaptCorner(look: Look, value: number, style: StyleObject): number {
  if (look.style === 'material' || value <= 0) return value;
  const width = typeof style.width === 'number' ? style.width : null;
  const height = typeof style.height === 'number' ? style.height : null;
  const side = width !== null && height !== null ? Math.min(width, height) : width ?? height;
  if (side !== null && value * 2 >= side) return value;
  if (value >= 999) return look.radius.pill;
  if (value >= 20) return look.radius.hero;
  if (value >= 14) return look.radius.card;
  if (value >= 10) return look.radius.iconSmall;
  return look.radius.badge;
}

export function adaptStyles<T extends object>(styles: T, look: Look): T {
  if (look.style === 'material') return styles;
  const out: Record<string, StyleObject> = {};
  for (const [name, style] of Object.entries(styles as Record<string, StyleObject>)) {
    let next: StyleObject | null = null;
    for (const key of RADIUS_KEYS) {
      const value = style[key];
      if (typeof value !== 'number') continue;
      const adapted = adaptCorner(look, value, style);
      if (adapted !== value) {
        next = next ?? { ...style };
        next[key] = adapted;
      }
    }
    out[name] = next ?? style;
  }
  return out as T;
}

/**
 * A component's stylesheet with its corners translated for the active style.
 * Studio and Plain get their own corners; Material keeps the sheet as written.
 */
export function useAdaptedStyles<T extends object>(styles: T): T {
  const { look } = useAppTheme();
  return useMemo(() => adaptStyles(styles, look), [styles, look]);
}
