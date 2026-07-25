/**
 * Contrast helpers for line colors.
 *
 * Metro line colors arrive from the DMRC API and span the full range from
 * near-black (Violet) to very light (Yellow). Painting white text on all of
 * them leaves the light lines illegible, so callers pick a foreground here
 * instead of assuming one.
 */

import { luminance, rgba } from './colorMath';

const LIGHT_FOREGROUND = '#FFFFFF';
const DARK_FOREGROUND = '#101418';

/** WCAG relative luminance cut-off where dark text starts winning. */
const LUMINANCE_THRESHOLD = 0.55;

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
  return rgba(color, alpha);
}

export { luminance };
