import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { PlannedFare } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis, tabular } from '../theme';

interface Props {
  fare: PlannedFare;
}

function formatInr(value: number): string {
  // Keep whole-rupee fares as integers; show decimals only when needed.
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `₹${rounded}`;
}

function FareCard({
  icon,
  label,
  value,
  background,
  foreground,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  background: string;
  foreground: string;
}) {
  return (
    <View style={[styles.fareCard, { backgroundColor: background }]}>
      <View style={styles.fareHeader}>
        <Ionicons name={icon} size={16} color={foreground} />
        <Text variant="labelMedium" style={[styles.fareLabel, { color: foreground }]}>
          {label}
        </Text>
      </View>
      <Text variant="headlineSmall" style={[emphasis.heavy, tabular, { color: foreground }]}>
        {value}
      </Text>
    </View>
  );
}

export function JourneyFareSummary({ fare }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  const weekendValue = fare.special ?? fare.normal;
  const showApplicable =
    fare.applicable !== null &&
    fare.applicable !== fare.normal &&
    fare.applicable !== weekendValue;

  return (
    <View style={styles.column}>
      <View style={styles.row}>
        <FareCard
          icon="card-outline"
          label="Weekday"
          value={formatInr(fare.normal)}
          background={theme.colors.primaryContainer}
          foreground={theme.colors.onPrimaryContainer}
        />
        <FareCard
          icon="calendar-outline"
          label="Weekend"
          value={formatInr(weekendValue)}
          background={fills.subtle}
          foreground={theme.colors.onSurface}
        />
      </View>
      {showApplicable ? (
        <View
          style={[
            styles.applicablePill,
            { backgroundColor: theme.colors.secondaryContainer },
          ]}
        >
          <Ionicons
            name="pricetag-outline"
            size={14}
            color={theme.colors.onSecondaryContainer}
          />
          <Text
            variant="labelLarge"
            style={[emphasis.strong, { color: theme.colors.onSecondaryContainer }]}
          >
            Fare at departure · {formatInr(fare.applicable!)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fareCard: {
    flex: 1,
    borderRadius: radius.card,
    padding: spacing.base,
    gap: spacing.sm,
  },
  fareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fareLabel: {
    opacity: 0.8,
  },
  applicablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
});
