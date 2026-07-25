/**
 * Contrast helpers for line colors.
 *
 * Metro line colors arrive from the DMRC API and span the full range from
 * near-black (Violet) to very light (Yellow). Painting white text on all of
 * them leaves the light lines illegible, so callers pick a foreground here
 * instead of assuming one.
 */

const LIGHT_FOREGROUND = '#FFFFFF';
const DARK_FOREGROUND = '#101418';

/** WCAG relative luminance cut-off where dark text starts winning. */
const LUMINANCE_THRESHOLD = 0.55;

function parseColor(color: string): [number, number, number] | null {
  const hex = color.trim().replace('#', '');

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  const rgb = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }

  return null;
}

/** WCAG 2.1 relative luminance, 0 (black) to 1 (white). */
export function luminance(color: string): number {
  const parsed = parseColor(color);
  if (!parsed) return 0;

  const [r, g, b] = parsed.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Foreground that stays legible on `background`. */
export function onColor(background: string): string {
  return luminance(background) > LUMINANCE_THRESHOLD
    ? DARK_FOREGROUND
    : LIGHT_FOREGROUND;
}

/**
 * A translucent wash of `color`, for icon tiles that should carry a line's
 * hue without competing with the text beside them.
 */
export function tint(color: string, alpha = 0.16): string {
  const parsed = parseColor(color);
  if (!parsed) return 'transparent';
  const [r, g, b] = parsed;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
