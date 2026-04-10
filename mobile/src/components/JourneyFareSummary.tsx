import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { JourneyFareWithRoute } from '../types';
import { colors, spacing, typography } from '../theme';

interface Props {
  fare: JourneyFareWithRoute;
}

function InfoPill({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View>
        <Text style={styles.pillLabel}>{label}</Text>
        <Text style={styles.pillValue}>{value}</Text>
      </View>
    </View>
  );
}

export function JourneyFareSummary({ fare }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <InfoPill icon="navigate-outline" label="Stations" value={String(fare.stations)} />
        <InfoPill icon="time-outline" label="Duration" value={fare.total_time} />
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <InfoPill icon="card-outline" label="Weekday" value={`₹${fare.weekday_fare}`} />
        <InfoPill icon="card-outline" label="Weekend" value={`₹${fare.weekend_fare}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
  },
  pillLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  pillValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
});
