import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { PlannedLeg } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, emphasis } from '../theme';

interface Props {
  leg: PlannedLeg;
}

const RAIL_WIDTH = 28;

/**
 * The walk between the two operators' networks.
 *
 * Rendered as a dashed break rather than a coloured line: nothing is running
 * here, the traveller leaves one system and buys a ticket in the other, and
 * that break is the part most worth noticing in the route list.
 */
export function TransferSegmentView({ leg }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  const metaBits: string[] = [];
  if (leg.duration) {
    metaBits.push(leg.duration);
  }
  if (leg.walk_metres) {
    metaBits.push(`about ${leg.walk_metres} m`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.pill, { backgroundColor: fills.inset }]}>
          <Ionicons name="walk" size={13} color={theme.colors.onSurfaceVariant} />
          <Text
            variant="labelMedium"
            style={[emphasis.heavy, { color: theme.colors.onSurfaceVariant }]}
          >
            Change networks
          </Text>
        </View>
        {metaBits.length > 0 ? (
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {metaBits.join(' · ')}
          </Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.rail}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[styles.dash, { backgroundColor: theme.colors.outlineVariant }]}
            />
          ))}
        </View>

        <View style={styles.content}>
          <Text
            variant="bodyMedium"
            style={[emphasis.strong, { color: theme.colors.onSurface }]}
          >
            {leg.from_station} → {leg.to_station}
          </Text>
          {leg.note ? (
            <Text
              variant="bodySmall"
              style={[styles.note, { color: theme.colors.onSurfaceVariant }]}
            >
              {leg.note}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  body: {
    flexDirection: 'row',
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    paddingTop: 4,
    gap: 4,
  },
  dash: {
    width: 3,
    height: 6,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingBottom: spacing.xs,
  },
  note: {
    marginTop: 2,
    lineHeight: 18,
  },
});
