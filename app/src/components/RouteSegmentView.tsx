import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from './Touchable';
import type { PlannedLeg, PlannedStop } from '../types';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing, radius, shape, emphasis, tabular, onColor } from '../theme';
import { clockTime, durationLabel, stationName } from '../utils/format';

interface Props {
  leg: PlannedLeg;
  lineColor: string;
  isLast?: boolean;
  stationCodeMap?: Map<string, string>;
  onStationPress?: (stationCode: string, stationName: string) => void;
}

/** Shared with `TransferSegmentView` so the walk leg lines up with the rails. */
export const TIMELINE = {
  timeWidth: 44,
  railWidth: 22,
  gap: 10,
} as const;

const RAIL_THICKNESS = 8;
const MARKER = 20;

type RowKind = 'start' | 'middle' | 'end' | 'fold';

/**
 * One ride on one line: times on the left, a thick rail in the line colour,
 * stations on the right.
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
  const rideStops = middle.length + 1;

  const metaBits: string[] = [];
  if (leg.platform_name) metaBits.push(leg.platform_name.replace(/^Platform No\.\s*/i, 'Platform '));
  if (leg.towards_station) metaBits.push(`to ${stationName(leg.towards_station)}`);

  const foldBits: string[] = [`${rideStops} ${rideStops === 1 ? 'stop' : 'stops'}`];
  const legDuration = durationLabel(leg.duration);
  if (legDuration) foldBits.push(legDuration);

  const codeFor = (point: PlannedStop, index: number): string | undefined =>
    stationCodeMap?.get(point.name.trim().toLowerCase()) ??
    (index === 0 ? leg.from_station_code : null) ??
    (index === stops.length - 1 ? leg.to_station_code : null) ??
    undefined;

  const rail = (kind: RowKind) => (
    <View style={styles.rail}>
      <View
        style={[
          styles.railLine,
          { backgroundColor: lineColor },
          kind === 'start' ? styles.railFromMarker : kind === 'end' ? styles.railToMarker : styles.railThrough,
        ]}
      />
      {kind === 'start' || kind === 'end' ? (
        <View
          style={[styles.marker, { borderColor: lineColor, backgroundColor: fills.containerLowest }]}
        />
      ) : kind === 'middle' ? (
        <View style={[styles.stopDot, { backgroundColor: fills.containerLowest }]} />
      ) : null}
    </View>
  );

  const timeCell = (value: string | null) => (
    <View style={styles.timeCell}>
      {value ? (
        <Text
          variant="labelLarge"
          style={[emphasis.strong, tabular, styles.time, { color: theme.colors.onSurface }]}
        >
          {value}
        </Text>
      ) : null}
    </View>
  );

  const stationRow = (point: PlannedStop, index: number, kind: 'start' | 'middle' | 'end', detail?: ReactNode) => {
    const isTerminus = kind !== 'middle';
    const code = codeFor(point, index);
    const time = kind === 'start' ? clockTime(leg.start_time) : kind === 'end' ? clockTime(leg.end_time) : null;
    const name = stationName(point.name);

    const row = (
      <View style={styles.row}>
        {timeCell(time)}
        {rail(kind)}
        <View style={[styles.body, kind === 'middle' && styles.bodyMiddle]}>
          <Text
            variant={isTerminus ? 'titleMedium' : 'bodyMedium'}
            style={[
              isTerminus ? emphasis.strong : undefined,
              { color: isTerminus ? theme.colors.onSurface : theme.colors.onSurfaceVariant },
            ]}
          >
            {name}
          </Text>
          {detail}
        </View>
      </View>
    );

    return code && onStationPress ? (
      <Touchable
        key={`${point.name}-${index}`}
        radius={shape.md}
        onPress={() => onStationPress(code, name)}
        accessibilityLabel={`${name}, view station details`}
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
        <View style={styles.info}>
          <View style={[styles.linePill, { backgroundColor: lineColor }]}>
            <Ionicons name="train" size={12} color={pillText} />
            <Text variant="labelMedium" style={[emphasis.heavy, { color: pillText }]}>
              {leg.line_name.replace(/\s+line$/i, '')}
            </Text>
          </View>
          {metaBits.length > 0 ? (
            <Text variant="bodySmall" style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
              {metaBits.join(', ')}
            </Text>
          ) : null}
        </View>,
      )}

      {/* The fold toggle sits on the rail, so the line visibly runs through it. */}
      <View style={styles.row}>
        {timeCell(null)}
        {rail('fold')}
        <View style={[styles.body, styles.bodyFold]}>
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
            <Text variant="labelMedium" style={[styles.foldPlain, { color: theme.colors.onSurfaceVariant }]}>
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
          <Text variant="bodySmall" style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
            Get off here
          </Text>
        ) : null,
      )}

      {/* Interchange callout after this leg (except the final leg). */}
      {!isLast && (leg.interchange_minutes ?? 0) > 0 ? (
        <View style={[styles.interchange, { backgroundColor: semantic.interchangeContainer }]}>
          <Ionicons name="git-compare" size={15} color={semantic.onInterchangeContainer} />
          <Text variant="labelMedium" style={[emphasis.strong, { color: semantic.onInterchangeContainer }]}>
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
    gap: TIMELINE.gap,
  },
  timeCell: {
    width: TIMELINE.timeWidth,
    alignItems: 'flex-end',
  },
  time: {
    marginTop: 2,
  },
  rail: {
    width: TIMELINE.railWidth,
    alignItems: 'center',
  },
  // Square ends: rounded ends left notches where one row's rail met the next.
  railLine: {
    position: 'absolute',
    width: RAIL_THICKNESS,
  },
  railFromMarker: {
    top: MARKER / 2,
    bottom: 0,
  },
  railThrough: {
    top: 0,
    bottom: 0,
  },
  railToMarker: {
    top: 0,
    height: MARKER / 2,
  },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 4,
  },
  stopDot: {
    marginTop: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.base,
    paddingRight: spacing.sm,
    gap: 6,
  },
  bodyMiddle: {
    paddingBottom: spacing.md,
  },
  bodyFold: {
    paddingBottom: spacing.md,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  linePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: 6,
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
    marginLeft: TIMELINE.timeWidth + TIMELINE.railWidth + TIMELINE.gap * 2,
    marginBottom: spacing.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.iconSmall,
    alignSelf: 'flex-start',
  },
});
