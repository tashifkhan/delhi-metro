import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { RouteStrategy } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';

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
  const { isDark } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]}>
      {OPTIONS.map((option) => {
        const isActive = active === option.value;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.option,
              isActive && [
                styles.activeOption,
                { backgroundColor: isDark ? theme.colors.primaryContainer : theme.colors.surface },
              ],
            ]}
            onPress={() => onChange(option.value)}
          >
            <Ionicons
              name={option.icon}
              size={18}
              color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text
              variant="labelLarge"
              style={{
                color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant,
                fontWeight: isActive ? '700' : '500',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    borderRadius: 16,
  },
  activeOption: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
});
