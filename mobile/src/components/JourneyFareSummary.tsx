import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { PlannedFare } from '../types';
import { NETWORK_NAMES } from '../network';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis, tabular } from '../theme';

interface Props {
  fare: PlannedFare;
  /** True when the journey crosses networks and needs a ticket on each. */
  separateTickets?: boolean;
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

export function JourneyFareSummary({ fare, separateTickets = false }: Props) {
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
      {separateTickets && fare.breakdown.length > 1 ? (
        <View style={[styles.breakdown, { backgroundColor: fills.subtle }]}>
          <View style={styles.breakdownHeader}>
            <Ionicons
              name="ticket-outline"
              size={14}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="labelMedium"
              style={[emphasis.strong, { color: theme.colors.onSurfaceVariant }]}
            >
              Two tickets — the networks are priced separately
            </Text>
          </View>
          {fare.breakdown.map((item) => (
            <View key={item.network} style={styles.breakdownRow}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {NETWORK_NAMES[item.network]}
              </Text>
              <Text
                variant="bodySmall"
                style={[emphasis.strong, tabular, { color: theme.colors.onSurface }]}
              >
                {formatInr(item.normal)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
  breakdown: {
    borderRadius: radius.card,
    padding: spacing.base,
    gap: spacing.xs,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
