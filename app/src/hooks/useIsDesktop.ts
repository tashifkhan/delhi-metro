import { Platform, useWindowDimensions } from 'react-native';

/** Width for desktop-specific content layouts on the web. */
export const DESKTOP_BREAKPOINT = 960;

/** Opts screens into their desktop web presentation. */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return false;
  return width >= DESKTOP_BREAKPOINT;
}
