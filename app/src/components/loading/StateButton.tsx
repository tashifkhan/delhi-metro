import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from '../Touchable';
import { emphasis, radius, spacing } from '../../theme';

interface Props {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** `filled` for the main action, `tonal` for a secondary one. */
  tone?: 'filled' | 'tonal';
  accessibilityHint?: string;
}

/** M3 common button, 40pt tall and fully rounded, for state screens and notices. */
export function StateButton({ label, onPress, icon, tone = 'filled', accessibilityHint }: Props) {
  const theme = useTheme();
  const bg = tone === 'filled' ? theme.colors.primary : theme.colors.secondaryContainer;
  const fg = tone === 'filled' ? theme.colors.onPrimary : theme.colors.onSecondaryContainer;

  return (
    <Touchable
      radius={radius.pill}
      haptic="press"
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={{ backgroundColor: bg }}
    >
      <View style={[styles.inner, icon ? styles.withIcon : null]}>
        {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        <Text variant="labelLarge" style={[emphasis.strong, { color: fg }]}>
          {label}
        </Text>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.xl,
  },
  withIcon: {
    paddingLeft: spacing.base,
  },
});
