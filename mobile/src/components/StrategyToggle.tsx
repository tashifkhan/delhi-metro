import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteStrategy } from '../types';
import { colors, spacing, typography } from '../theme';

interface Props {
  active: RouteStrategy;
  onChange: (strategy: RouteStrategy) => void;
}

const OPTIONS: { value: RouteStrategy; label: string }[] = [
  { value: 'least-distance', label: 'Shortest' },
  { value: 'minimum-interchange', label: 'Fewest Changes' },
];

export function StrategyToggle({ active, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const isActive = active === option.value;
        return (
          <Pressable
            key={option.value}
            style={[styles.option, isActive && styles.activeOption]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.borderLight,
    borderRadius: 12,
    padding: 3,
  },
  option: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeOption: {
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  activeLabel: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});
