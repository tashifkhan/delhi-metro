import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from './Touchable';
import type { PlannedLeg, PlannedStop } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, shape, emphasis, tabular, onColor } from '../theme';

interface Props {
  leg: PlannedLeg;
  lineColor: string;
  isLast?: boolean;
  stationCodeMap?: Map<string, string>;
  onStationPress?: (stationCode: string, stationName: string) => void;
}

const RAIL_WIDTH = 28;
const RAIL_THICKNESS = 8;

type RowKind = 'start' | 'middle' | 'end';

/**
 * One ride on one line, drawn as a thick rail in the line colour.
 *
 * The stops between boarding and alighting are folded by default. Most
 * people only need where to get on and where to get off, and a 17-stop leg
 * otherwise pushes the change and the second line off screen.
 */
export function RouteSegmentView({
  leg,
  lineColor,
  isLast,
  stationCodeMap,
  onStationPress,
}: Props) {
  const theme = useTheme();
  const { semantic, fills } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const pillText = onColor(lineColor);

  const stops: PlannedStop[] =
    leg.stops.length > 0
      ? leg.stops
      : [
          { name: leg.from_station, status: null },
          { name: leg.to_station, status: null },
        ];
  const first = stops[0];
  const last = stops[stops.length - 1];
  const middle = stops.slice(1, -1);

  const metaBits: string[] = [];
  if (leg.platform_name) metaBits.push(leg.platform_name);
  if (leg.towards_station) metaBits.push(`towards ${leg.towards_station}`);

  const foldBits: string[] = [`${middle.length + 1} ${middle.length === 0 ? 'stop' : 'stops'}`];
  if (leg.duration) foldBits.push(leg.duration);
  if (leg.distance_km != null && leg.distance_km > 0) {
    foldBits.push(`${leg.distance_km.toFixed(1)} km`);
  }

  const codeFor = (point: PlannedStop, index: number): string | undefined =>
    stationCodeMap?.get(point.name.trim().toLowerCase()) ??
    (index === 0 ? leg.from_station_code : null) ??
    (index === stops.length - 1 ? leg.to_station_code : null) ??
    undefined;

  const rail = (kind: RowKind, marker: 'terminus' | 'stop' | 'none') => (
    <View style={styles.rail}>
      <View
        style={[
          styles.railLine,
          { backgroundColor: lineColor },
          kind === 'start'
            ? styles.railFromCenter
            : kind === 'end'
              ? styles.railToCenter
              : styles.railThrough,
        ]}
      />
      {marker === 'terminus' ? (
        <View
          style={[
            styles.terminus,
            { borderColor: lineColor, backgroundColor: fills.containerLowest },
          ]}
        />
      ) : marker === 'stop' ? (
        <View style={[styles.stopDot, { backgroundColor: fills.containerLowest }]} />
      ) : null}
    </View>
  );

  const stationRow = (
    point: PlannedStop,
    index: number,
    kind: RowKind,
    detail?: ReactNode,
  ) => {
    const isTerminus = kind !== 'middle';
    const code = codeFor(point, index);
    const time = kind === 'start' ? leg.start_time : kind === 'end' ? leg.end_time : null;

    const row = (
      <View style={[styles.row, isTerminus && styles.rowTerminus]}>
        {rail(kind, isTerminus ? 'terminus' : 'stop')}
        <View style={styles.rowBody}>
          <View style={styles.nameLine}>
            <Text
              variant={isTerminus ? 'titleMedium' : 'bodyMedium'}
              style={[
                isTerminus ? emphasis.strong : undefined,
                styles.stationName,
                { color: isTerminus ? theme.colors.onSurface : theme.colors.onSurfaceVariant },
              ]}
            >
              {point.name}
            </Text>
            {time ? (
              <Text
                variant="labelLarge"
                style={[emphasis.strong, tabular, { color: theme.colors.onSurfaceVariant }]}
              >
                {time}
              </Text>
            ) : null}
          </View>
          {detail}
        </View>
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
  };

  return (
    <View>
      {stationRow(
        first,
        0,
        'start',
        <View style={styles.boardLine}>
          <View style={[styles.linePill, { backgroundColor: lineColor }]}>
            <Ionicons name="train" size={12} color={pillText} />
            <Text variant="labelMedium" style={[emphasis.heavy, { color: pillText }]}>
              {leg.line_name}
            </Text>
          </View>
          {metaBits.length > 0 ? (
            <Text
              variant="bodySmall"
              style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
            >
              {metaBits.join(', ')}
            </Text>
          ) : null}
        </View>,
      )}

      {/* The fold toggle sits on the rail, so the line visibly runs through it. */}
      <View style={styles.row}>
        {rail('middle', 'none')}
        <View style={styles.rowBody}>
          {middle.length > 0 ? (
            <Touchable
              radius={shape.md}
              haptic="select"
              onPress={() => setExpanded((v) => !v)}
              accessibilityState={{ expanded }}
              accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${middle.length} stops in between`}
              style={[styles.foldChip, { backgroundColor: fills.containerHigh }]}
            >
              <View style={styles.foldInner}>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.primary }]}>
                  {foldBits.join(', ')}
                </Text>
              </View>
            </Touchable>
          ) : (
            <Text
              variant="labelMedium"
              style={[styles.foldPlain, { color: theme.colors.onSurfaceVariant }]}
            >
              {foldBits.join(', ')}
            </Text>
          )}
        </View>
      </View>

      {expanded ? middle.map((point, i) => stationRow(point, i + 1, 'middle')) : null}

      {stationRow(
        last,
        stops.length - 1,
        'end',
        !isLast ? (
          <Text
            variant="bodySmall"
            style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}
          >
            Get off here
          </Text>
        ) : null,
      )}

      {/* Interchange callout after this leg (except the final leg). */}
      {!isLast && (leg.interchange_minutes ?? 0) > 0 ? (
        <View style={[styles.interchange, { backgroundColor: semantic.interchangeContainer }]}>
          <Ionicons name="git-compare" size={15} color={semantic.onInterchangeContainer} />
          <Text
            variant="labelMedium"
            style={[emphasis.strong, { color: semantic.onInterchangeContainer }]}
          >
            Change here, {leg.interchange_minutes} min
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingRight: spacing.sm,
  },
  rowTerminus: {
    minHeight: 44,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  railLine: {
    position: 'absolute',
    width: RAIL_THICKNESS,
    borderRadius: RAIL_THICKNESS / 2,
  },
  /** First row: the rail starts at the marker, so nothing is drawn above it. */
  railFromCenter: {
    top: 12,
    bottom: 0,
  },
  railThrough: {
    top: 0,
    bottom: 0,
  },
  /** Last row: the rail ends under the marker. */
  railToCenter: {
    top: 0,
    height: 22,
  },
  terminus: {
    marginTop: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 4,
  },
  stopDot: {
    marginTop: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowBody: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stationName: {
    flex: 1,
  },
  boardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  linePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: shape.sm - 2,
    flexShrink: 1,
  },
  meta: {
    flexShrink: 1,
  },
  foldChip: {
    alignSelf: 'flex-start',
  },
  foldInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 6,
  },
  foldPlain: {
    paddingVertical: 6,
  },
  interchange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: RAIL_WIDTH + spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.iconSmall,
    alignSelf: 'flex-start',
  },
});
