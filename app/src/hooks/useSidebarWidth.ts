import { useWindowDimensions } from 'react-native';

/** Use the current app window so split-screen and fold-state changes reflow. */
export function useSidebarWidth(): number {
  const { width } = useWindowDimensions();
  if (width < 600) return 0;
  return width >= 960 ? 272 : 216;
}
