import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { NETWORK_NAMES, useMetroNetwork, type MetroNetwork } from '../network';
import { OperatorMark } from './OperatorMark';
import { Touchable } from './Touchable';
import { emphasis, radius, spacing } from '../theme';

const OPTIONS: { value: MetroNetwork; label: string }[] = [
  { value: 'dmrc', label: 'DMRC' },
  { value: 'nmrc', label: 'NMRC' },
];

export function NetworkSwitcher({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const { network, setNetwork } = useMetroNetwork();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceVariant,
          padding: compact ? 2 : 3,
        },
      ]}
      accessibilityRole="radiogroup"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === network;
        return (
          <Touchable
            key={option.value}
            radius={radius.pill}
            haptic="select"
            onPress={() => setNetwork(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            // The operator's initials are the label; the full name belongs in
            // the spoken description rather than on screen.
            accessibilityLabel={`Show ${NETWORK_NAMES[option.value]} first`}
            accessibilityHint="Station search covers both networks either way"
            style={{
              backgroundColor: selected ? theme.colors.primary : 'transparent',
            }}
          >
            <View style={[styles.option, compact && styles.compactOption]}>
              <OperatorMark network={option.value} size={compact ? 14 : 17} />
              <Text
                variant={compact ? 'labelSmall' : 'labelMedium'}
                style={[
                  emphasis.strong,
                  {
                    color: selected
                      ? theme.colors.onPrimary
                      : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {option.label}
              </Text>
            </View>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    gap: 2,
  },
  option: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  compactOption: {
    minHeight: 28,
    paddingHorizontal: spacing.xs,
    gap: 4,
  },
});
