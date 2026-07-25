/**
 * Color parsing and blending used to expand a palette seed into a full
 * Material 3 scheme.
 *
 * Colors in this app arrive in three shapes — `#rgb`, `#rrggbb` and
 * `rgb(r, g, b)` (the hand-tuned schemes) — so everything funnels through
 * `parseColor` rather than assuming a single format.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseColor(color: string): Rgb | null {
  const value = color.trim();
  const hex = value.replace('#', '');

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  const match = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (match) {
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  }

  return null;
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function rgb({ r, g, b }: Rgb): string {
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

export function rgba(color: string, alpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) return 'transparent';
  return `rgba(${clamp(parsed.r)}, ${clamp(parsed.g)}, ${clamp(parsed.b)}, ${alpha})`;
}

/** Lay `top` over `bottom` at `alpha`, returning the flattened opaque result. */
export function compositeOver(top: string, bottom: string, alpha: number): string {
  const a = parseColor(top);
  const b = parseColor(bottom);
  if (!a || !b) return bottom;
  return rgb({
    r: a.r * alpha + b.r * (1 - alpha),
    g: a.g * alpha + b.g * (1 - alpha),
    b: a.b * alpha + b.b * (1 - alpha),
  });
}

export function darken(color: string, factor: number): string {
  const c = parseColor(color);
  if (!c) return color;
  return rgb({ r: c.r * (1 - factor), g: c.g * (1 - factor), b: c.b * (1 - factor) });
}

export function lighten(color: string, factor: number): string {
  const c = parseColor(color);
  if (!c) return color;
  return rgb({
    r: c.r + (255 - c.r) * factor,
    g: c.g + (255 - c.g) * factor,
    b: c.b + (255 - c.b) * factor,
  });
}

/** WCAG 2.1 contrast ratio between two colors, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const ON_LIGHT = '#101418';
const ON_DARK = '#FFFFFF';

/**
 * The foreground with the most contrast against `background`.
 *
 * Unlike a fixed luminance threshold this stays correct for mid-tone accents
 * like amber, where white and black land on opposite sides of the cut-off but
 * black is dramatically more readable.
 */
export function contrastingOn(background: string): string {
  return contrastRatio(ON_DARK, background) >= contrastRatio(ON_LIGHT, background)
    ? ON_DARK
    : ON_LIGHT;
}

/** WCAG 2.1 relative luminance, 0 (black) to 1 (white). */
export function luminance(color: string): number {
  const c = parseColor(color);
  if (!c) return 0;

  const [r, g, b] = [c.r, c.g, c.b].map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
