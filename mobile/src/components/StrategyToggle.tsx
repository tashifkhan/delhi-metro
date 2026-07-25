import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Touchable } from './Touchable';
import type { RouteStrategy } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, shape, emphasis } from '../theme';

interface Props {
  active: RouteStrategy;
  onChange: (strategy: RouteStrategy) => void;
}

const OPTIONS: { value: RouteStrategy; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'least-distance', label: 'Shortest', icon: 'git-commit-outline' },
  { value: 'minimum-interchange', label: 'Fewest Changes', icon: 'swap-horizontal-outline' },
];

export function StrategyToggle({ active, onChange }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: fills.subtleStrong }]}
      accessibilityRole="radiogroup"
    >
      {OPTIONS.map((option) => {
        const isActive = active === option.value;
        const foreground = isActive ? theme.colors.primary : theme.colors.onSurfaceVariant;

        return (
          <View key={option.value} style={styles.slot}>
            <Touchable
              radius={shape.md}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Route preference: ${option.label}`}
              style={isActive ? { backgroundColor: fills.selected } : undefined}
            >
              <View style={styles.option}>
                <Ionicons name={option.icon} size={18} color={foreground} />
                <Text
                  variant="labelLarge"
                  style={[isActive ? emphasis.heavy : emphasis.medium, { color: foreground }]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </View>
            </Touchable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: shape.lg,
    padding: 4,
    gap: 4,
  },
  slot: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
});
