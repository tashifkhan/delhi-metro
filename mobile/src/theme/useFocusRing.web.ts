import { useEffect } from 'react';

/**
 * Replaces the browser's default focus ring.
 *
 * Left alone, the user agent draws a thick rectangle in the system accent
 * colour around whatever is focused — including after a tap, where it reads as
 * a rendering fault rather than a focus cue. Keyboard focus still needs to be
 * visible, so the ring is kept for `:focus-visible` only and drawn in the
 * app's own primary colour.
 *
 * The colour arrives through a custom property so the rules can be injected
 * once and still follow palette and light/dark changes.
 */
const STYLE_ELEMENT_ID = 'app-focus-ring';

const FOCUS_RING_CSS = `
:focus:not(:focus-visible) {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--app-focus-ring);
  outline-offset: 2px;
}
`;

export function useFocusRing(color: string): void {
  useEffect(() => {
    if (!document.getElementById(STYLE_ELEMENT_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ELEMENT_ID;
      style.textContent = FOCUS_RING_CSS;
      document.head.appendChild(style);
    }

    document.documentElement.style.setProperty('--app-focus-ring', color);
  }, [color]);
}
