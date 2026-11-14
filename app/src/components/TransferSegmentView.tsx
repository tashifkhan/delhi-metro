import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PlannedLeg } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, shape, emphasis } from '../theme';

interface Props {
  leg: PlannedLeg;
}

const RAIL_WIDTH = 28;
const DASHES = 6;

/**
 * The walk between the two operators' networks.
 *
 * Drawn as a dotted break in the rail rather than a coloured line: nothing is
 * running here, the traveller leaves one system and buys a ticket in the
 * other, and that break is the part most worth noticing in the route list.
 */
export function TransferSegmentView({ leg }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  const metaBits: string[] = [];
  if (leg.walk_metres) metaBits.push(`about ${leg.walk_metres} m`);
  if (leg.duration) metaBits.push(leg.duration);

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {Array.from({ length: DASHES }, (_, index) => (
          <View key={index} style={[styles.dash, { backgroundColor: theme.colors.outline }]} />
        ))}
      </View>

      <View style={[styles.box, { backgroundColor: fills.containerHigh }]}>
        <Ionicons name="walk" size={20} color={theme.colors.primary} />
        <View style={styles.text}>
          <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
            Walk to {leg.to_station}
          </Text>
          {metaBits.length > 0 ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {metaBits.join(', ')}
            </Text>
          ) : null}
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingRight: spacing.sm,
    paddingBottom: spacing.md,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  dash: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: shape.lg,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  note: {
    marginTop: 2,
    lineHeight: 18,
  },
});
