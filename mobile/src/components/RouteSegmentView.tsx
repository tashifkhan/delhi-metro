import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { JourneyRouteSegment } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';

interface Props {
  segment: JourneyRouteSegment;
  lineColor: string;
  isLast?: boolean;
  onStationPress?: (stationName: string) => void;
}

export function RouteSegmentView({ segment, lineColor, isLast, onStationPress }: Props) {
  const theme = useTheme();
  const { semantic, isDark } = useAppTheme();

  return (
    <View style={styles.container}>
      {/* Line header with colored pill */}
      <View style={styles.header}>
        <View style={[styles.linePill, { backgroundColor: lineColor }]}>
          <View style={styles.linePillDot} />
          <Text variant="labelMedium" style={{ color: '#fff', fontWeight: '700' }}>
            {segment.line}
          </Text>
        </View>
        {segment.path_time ? (
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            {segment.path_time}
          </Text>
        ) : null}
      </View>

      {/* Station list */}
      <View style={styles.stationsContainer}>
        <View style={[styles.lineBar, { backgroundColor: lineColor, opacity: isDark ? 0.6 : 0.4 }]} />
        <View style={styles.stations}>
          {segment.path.map((point, index) => {
            const isBold = index === 0 || index === segment.path.length - 1;
            return (
              <View key={`${point.name}-${index}`} style={styles.stationRow}>
                <View
                  style={[
                    styles.stationDot,
                    {
                      borderColor: lineColor,
                      backgroundColor: isBold ? lineColor : theme.colors.surface,
                    },
                    isBold && styles.stationDotBold,
                  ]}
                />
                <Text
                  variant={isBold ? 'bodyMedium' : 'bodySmall'}
                  style={{
                    color: isBold ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                    fontWeight: isBold ? '600' : '400',
                  }}
                  onPress={() => onStationPress?.(point.name)}
                >
                  {point.name}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Interchange indicator */}
      {!isLast && segment.station_interchange_time > 0 ? (
        <View style={[styles.interchange, { backgroundColor: semantic.warningContainer, opacity: isDark ? 1 : 0.5 }]}>
          <Ionicons name="git-compare" size={16} color={semantic.interchange} />
          <Text variant="labelMedium" style={{ color: semantic.interchange, fontWeight: '600' }}>
            Change here ({segment.station_interchange_time} min)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  linePillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  stationsContainer: {
    flexDirection: 'row',
    marginLeft: 14,
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
  },
  stationDotBold: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 0,
  },
  interchange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
});
