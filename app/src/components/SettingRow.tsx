import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { Touchable } from './Touchable';
import { Switch } from './Switch';
import { useHaptics } from '../hooks/useHaptics';
import { emphasis, spacing } from '../theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string;
  onPress?: () => void;
  /** Renders a switch; the whole row toggles it. */
  toggle?: { value: boolean; onChange: (next: boolean) => void };
  trailing?: ReactNode;
  disabled?: boolean;
}

/** One row of a settings list: navigates, or toggles a switch. */
export function SettingRow({ icon, title, detail, onPress, toggle, trailing, disabled }: Props) {
  const theme = useTheme();
  const haptics = useHaptics();
  const press = toggle
    ? () => {
        haptics.toggle(!toggle.value);
        toggle.onChange(!toggle.value);
      }
    : onPress;

  return (
    <Touchable
      radius={0}
      haptic={toggle ? false : 'navigate'}
      onPress={press}
      disabled={disabled}
      accessibilityRole={toggle ? 'checkbox' : 'button'}
      accessibilityState={toggle ? { selected: toggle.value, disabled } : { disabled }}
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
    >
      <View style={[styles.row, disabled && { opacity: 0.5 }]}>
        {icon ? <Ionicons name={icon} size={22} color={theme.colors.onSurfaceVariant} /> : null}
        <View style={styles.text}>
          <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          {detail ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {detail}
            </Text>
          ) : null}
        </View>
        {/* Display-only: the row owns the gesture, or the tap would toggle twice. */}
        {toggle ? <Switch value={toggle.value} /> : trailing}
        {!toggle && !trailing && onPress ? (
          <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceVariant} />
        ) : null}
      </View>
    </Touchable>
  );
}

export function SettingDivider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 64,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.base,
  },
});
