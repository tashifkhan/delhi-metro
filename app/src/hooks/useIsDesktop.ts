import { Platform, useWindowDimensions } from 'react-native';

/** Viewport width at or above which the web build uses the desktop shell. */
export const DESKTOP_BREAKPOINT = 960;

/**
 * True only on the web build at desktop widths. Native always uses the mobile
 * UI, and narrow web viewports keep the tab bar so phones get the same layout
 * as the app. `useWindowDimensions` re-renders on resize, so rotating or
 * resizing across the breakpoint swaps shells live.
 */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return false;
  return width >= DESKTOP_BREAKPOINT;
}
