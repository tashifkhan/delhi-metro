import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { JourneyFareWithRoute } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';

interface Props {
  fare: JourneyFareWithRoute;
}

function FareCard({ icon, label, value, accent }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: boolean;
}) {
  const theme = useTheme();
  const { isDark } = useAppTheme();

  const bg = accent
    ? theme.colors.primaryContainer
    : isDark ? theme.colors.elevation.level3 : theme.colors.secondaryContainer;
  const fg = accent ? theme.colors.onPrimaryContainer : isDark ? theme.colors.onSurface : theme.colors.onSecondaryContainer;

  return (
    <View style={[styles.fareCard, { backgroundColor: bg }]}>
      <View style={[styles.fareIconCircle, { backgroundColor: accent ? (isDark ? theme.colors.primary : theme.colors.onPrimaryContainer) : theme.colors.outline, opacity: accent ? 1 : 0.2 }]} />
      <Ionicons
        name={icon}
        size={20}
        color={fg}
        style={styles.fareIcon}
      />
      <Text variant="labelSmall" style={{ color: fg, opacity: 0.7, marginTop: spacing.sm }}>
        {label}
      </Text>
      <Text variant="headlineSmall" style={{ color: fg, fontWeight: '800' }}>
        {value}
      </Text>
    </View>
  );
}

export function JourneyFareSummary({ fare }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <FareCard icon="card-outline" label="Weekday" value={`₹${fare.weekday_fare}`} accent />
        <FareCard icon="card-outline" label="Weekend" value={`₹${fare.weekend_fare}`} accent />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fareCard: {
    flex: 1,
    borderRadius: 20,
    padding: spacing.base,
    position: 'relative',
    overflow: 'hidden',
  },
  fareIconCircle: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  fareIcon: {
    marginBottom: spacing.xs,
  },
});
