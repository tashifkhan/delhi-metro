import { useEffect } from 'react';

/**
 * Keeps the browser chrome in step with the resolved app theme.
 *
 * iOS Safari and Chrome paint the strip below the page — the home-indicator
 * gap, overscroll, and the theme-color toolbar — from the document canvas
 * and `color-scheme`. Left at the UA default those are white, so a dark
 * app sits on a white bar. Native chrome is the OS's job; this is web-only.
 *
 * The HTML template plants a matching `#app-browser-chrome` rule before
 * the bundle loads (see `public/index.html`) so the first paint is already
 * the right colour. This hook takes over once stored settings have been
 * read, and must not run before that or it would clobber the boot colour
 * with the default (system) scheme for a frame.
 */
const STYLE_ELEMENT_ID = 'app-browser-chrome';

export function useBrowserChrome(
  isDark: boolean,
  backgroundColor: string,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;

    const scheme = isDark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.backgroundColor = backgroundColor;

    let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ELEMENT_ID;
      document.head.appendChild(style);
    }
    style.textContent =
      `html,body{background-color:${backgroundColor};color-scheme:${scheme};}`;

    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', backgroundColor);
      document.head.appendChild(meta);
    } else {
      metas.forEach((meta) => meta.setAttribute('content', backgroundColor));
    }

    const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
    if (colorSchemeMeta) {
      colorSchemeMeta.setAttribute('content', scheme);
    }

    const statusBar = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    );
    if (statusBar) {
      // `default` is a light bar with dark text; `black` is a dark bar
      // with light text. `black-translucent` is avoided on purpose —
      // it pins status-bar text to white in every theme.
      statusBar.setAttribute('content', isDark ? 'black' : 'default');
    }
  }, [isDark, backgroundColor, enabled]);
}
