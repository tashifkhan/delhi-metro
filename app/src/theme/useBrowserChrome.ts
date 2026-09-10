/**
 * Web-only concern: see `useBrowserChrome.web.ts`. Native chrome is the
 * OS's job, so this is a no-op.
 */
export function useBrowserChrome(
  _isDark: boolean,
  _backgroundColor: string,
  _enabled: boolean,
): void {}
