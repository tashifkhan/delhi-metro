import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFirstLastTrainQuery, useStationDetailQuery } from '../../hooks';
import { Touchable } from '../Touchable';
import { useAppTheme } from '../../theme/ThemeContext';
import { emphasis, onColor, radius, spacing, tabular } from '../../theme';
import { clockTime, stationName } from '../../utils/format';
import type { StationDetail } from '../../types';
import { LINE_BY_CODE, shortLineName, type MapStation } from './networkData';

interface Props {
  station: MapStation;
  onClose: () => void;
  onDetails: () => void;
  onRouteFromHere: () => void;
}

interface Tile {
  label: string;
  time: string | null;
  note: string | null;
}

/** The far end of the station's first line, so first/last times have a direction. */
function terminusFor(station: MapStation): { code: string; name: string } | null {
  const line = LINE_BY_CODE.get(station.lines[0]);
  if (!line || line.stations.length < 2) return null;
  const last = line.stations[line.stations.length - 1];
  const code = last === station.code ? line.stations[0] : last;
  return { code, name: code };
}

/** NMRC returns first and last trains per direction inside the station detail. */
function nmrcTimes(detail: StationDetail | undefined): Tile[] | null {
  const raw = detail?.first_last_train as Record<string, { first?: string; last?: string }> | null;
  if (!raw || Array.isArray(raw)) return null;
  const entry = Object.entries(raw).find(([, v]) => v && (v.first || v.last));
  if (!entry) return null;
  const [direction, times] = entry;
  const towards = direction.replace(/^towards_/, '').replace(/_/g, ' ');
  const note = `towards ${stationName(towards.toUpperCase()).replace(/^Sector/, 'Sector')}`;
  return [
    { label: 'First train', time: clockTime(times.first), note },
    { label: 'Last train', time: clockTime(times.last), note },
  ];
}

function facilityChips(detail: StationDetail | undefined): { icon: keyof typeof Ionicons.glyphMap; text: string }[] {
  if (!detail) return [];
  const chips: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
  const lifts = (detail.lifts ?? []).filter((l) => /lift/i.test(l.lift_type ?? ''));
  const escalators = (detail.lifts ?? []).filter((l) => /escalator/i.test(l.lift_type ?? ''));
  if (lifts.length) chips.push({ icon: 'swap-vertical', text: `${lifts.length} ${lifts.length === 1 ? 'lift' : 'lifts'}` });
  if (escalators.length) chips.push({ icon: 'trending-up', text: `${escalators.length} escalators` });
  if ((detail.gates ?? []).length) chips.push({ icon: 'enter-outline', text: `${detail.gates.length} gates` });
  if ((detail.parkings ?? []).length) chips.push({ icon: 'car-outline', text: 'Parking' });
  const names = (detail.station_facility ?? []).map((f) => f.name.toLowerCase());
  if (names.some((n) => n.includes('divyang'))) chips.push({ icon: 'accessibility-outline', text: 'Step-free' });
  if ((detail.platforms ?? []).length) {
    chips.push({ icon: 'subway-outline', text: `${detail.platforms.length} platforms` });
  }
  return chips;
}

/**
 * Bottom sheet for the station picked on the map: which lines stop here, the
 * first and last train, what the station has, and the two next steps.
 */
