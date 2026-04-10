import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { JourneyRouteSegment } from '../types';
import { colors, spacing, typography } from '../theme';

interface Props {
  segment: JourneyRouteSegment;
  lineColor: string;
  isLast?: boolean;
  onStationPress?: (stationName: string) => void;
}

export function RouteSegmentView({ segment, lineColor, isLast, onStationPress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.lineDot, { backgroundColor: lineColor }]} />
        <Text style={styles.lineName}>{segment.line}</Text>
        {segment.path_time ? (
          <Text style={styles.pathTime}>{segment.path_time}</Text>
        ) : null}
      </View>

      <View style={styles.stationsContainer}>
        <View style={[styles.lineBar, { backgroundColor: lineColor }]} />
        <View style={styles.stations}>
          {segment.path.map((point, index) => (
            <View key={`${point.name}-${index}`} style={styles.stationRow}>
              <View style={[styles.stationDot, { borderColor: lineColor }]} />
              <Text
                style={[
                  styles.stationName,
                  index === 0 && styles.stationNameBold,
                  index === segment.path.length - 1 && styles.stationNameBold,
                ]}
                onPress={() => onStationPress?.(point.name)}
              >
                {point.name}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {!isLast && segment.station_interchange_time > 0 ? (
        <View style={styles.interchange}>
          <Ionicons name="git-compare" size={16} color={colors.interchange} />
          <Text style={styles.interchangeText}>
            Change here ({segment.station_interchange_time} min)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  lineName: {
    flex: 1,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  pathTime: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  stationsContainer: {
    flexDirection: 'row',
    marginLeft: 6,
    gap: spacing.md,
  },
  lineBar: {
    width: 3,
    borderRadius: 1.5,
  },
  stations: {
    flex: 1,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  stationName: {
    fontSize: typography.sizes.caption,
    color: colors.textSecondary,
  },
  stationNameBold: {
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  interchange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.lg,
    paddingVertical: spacing.sm,
  },
  interchangeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.interchange,
  },
});
