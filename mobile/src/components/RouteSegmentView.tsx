import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Touchable } from './Touchable';
import type { JourneyRouteSegment } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, shape, emphasis, onColor } from '../theme';

interface Props {
  segment: JourneyRouteSegment;
  lineColor: string;
  isLast?: boolean;
  stationCodeMap?: Map<string, string>;
  onStationPress?: (stationCode: string, stationName: string) => void;
}

const RAIL_WIDTH = 28;
const RAIL_THICKNESS = 3;

export function RouteSegmentView({
  segment,
  lineColor,
  isLast,
  stationCodeMap,
  onStationPress,
}: Props) {
  const theme = useTheme();
  const { semantic } = useAppTheme();
  const pillText = onColor(lineColor);

  return (
    <View style={styles.container}>
      {/* Line header */}
      <View style={styles.header}>
        <View style={[styles.linePill, { backgroundColor: lineColor }]}>
          <Ionicons name="train" size={12} color={pillText} />
          <Text variant="labelMedium" style={[emphasis.heavy, { color: pillText }]}>
            {segment.line}
          </Text>
        </View>
        {segment.path_time ? (
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={12} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {segment.path_time}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Station timeline — dots ride on the rail rather than sitting beside it */}
      <View style={styles.stations}>
        {segment.path.map((point, index) => {
          const isFirst = index === 0;
          const isTerminus = isFirst || index === segment.path.length - 1;
          const code = stationCodeMap?.get(point.name.trim().toLowerCase());
          const isLastRow = index === segment.path.length - 1;

          const row = (
            <View style={styles.stationRow}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.railLine,
                    { backgroundColor: lineColor },
                    isFirst && styles.railLineFromCenter,
                    isLastRow && styles.railLineToCenter,
                  ]}
                />
                <View
                  style={[
                    styles.stationDot,
                    {
                      borderColor: lineColor,
                      backgroundColor: isTerminus ? lineColor : theme.colors.background,
                    },
                    isTerminus && styles.stationDotTerminus,
                  ]}
                />
              </View>

              <Text
                variant={isTerminus ? 'bodyMedium' : 'bodySmall'}
                style={[
                  isTerminus ? emphasis.strong : undefined,
                  styles.stationName,
                  {
                    color: isTerminus
                      ? theme.colors.onSurface
                      : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                {point.name}
              </Text>

              {code ? (
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={theme.colors.outline}
                />
              ) : null}
            </View>
          );

          return code && onStationPress ? (
            <Touchable
              key={`${point.name}-${index}`}
              radius={shape.md}
              onPress={() => onStationPress(code, point.name)}
              accessibilityLabel={`${point.name}, view station details`}
            >
              {row}
            </Touchable>
          ) : (
            <View key={`${point.name}-${index}`}>{row}</View>
          );
        })}
      </View>

      {/* Interchange callout */}
      {!isLast && segment.station_interchange_time > 0 ? (
        <View
          style={[
            styles.interchange,
            { backgroundColor: semantic.interchangeContainer },
          ]}
        >
          <Ionicons name="git-compare" size={15} color={semantic.onInterchangeContainer} />
          <Text
            variant="labelMedium"
            style={[emphasis.strong, { color: semantic.onInterchangeContainer }]}
          >
            Change here · {segment.station_interchange_time} min
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
    gap: spacing.sm,
  },
  linePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    flexShrink: 1,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stations: {
    marginLeft: spacing.xs,
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
    minHeight: 40,
  },
  rail: {
    width: RAIL_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLine: {
    position: 'absolute',
    width: RAIL_THICKNESS,
    top: 0,
    bottom: 0,
    borderRadius: RAIL_THICKNESS / 2,
  },
  /** First row: the rail starts at the dot, so nothing is drawn above it. */
  railLineFromCenter: {
    top: '50%',
  },
  /** Last row: the rail ends at the dot. */
  railLineToCenter: {
    bottom: '50%',
  },
  stationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
  },
  stationDotTerminus: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 0,
  },
  stationName: {
    flex: 1,
  },
  interchange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.iconSmall,
    alignSelf: 'flex-start',
  },
});