export function StationSheet({ station, onClose, onDetails, onRouteFromHere }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const isNmrc = station.lines.includes('AQUA');
  const { data: detail } = useStationDetailQuery(station.code);
  const terminus = isNmrc ? null : terminusFor(station);
  const { data: trains } = useFirstLastTrainQuery(
    terminus ? station.code : '',
    terminus?.code ?? '',
    'minimum-interchange',
  );

  const lines = station.lines
    .map((code) => LINE_BY_CODE.get(code))
    .filter((line, index, all): line is NonNullable<typeof line> =>
      Boolean(line) && all.findIndex((l) => l?.name === line?.name) === index,
    );

  const terminusName = terminus
    ? stationName(
        trains?.first_train?.first_train_route_detail.at(-1)?.end_station_name ??
          trains?.last_train?.last_train_route_detail.at(-1)?.end_station_name ??
          '',
      )
    : '';
  const tiles: Tile[] | null = isNmrc
    ? nmrcTimes(detail)
    : trains
      ? [
          {
            label: 'First train',
            time: clockTime(trains.first_train?.first_train_route_detail[0]?.start_time),
            note: terminusName ? `to ${terminusName}` : null,
          },
          {
            label: 'Last train',
            time: clockTime(trains.last_train?.last_train_route_detail[0]?.start_time),
            note: terminusName ? `to ${terminusName}` : null,
          },
        ]
      : null;
  const chips = facilityChips(detail);
  const name = stationName(station.name);

  return (
    <View style={[styles.sheet, { backgroundColor: fills.containerLow }]}>
      <View style={[styles.handle, { backgroundColor: theme.colors.onSurfaceVariant }]} />

      <View style={styles.head}>
        <View
          style={[
            styles.mark,
            { backgroundColor: station.interchange ? theme.colors.primary : lines[0]?.color ?? theme.colors.primary },
          ]}
        >
          <Ionicons
            name={station.interchange ? 'swap-horizontal' : 'train'}
            size={24}
            color={station.interchange ? theme.colors.onPrimary : onColor(lines[0]?.color ?? theme.colors.primary)}
          />
        </View>
        <View style={styles.headText}>
          <Text variant="labelMedium" style={[styles.overline, { color: theme.colors.primary }]}>
            {station.interchange ? 'Interchange' : 'Station'}
          </Text>
          <Text variant="headlineSmall" numberOfLines={2} style={[emphasis.strong, { color: theme.colors.onSurface }]}>
            {name}
          </Text>
          <View style={styles.badges}>
            {lines.map((line) => (
              <View key={line.code} style={[styles.badge, { backgroundColor: line.color }]}>
                <Text variant="labelMedium" style={[emphasis.strong, { color: onColor(line.color) }]}>
                  {shortLineName(line)}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Touchable
          radius={radius.pill}
          onPress={onClose}
          accessibilityLabel="Close station"
          style={{ backgroundColor: fills.containerHigh }}
        >
          <View style={styles.close}>
            <Ionicons name="close" size={22} color={theme.colors.onSurface} />
          </View>
        </Touchable>
      </View>

      {tiles ? (
        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <View key={tile.label} style={[styles.tile, { backgroundColor: fills.containerHighest }]}>
              <Text variant="labelSmall" style={[styles.overline, { color: theme.colors.onSurfaceVariant }]}>
                {tile.label}
              </Text>
              <Text variant="headlineSmall" style={[emphasis.strong, tabular, { color: theme.colors.onSurface }]}>
                {tile.time ?? '—'}
              </Text>
              {tile.note ? (
                <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                  {tile.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsBleed}
        >
          {chips.map((chip) => (
            <View key={chip.text} style={[styles.chip, { backgroundColor: fills.containerHighest }]}>
              <Ionicons name={chip.icon} size={18} color={theme.colors.onSurface} />
              <Text variant="labelLarge" style={[emphasis.medium, { color: theme.colors.onSurface }]}>
                {chip.text}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {station.approx ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          This station's position on the map is approximate.
        </Text>
      ) : null}

      <View style={styles.actions}>
        {/* Touchable wraps itself in a clipping view, so flex goes on a parent. */}
        <View style={styles.action}>
        <Touchable
          radius={radius.pill}
          onPress={onDetails}
          accessibilityLabel={`Details for ${name}`}
          style={{ backgroundColor: theme.colors.secondaryContainer }}
        >
          <View style={styles.actionInner}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.onSecondaryContainer} />
            <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onSecondaryContainer }]}>
              Details
            </Text>
          </View>
        </Touchable>
        </View>
        <View style={[styles.action, styles.actionWide]}>
        <Touchable
          radius={radius.pill}
          haptic="press"
          onPress={onRouteFromHere}
          accessibilityLabel={`Plan a route from ${name}`}
          style={{ backgroundColor: theme.colors.primary }}
        >
          <View style={styles.actionInner}>
            <Ionicons name="navigate-outline" size={20} color={theme.colors.onPrimary} />
            <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onPrimary }]}>
              Route from here
            </Text>
          </View>
        </Touchable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.base,
    paddingTop: 10,
    paddingBottom: spacing.lg,
    gap: spacing.base,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
    alignSelf: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  overline: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    justifyContent: 'center',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    gap: 2,
  },
  chipsBleed: {
    marginHorizontal: -spacing.base,
    flexGrow: 0,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  actionWide: {
    flex: 1.4,
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
  },
});
