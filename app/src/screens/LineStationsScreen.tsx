import { useLayoutEffect, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { useMetroLinesQuery, useStationSearchQuery, useStationsByLineQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { Touchable } from '../components/Touchable';
import {
  LineGlyph,
  lineGlyph,
  lineStationName,
  lineTitle,
  terminalName,
} from '../components/LineGlyph';
import { useAppTheme } from '../theme/ThemeContext';
import type { StationByLineItem, StationLineBadge } from '../types';
import type { LinesStackParamList } from '../navigation/types';
import { spacing, shape, emphasis, onColor } from '../theme';

type Nav = NativeStackNavigationProp<LinesStackParamList, 'LineStations'>;
type Route = RouteProp<LinesStackParamList, 'LineStations'>;

const RAIL_COLUMN = 24;
const RAIL_THICKNESS = 8;
const MARKER = 20;
const ROW_PAD_TOP = 14;
/** Vertical centre of the marker, measured from the top of a row. */
const MARKER_CENTRE = ROW_PAD_TOP + MARKER / 2;

/** "Yellow Line" to "Yellow", for the small chips on interchange rows. */
function shortName(line: StationLineBadge): string {
  const name = (line.line_color || line.line_name).replace(/\s+line$/i, '').trim();
  return /^[A-Z]{2,5}$/.test(name) ? line.line_name : name;
}

function StationRow({
  station,
  lineColor,
  others,
  isFirst,
  isLast,
  onPress,
}: {
  station: StationByLineItem;
  lineColor: string;
  others: StationLineBadge[];
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const isTerminus = isFirst || isLast;
  const showInterchange = station.interchange || others.length > 0;
  const name = lineStationName(station.station_name);

  return (
    <View
      style={[
        styles.rowShell,
        { backgroundColor: fills.containerLow },
        isFirst && styles.rowShellFirst,
        isLast && styles.rowShellLast,
      ]}
    >
      <Touchable
        radius={shape.md}
        onPress={onPress}
        accessibilityLabel={`${name}${isTerminus ? ', terminus' : ''}${
          showInterchange
            ? `, change for ${others.map((line) => shortName(line)).join(', ') || 'another line'}`
            : ''
        }`}
      >
        <View style={styles.row}>
          {/* Square ends that meet the next row exactly, so the rail never notches. */}
          <View style={styles.rail}>
            <View
              style={[
                styles.railLine,
                { backgroundColor: lineColor },
                isFirst ? { top: MARKER_CENTRE } : { top: 0 },
                isLast ? { height: MARKER_CENTRE } : { bottom: 0 },
              ]}
            />
            {isTerminus || showInterchange ? (
              <View
                style={[
                  styles.marker,
                  { borderColor: lineColor, backgroundColor: fills.containerLowest },
                  showInterchange && !isTerminus && styles.markerInterchange,
                ]}
              />
            ) : (
              <View style={[styles.stopDot, { backgroundColor: fills.containerLowest }]} />
            )}
          </View>

          <View style={styles.body}>
            <Text
              variant={isTerminus || showInterchange ? 'titleMedium' : 'bodyLarge'}
              style={[
                isTerminus || showInterchange ? emphasis.strong : undefined,
                { color: theme.colors.onSurface },
              ]}
            >
              {name}
            </Text>
            {isTerminus || showInterchange ? (
              <View style={styles.tags}>
                {isTerminus ? (
                  <View style={[styles.tag, { backgroundColor: fills.containerHigh }]}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {isFirst ? 'Start' : 'End'} of line
                    </Text>
                  </View>
                ) : null}
                {others.map((line) => (
                  <View
                    key={line.line_code}
                    style={[styles.tag, { backgroundColor: line.primary_color_code }]}
                  >
                    <Ionicons name="swap-horizontal" size={12} color={onColor(line.primary_color_code)} />
                    <Text
                      variant="labelMedium"
                      style={[emphasis.strong, { color: onColor(line.primary_color_code) }]}
                    >
                      {shortName(line)}
                    </Text>
                  </View>
                ))}
                {showInterchange && others.length === 0 ? (
                  <View style={[styles.tag, { backgroundColor: fills.containerHigh }]}>
                    <Ionicons name="swap-horizontal" size={12} color={theme.colors.onSurfaceVariant} />
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      Interchange
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} style={styles.chevron} />
        </View>
      </Touchable>
    </View>
  );
}

export function LineStationsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const theme = useTheme();
  const { fills } = useAppTheme();
  // Deep links (/lines/LN2) carry only the code, so name and colour may be missing.
  const { lineCode } = route.params;
  const { data, isLoading, isError, isOfflineCopy, refetch } = useStationsByLineQuery(lineCode);
  const { data: lines } = useMetroLinesQuery();
  const { data: allStations } = useStationSearchQuery('');

  const line = useMemo(
    () => (lines ?? []).find((item) => item.line_code === lineCode),
    [lines, lineCode],
  );
  const lineName = route.params.lineName ?? line?.name ?? lineCode;
  const lineColor = route.params.lineColor ?? line?.primary_color_code ?? theme.colors.primary;

  // The app bar title comes from the route params, which a deep link lacks.
  useLayoutEffect(() => {
    if (!route.params.lineName && line) navigation.setOptions({ title: line.name });
  }, [navigation, route.params.lineName, line]);

  // Other lines at each station, for the interchange chips.
  const othersByCode = useMemo(() => {
    const map = new Map<string, StationLineBadge[]>();
    for (const station of allStations ?? []) {
      const others = (station.metro_lines ?? []).filter(
        (item, index, all) =>
          item.line_code !== lineCode &&
          all.findIndex((other) => other.line_code === item.line_code) === index,
      );
      if (others.length > 0) map.set(station.station_code.trim().toUpperCase(), others);
    }
    return map;
  }, [allStations, lineCode]);

  if (isLoading) return <LoadingState message="Loading stations..." />;
  if (isError && !data) return <ErrorState message="Could not load stations" onRetry={refetch} />;

  const stations = data ?? [];
  const total = stations.length;
  const interchanges = stations.filter(
    (station) => station.interchange || othersByCode.has(station.station_code.trim().toUpperCase()),
  ).length;
  const title = line ? lineTitle(line) : lineName;
  const first = stations[0]?.station_name ?? line?.start_station;
  const last = stations[total - 1]?.station_name ?? line?.end_station;

  const header = (
    <View style={styles.header}>
      {isOfflineCopy ? <OfflineNote message="Saved station list for this line." /> : null}
      <View style={[styles.hero, { backgroundColor: fills.container }]}>
        <View style={styles.heroTop}>
          <LineGlyph
            color={lineColor}
            glyph={line ? lineGlyph(line) : lineName.replace(/^Line\s+/i, '').charAt(0)}
            size={56}
          />
          <View style={styles.heroText}>
            <Text
              variant="headlineSmall"
              style={[styles.heroTitle, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
            {first && last ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {terminalName(first)} to {terminalName(last)}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}>
            <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.onPrimaryContainer} />
            <Text
              variant="labelLarge"
              style={[emphasis.strong, { color: theme.colors.onPrimaryContainer }]}
            >
              {total} stations
            </Text>
          </View>
          {interchanges > 0 ? (
            <View style={[styles.chip, { backgroundColor: fills.containerHigh }]}>
              <Ionicons name="swap-horizontal" size={16} color={theme.colors.onSurface} />
              <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                {interchanges} {interchanges === 1 ? 'interchange' : 'interchanges'}
              </Text>
            </View>
          ) : null}
          {line ? (
            <View style={[styles.chip, styles.chipOutline, { borderColor: theme.colors.outlineVariant }]}>
              <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                {line.name}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      data={stations}
      keyExtractor={(item) => String(item.id)}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => (
        <StationRow
          station={item}
          lineColor={lineColor}
          others={othersByCode.get(item.station_code.trim().toUpperCase()) ?? []}
          isFirst={index === 0}
          isLast={index === total - 1}
          onPress={() =>
            navigation.navigate('StationDetail', {
              stationCode: item.station_code,
              stationName: lineStationName(item.station_name),
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  header: {
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.base,
  },
  hero: {
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.base,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  chipOutline: {
    borderWidth: 1,
  },
  rowShell: {
    paddingHorizontal: spacing.sm,
  },
  rowShellFirst: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.sm,
  },
  rowShellLast: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
  },
  rail: {
    width: RAIL_COLUMN,
    alignItems: 'center',
  },
  railLine: {
    position: 'absolute',
    width: RAIL_THICKNESS,
  },
  marker: {
    marginTop: ROW_PAD_TOP,
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 4,
  },
  markerInterchange: {
    borderWidth: 5,
  },
  stopDot: {
    marginTop: MARKER_CENTRE - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  body: {
    flex: 1,
    paddingTop: ROW_PAD_TOP - 1,
    paddingBottom: spacing.md,
    gap: 6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  chevron: {
    marginTop: ROW_PAD_TOP + 2,
  },
});
