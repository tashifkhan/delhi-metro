import { Platform, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

/**
 * Stand-in for Paper's MaterialCommunityIcon.
 *
 * Paper asks for Material names. The app draws everything else in Ionicons,
 * and Metro sends Paper's icon requires here so the Material font is never
 * bundled. Each name Paper actually requests is mapped below.
 */
const NAMES: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  magnify: 'search',
  close: 'close',
  'close-circle-outline': 'close-circle-outline',
  menu: 'menu',
  'arrow-left': 'arrow-back',
  'dots-vertical': 'ellipsis-vertical',
  'dots-horizontal': 'ellipsis-horizontal',
  check: 'checkmark',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  'chevron-right': 'chevron-forward',
  'chevron-left': 'chevron-back',
  plus: 'add',
  minus: 'remove',
  download: 'download-outline',
  'progress-download': 'cloud-download-outline',
  refresh: 'refresh',
  'open-in-new': 'open-outline',
};

export const accessibilityProps =
  Platform.OS === 'web'
    ? { role: 'img' as const, focusable: false }
    : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

function PaperIcon({
  name,
  color,
  size,
  direction,
  allowFontScaling,
  testID,
}: {
  name: string;
  color?: string;
  size?: number;
  direction?: 'rtl' | 'ltr';
  allowFontScaling?: boolean;
  testID?: string;
}) {
  return (
    <Ionicons
      allowFontScaling={allowFontScaling}
      name={NAMES[name] ?? 'ellipse'}
      color={color}
      size={size}
      testID={testID}
      selectable={false}
      pointerEvents="none"
      style={[
        styles.icon,
        { transform: [{ scaleX: direction === 'rtl' ? -1 : 1 }], lineHeight: size },
      ]}
      {...accessibilityProps}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    backgroundColor: 'transparent',
  },
});

// Paper's own loader does `require(...MaterialCommunityIcons).default`. A bare
// default export would throw there, so the same component is the default too.
const paperIconModule = Object.assign(PaperIcon, { default: PaperIcon });

export default paperIconModule;
