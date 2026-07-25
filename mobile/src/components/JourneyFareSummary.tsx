import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { JourneyFareWithRoute } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis, tabular } from '../theme';

interface Props {
  fare: JourneyFareWithRoute;
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

  return (
    <View style={styles.row}>
      <FareCard
        icon="card-outline"
        label="Weekday"
        value={`₹${fare.weekday_fare}`}
        background={theme.colors.primaryContainer}
        foreground={theme.colors.onPrimaryContainer}
      />
      <FareCard
        icon="calendar-outline"
        label="Weekend"
        value={`₹${fare.weekend_fare}`}
        background={fills.subtle}
        foreground={theme.colors.onSurface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
