import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStationDetailQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { Touchable } from '../components/Touchable';
import { SectionHeader } from '../components/SectionHeader';
import { Reveal } from '../components/Reveal';
import { StationLineChip, shortLineName } from '../components/StationLineChip';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import type { StationDetail } from '../types';
import { spacing, shape, radius, emphasis, tabular } from '../theme';
import { clockTime, stationName } from '../utils/format';

type Route = RouteProp<HomeStackParamList, 'StationDetail'>;
type Nav = NativeStackNavigationProp<HomeStackParamList, 'StationDetail'>;
type IconName = keyof typeof Ionicons.glyphMap;

/** The API returns these on DMRC stations but the shared type predates them. */
type StationWithHours = StationDetail & {
  opening_time?: string | null;
  closing_time?: string | null;
};

const OUTER = shape.xl;
const INNER = shape.sm;
/** Long lists (19 escalators at Rajiv Chowk) show this many until expanded. */
const PREVIEW = 4;

// ---------------------------------------------------------------------------
// Data helpers. Upstream fields are loosely typed, so each one is read
// defensively and anything unrecognised is dropped rather than shown raw.
// ---------------------------------------------------------------------------

function stationRefName(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'station_name' in value) {
    const name = (value as { station_name?: unknown }).station_name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

/** "NEW DELHI (Yellow & Airport Line)" to "New Delhi". The line is already on the card. */
function neighbourName(name: string): string {
  const bare = name.replace(/\s*\([^)]*line[^)]*\)\s*$/i, '').trim() || name;
  return stationName(bare.toUpperCase() === bare ? bare : bare.toUpperCase());
}

/** Upstream addresses carry stray spaces before commas: "Road , A Block". */
function tidy(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/\s+,/g, ',').replace(/,(?=\S)/g, ', ').replace(/\s{2,}/g, ' ').trim();
}

function stationRefCode(value: unknown): string | null {
  if (value && typeof value === 'object' && 'station_code' in value) {
    const code = (value as { station_code?: unknown }).station_code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

function liftStatus(status: unknown): { label: string; working: boolean } | null {
  if (status === null || status === undefined || status === '') return null;
  if (typeof status === 'boolean') return { label: status ? 'Working' : 'Not working', working: status };
  const label = String(status).trim();
  if (!label) return null;
  const working = ['working', 'operational', 'active', 'true', '1'].includes(label.toLowerCase());
  return { label: working ? 'Working' : label, working };
}

/** "towards_sector_51" to "to Sector 51". */
function directionLabel(key: string): string {
  const words = key.replace(/^towards_?/i, '').replace(/_/g, ' ').trim();
  return words ? `to ${words.replace(/\b[a-z]/g, (c) => c.toUpperCase())}` : '';
}

interface TrainTimes {
  firstLabel: string;
  first: string;
  firstNote: string;
  lastLabel: string;
  last: string;
  lastNote: string;
}

/**
 * Noida stations publish first and last trains per direction; take the
 * earliest first and the latest last. Delhi stations publish opening and
 * closing times instead, which are labelled as such.
 */
function trainTimes(station: StationWithHours): TrainTimes | null {
  const flt = station.first_last_train;
  if (flt && !Array.isArray(flt) && typeof flt === 'object') {
    let first: { time: string; dir: string } | null = null;
    let last: { time: string; dir: string } | null = null;
    for (const [dir, value] of Object.entries(flt)) {
      if (!value || typeof value !== 'object') continue;
      const f = clockTime(String((value as { first?: unknown }).first ?? ''));
      const l = clockTime(String((value as { last?: unknown }).last ?? ''));
      if (f && (!first || f < first.time)) first = { time: f, dir };
      if (l && (!last || l > last.time)) last = { time: l, dir };
    }
    if (first && last) {
      return {
        firstLabel: 'First train',
        first: first.time,
        firstNote: directionLabel(first.dir),
        lastLabel: 'Last train',
        last: last.time,
        lastNote: directionLabel(last.dir),
      };
    }
  }
  const open = clockTime(station.opening_time ?? null);
  const close = clockTime(station.closing_time ?? null);
  if (open && close) {
    return {
      firstLabel: 'Opens',
      first: open,
      firstNote: 'First train out',
      lastLabel: 'Closes',
      last: close,
      lastNote: 'Last train out',
    };
  }
  return null;
}

interface LineNeighbours {
  key: string;
  name: string;
  color: string;
  prev: { name: string; code: string | null } | null;
  next: { name: string; code: string | null } | null;
}

function neighbours(station: StationDetail): LineNeighbours[] {
  const out: LineNeighbours[] = [];
  for (const group of station.prev_next_stations ?? []) {
    for (const [lineKey, entries] of Object.entries(group)) {
      if (!Array.isArray(entries)) continue;
      entries.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') return;
        const e = entry as Record<string, unknown>;
        const prevName = stationRefName(e.prev_station);
        const nextName = stationRefName(e.next_station);
        if (!prevName && !nextName) return;
        out.push({
          key: `${lineKey}-${index}`,
          name: typeof e.line_color === 'string' ? e.line_color : lineKey,
          color:
            typeof e.primary_color_code === 'string'
              ? e.primary_color_code
              : station.metro_lines[0]?.primary_color_code ?? '#888888',
          prev: prevName ? { name: prevName, code: stationRefCode(e.prev_station) } : null,
          next: nextName ? { name: nextName, code: stationRefCode(e.next_station) } : null,
        });
      });
    }
  }
  return out;
}

interface FacilityGroup {
  kind: string;
  items: { name: string; where: string | null }[];
}

function facilityGroups(station: StationDetail): FacilityGroup[] {
  const groups: FacilityGroup[] = [];
  for (const raw of station.stations_facilities ?? []) {
    const kind = typeof raw.kind === 'string' ? raw.kind : null;
    const list = Array.isArray(raw.detail_list) ? raw.detail_list : [];
    if (!kind) continue;
    groups.push({
      kind,
      items: list
        .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object')
        .map((d) => ({
          name: typeof d.facility_name === 'string' ? d.facility_name : kind,
          where: typeof d.location_description === 'string' && d.location_description.trim()
            ? d.location_description.trim()
            : null,
        })),
    });
  }
  return groups;
}

interface Parking {
  title: string;
  where: string | null;
  capacity: string | null;
}

function parkings(station: StationDetail): Parking[] {
  return (station.parkings ?? []).map((p) => {
    const cars = Number(p.capacity_car) || 0;
    const bikes = Number(p.capacity_motorcycle) || 0;
    const cycles = Number(p.capacity_cycle) || 0;
    const bits = [
      cars ? `${cars.toLocaleString()} cars` : null,
      bikes ? `${bikes.toLocaleString()} two-wheelers` : null,
      cycles ? `${cycles.toLocaleString()} cycles` : null,
    ].filter(Boolean);
    return {
      title: typeof p.provider === 'string' ? p.provider : 'Parking',
      where: typeof p.location === 'string' ? p.location : null,
      capacity: bits.length ? bits.join(', ') : null,
    };
  });
}

interface Place {
  name: string;
  type: string;
  km: number | null;
  walk: number | null;
}

/** Nearby places arrive nested as category, then type, then a list. Flatten it. */
function nearbyPlaces(station: StationDetail): Place[] {
  const places: Place[] = [];
  const visit = (node: unknown, type: string) => {
    if (Array.isArray(node)) {
      node.forEach((child) => visit(child, type));
      return;
    }
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n.name === 'string') {
      places.push({
        name: n.name,
        type: typeof n.types_of_place === 'string' ? n.types_of_place : type,
        km: typeof n.distance_from_metro === 'number' ? n.distance_from_metro : null,
        walk: typeof n.estimated_walking_time_min === 'number' ? n.estimated_walking_time_min : null,
      });
      return;
    }
    for (const [key, value] of Object.entries(n)) {
      if (key === 'icon-class') continue;
      visit(value, key);
    }
  };
  visit(station.nearby_places ?? [], '');
  return places.sort((a, b) => (a.km ?? 99) - (b.km ?? 99));
}

function facilityIcon(kind: string): IconName {
  const k = kind.toLowerCase();
  if (k.includes('atm')) return 'card-outline';
  if (k.includes('toilet')) return 'male-female-outline';
  if (k.includes('water')) return 'water-outline';
  if (k.includes('medical') || k.includes('health')) return 'medkit-outline';
  if (k.includes('police')) return 'shield-outline';
  if (k.includes('food') || k.includes('restaurant')) return 'restaurant-outline';
  if (k.includes('token') || k.includes('vending') || k.includes('ticket')) return 'ticket-outline';
  if (k.includes('kiosk') || k.includes('shop')) return 'storefront-outline';
  return 'ellipse-outline';
}

function placeIcon(type: string): IconName {
  const t = type.toLowerCase();
  if (t.includes('hospital')) return 'medkit-outline';
  if (t.includes('police')) return 'shield-outline';
  if (t.includes('fire')) return 'flame-outline';
  if (t.includes('school') || t.includes('college') || t.includes('education')) return 'school-outline';
  if (t.includes('mall') || t.includes('market') || t.includes('shop')) return 'bag-outline';
  if (t.includes('bank')) return 'business-outline';
  if (t.includes('temple') || t.includes('religious') || t.includes('church') || t.includes('mosque')) {
    return 'flower-outline';
  }
  if (t.includes('hotel')) return 'bed-outline';
  if (t.includes('park')) return 'leaf-outline';
  return 'location-outline';
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function corners(first: boolean, last: boolean) {
  return {
    borderTopLeftRadius: first ? OUTER : INNER,
    borderTopRightRadius: first ? OUTER : INNER,
    borderBottomLeftRadius: last ? OUTER : INNER,
    borderBottomRightRadius: last ? OUTER : INNER,
  };
}

interface RowProps {
  icon: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Segmented list: separate tiles with 3pt gaps and only the outer corners of
 * the group fully rounded. Past `PREVIEW` rows the rest fold behind a
 * "Show all" tile.
 */
function Group({ rows, limit = PREVIEW }: { rows: RowProps[]; limit?: number }) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const [open, setOpen] = useState(false);
  const foldable = rows.length > limit + 1;
  const shown = foldable && !open ? rows.slice(0, limit) : rows;
  const total = shown.length + (foldable ? 1 : 0);

  return (
    <View style={styles.group}>
      {shown.map((row, index) => {
        const first = index === 0;
        const last = index === total - 1;
        const body = (
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: fills.containerHigh }]}>
              <Ionicons name={row.icon} size={18} color={row.iconColor ?? theme.colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                {row.title}
              </Text>
              {row.subtitle ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {row.subtitle}
                </Text>
              ) : null}
            </View>
            {row.trailing}
            {row.onPress ? (
              <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceVariant} />
            ) : null}
          </View>
        );
        const style = [corners(first, last), { backgroundColor: fills.containerLow }];
        return row.onPress ? (
          <Touchable
            key={`${row.title}-${index}`}
            radius={first || last ? OUTER : INNER}
            onPress={row.onPress}
            accessibilityLabel={row.accessibilityLabel ?? row.title}
            style={style}
          >
            {body}
          </Touchable>
        ) : (
          <View key={`${row.title}-${index}`} style={style}>
            {body}
          </View>
        );
      })}
      {foldable ? (
        <Touchable
          radius={OUTER}
          haptic="select"
          onPress={() => setOpen((v) => !v)}
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Show fewer' : `Show all ${rows.length}`}
          style={[corners(false, true), { backgroundColor: fills.containerLow }]}
        >
          <View style={styles.more}>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.primary} />
            <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.primary }]}>
              {open ? 'Show fewer' : `Show all ${rows.length}`}
            </Text>
          </View>
        </Touchable>
      ) : null}
    </View>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'good' | 'bad' | 'neutral';
}) {
  const theme = useTheme();
  const { semantic, fills } = useAppTheme();
  const bg =
    tone === 'good' ? semantic.successContainer : tone === 'bad' ? theme.colors.errorContainer : fills.containerHigh;
  const fg =
    tone === 'good'
      ? semantic.onSuccessContainer
      : tone === 'bad'
        ? theme.colors.onErrorContainer
        : theme.colors.onSurfaceVariant;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text variant="labelMedium" style={[emphasis.strong, { color: fg }]}>
        {label}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function StationDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { stationCode } = route.params;
  const theme = useTheme();
  const { fills } = useAppTheme();
  const { data, isLoading, isError, isOfflineCopy, refetch } = useStationDetailQuery(stationCode);
  const station = data as StationWithHours | undefined;

  // The station name leads the page in large type, so the app bar stays empty
  // instead of repeating it in capitals.
  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  const derived = useMemo(() => {
    if (!station) return null;
    const facilities = facilityGroups(station);
    const lifts = station.lifts.filter((l) => !/escalator/i.test(`${l.lift_type ?? ''} ${l.name ?? ''}`));
    const escalators = station.lifts.length - lifts.length;
    const facilityNames = station.station_facility.map((f) => f.name.toLowerCase());
    const stepFree =
      facilityNames.some((n) => n.includes('divyang') || n.includes('wheel')) ||
      station.gates.some((g) => g.divyang_friendly);
    const hasParking = station.parkings.length > 0 || facilityNames.some((n) => n.includes('parking'));
    const hasToilet = facilities.some((g) => /toilet/i.test(g.kind));

    const chips: { icon: IconName; label: string }[] = [];
    if (lifts.length) chips.push({ icon: 'swap-vertical', label: `${lifts.length} ${lifts.length === 1 ? 'lift' : 'lifts'}` });
    if (escalators) chips.push({ icon: 'trending-up', label: `${escalators} escalators` });
    if (station.gates.length) chips.push({ icon: 'enter-outline', label: `${station.gates.length} ${station.gates.length === 1 ? 'gate' : 'gates'}` });
    if (hasParking) chips.push({ icon: 'car-outline', label: 'Parking' });
    if (hasToilet) chips.push({ icon: 'male-female-outline', label: 'Toilets' });
    if (stepFree) chips.push({ icon: 'accessibility-outline', label: 'Step-free' });

    return {
      chips,
      times: trainTimes(station),
      neighbours: neighbours(station),
      facilities,
      parkings: parkings(station),
      places: nearbyPlaces(station),
    };
  }, [station]);

  if (isLoading) return <LoadingState message="Loading station details..." />;
  if (isError && !station) {
    return <ErrorState message="Could not load station details" onRetry={refetch} />;
  }
  if (!station || !derived) return <ErrorState message="Station not found" />;

  const name = stationName(station.station_name);
  const commercial =
    station.station_commercial_name && stationName(station.station_commercial_name) !== name
      ? stationName(station.station_commercial_name)
      : null;
  const isInterchange = Boolean(station.interchange) || station.metro_lines.length > 1;
  const hasCoords = station.latitude != null && station.longitude != null;
  const lineColor = station.metro_lines[0]?.primary_color_code ?? theme.colors.primary;

  const routeFromHere = () =>
    navigation
      .getParent<NavigationProp<RootTabParamList>>()
      ?.navigate('HomeTab', {
        screen: 'Home',
        params: { presetFrom: { code: station.station_code, name: station.station_name } },
      });

  const openMaps = () =>
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`,
    ).catch(() => undefined);

  const openStation = (code: string | null, stationTitle: string) => {
    if (!code) return;
    navigation.push('StationDetail', { stationCode: code, stationName: stationTitle });
  };

  const aboutRows: RowProps[] = [];
  if (station.station_type) {
    aboutRows.push({ icon: 'business-outline', title: station.station_type, subtitle: 'Station type' });
  }
  aboutRows.push({ icon: 'barcode-outline', title: station.station_code, subtitle: 'Station code' });
  if (station.mobile) {
    aboutRows.push({
      icon: 'call-outline',
      title: station.mobile,
      subtitle: 'Mobile',
      onPress: () => Linking.openURL(`tel:${station.mobile}`).catch(() => undefined),
      accessibilityLabel: `Call ${station.mobile}`,
    });
  }
  if (station.landline) {
    aboutRows.push({
      icon: 'call-outline',
      title: station.landline,
      subtitle: 'Landline',
      onPress: () => Linking.openURL(`tel:${station.landline}`).catch(() => undefined),
      accessibilityLabel: `Call ${station.landline}`,
    });
  }
  if (hasCoords) {
    aboutRows.push({
      icon: 'location-outline',
      title: `${station.latitude!.toFixed(5)}, ${station.longitude!.toFixed(5)}`,
      subtitle: 'Open in maps',
      onPress: openMaps,
      accessibilityLabel: 'Open this station in maps',
    });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {isOfflineCopy ? (
        <OfflineNote message="Saved station details. Gates and facilities may have changed." />
      ) : null}

      {/* Header card, the same layout as the station sheet on the map. */}
      <Reveal index={0} replayOnFocus={false}>
        <View style={[styles.header, { backgroundColor: fills.containerLow }]}>
          <View style={styles.headTop}>
            <View style={[styles.mark, { backgroundColor: theme.colors.primary }]}>
              <Ionicons
                name={isInterchange ? 'swap-horizontal' : 'train'}
                size={24}
                color={theme.colors.onPrimary}
              />
            </View>
            <View style={styles.headText}>
              <Text variant="labelMedium" style={[styles.overline, { color: theme.colors.primary }]}>
                {isInterchange ? 'Interchange' : 'Station'}
              </Text>
              <Text
                variant="headlineSmall"
                accessibilityRole="header"
                style={[styles.name, { color: theme.colors.onSurface }]}
              >
                {name}
              </Text>
              {commercial ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {commercial}
                </Text>
              ) : null}
              {station.metro_lines.length > 0 ? (
                <View style={styles.lineChips}>
                  {station.metro_lines.map((line) => (
                    <StationLineChip
                      key={line.id}
                      name={line.line_color || line.name}
                      color={line.primary_color_code}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={[styles.code, { backgroundColor: fills.containerHigh }]}>
              <Text variant="labelLarge" style={[emphasis.strong, tabular, { color: theme.colors.onSurface }]}>
                {station.station_code}
              </Text>
            </View>
          </View>

          {derived.times ? (
            <View style={styles.tiles}>
              {[
                { label: derived.times.firstLabel, value: derived.times.first, note: derived.times.firstNote },
                { label: derived.times.lastLabel, value: derived.times.last, note: derived.times.lastNote },
              ].map((tile) => (
                <View key={tile.label} style={[styles.tile, { backgroundColor: fills.containerHigh }]}>
                  <Text variant="labelSmall" style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {tile.label}
                  </Text>
                  <Text variant="headlineSmall" style={[emphasis.strong, tabular, { color: theme.colors.onSurface }]}>
                    {tile.value}
                  </Text>
                  {tile.note ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {tile.note}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {derived.chips.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              style={styles.chipsBleed}
            >
              {derived.chips.map((chip) => (
                <View key={chip.label} style={[styles.chip, { backgroundColor: fills.containerHigh }]}>
                  <Ionicons name={chip.icon} size={18} color={theme.colors.onSurface} />
                  <Text variant="labelLarge" style={[emphasis.medium, { color: theme.colors.onSurface }]}>
                    {chip.label}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.actions}>
            {hasCoords ? (
              <View style={styles.actionTonal}>
              <Touchable
                radius={radius.pill}
                onPress={openMaps}
                accessibilityLabel="Directions to this station"
                style={{ backgroundColor: theme.colors.secondaryContainer }}
              >
                <View style={styles.actionInner}>
                  <Ionicons name="navigate-outline" size={20} color={theme.colors.onSecondaryContainer} />
                  <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onSecondaryContainer }]}>
                    Directions
                  </Text>
                </View>
              </Touchable>
              </View>
            ) : null}
            <View style={styles.actionFilled}>
            <Touchable
              radius={radius.pill}
              haptic="press"
              onPress={routeFromHere}
              accessibilityLabel={`Plan a route from ${name}`}
              style={{ backgroundColor: theme.colors.primary }}
            >
              <View style={styles.actionInner}>
                <Ionicons name="git-branch-outline" size={20} color={theme.colors.onPrimary} />
                <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onPrimary }]}>
                  Route from here
                </Text>
              </View>
            </Touchable>
            </View>
          </View>
        </View>
      </Reveal>

      {derived.neighbours.length > 0 ? (
        <Section title="Next stops">
          <View style={styles.group}>
            {derived.neighbours.map((line, index) => (
              <View
                key={line.key}
                style={[
                  styles.lineCard,
                  corners(index === 0, index === derived.neighbours.length - 1),
                  { backgroundColor: fills.containerLow },
                ]}
              >
                <View style={styles.lineCardHead}>
                  <View style={[styles.lineBar, { backgroundColor: line.color }]} />
                  <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                    {shortLineName(line.name)} line
                  </Text>
                </View>
                <View style={styles.neighbourRow}>
                  {[
                    { stop: line.prev, icon: 'arrow-back' as IconName, align: 'left' as const },
                    { stop: line.next, icon: 'arrow-forward' as IconName, align: 'right' as const },
                  ].map(({ stop, icon, align }) =>
                    stop ? (
                      <View key={align} style={styles.neighbour}>
                      <Touchable
                        radius={shape.lg}
                        onPress={stop.code ? () => openStation(stop.code, stop.name) : undefined}
                        accessibilityLabel={`${align === 'left' ? 'Previous' : 'Next'} stop, ${neighbourName(stop.name)}`}
                        style={{ backgroundColor: fills.containerHigh }}
                      >
                        <View style={[styles.neighbourInner, align === 'right' && styles.neighbourRight]}>
                          {align === 'left' ? (
                            <Ionicons name={icon} size={16} color={theme.colors.onSurfaceVariant} />
                          ) : null}
                          <Text
                            variant="bodyMedium"
                            numberOfLines={2}
                            style={[
                              emphasis.medium,
                              styles.neighbourText,
                              align === 'right' && styles.textRight,
                              { color: theme.colors.onSurface },
                            ]}
                          >
                            {neighbourName(stop.name)}
                          </Text>
                          {align === 'right' ? (
                            <Ionicons name={icon} size={16} color={theme.colors.onSurfaceVariant} />
                          ) : null}
                        </View>
                      </Touchable>
                      </View>
                    ) : (
                      <View key={align} style={[styles.neighbour, styles.neighbourEnd, { borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          End of line
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {station.platforms.length > 0 ? (
        <Section title="Platforms">
          <Group
            rows={station.platforms.map((platform) => {
              const towards = [stationRefName(platform.train_towards), stationRefName(platform.train_towards_second)]
                .filter((n): n is string => Boolean(n))
                .map(neighbourName);
              const title = platform.platform_name.replace(/^Platform No\.\s*/i, 'Platform ');
              const subtitle = towards.length ? `Towards ${towards.join(' and ')}` : null;
              // Noida names its platforms by direction already, so the subtitle
              // would repeat the title.
              const repeats =
                subtitle !== null &&
                /^towards\b/i.test(title) &&
                subtitle.toLowerCase().endsWith(title.replace(/^towards\s*/i, '').toLowerCase());
              return {
                icon: 'train-outline',
                iconColor: lineColor,
                title,
                subtitle: repeats ? null : subtitle,
              };
            })}
          />
        </Section>
      ) : null}

      {station.gates.length > 0 ? (
        <Section title="Gates">
          <Group
            rows={station.gates.map((gate) => ({
              icon: 'enter-outline',
              title: gate.gate_name.replace(/^Gate No\.\s*/i, 'Gate '),
              subtitle: tidy(gate.location),
              trailing: gate.divyang_friendly ? <Pill label="Step-free" tone="good" /> : undefined,
            }))}
          />
        </Section>
      ) : null}

      {station.lifts.length > 0 ? (
        <Section title="Lifts and escalators">
          <Group
            rows={station.lifts.map((lift) => {
              const status = liftStatus(lift.status);
              const isEscalator = /escalator/i.test(`${lift.lift_type ?? ''} ${lift.name ?? ''}`);
              return {
                icon: isEscalator ? 'trending-up' : 'swap-vertical',
                title: lift.name || lift.lift_type || 'Lift',
                subtitle: tidy(lift.description_location),
                trailing: status ? <Pill label={status.label} tone={status.working ? 'good' : 'bad'} /> : undefined,
              };
            })}
          />
        </Section>
      ) : null}

      {station.station_facility.length > 0 || derived.facilities.length > 0 ? (
        <Section title="Facilities">
          {station.station_facility.length > 0 ? (
            <View style={styles.wrapChips}>
              {station.station_facility.map((f) => (
                <View key={f.name} style={[styles.chip, { backgroundColor: fills.containerHigh }]}>
                  <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                  <Text variant="labelLarge" style={[emphasis.medium, { color: theme.colors.onSurface }]}>
                    {f.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {derived.facilities.length > 0 ? (
            <Group
              limit={6}
              rows={derived.facilities.map((group) => ({
                icon: facilityIcon(group.kind),
                title: group.kind,
                subtitle:
                  group.items.length === 1
                    ? [group.items[0].name, group.items[0].where].filter(Boolean).join(', ')
                    : group.items.map((item) => (item.where ? `${item.name} (${item.where})` : item.name)).join('; '),
                trailing:
                  group.items.length > 1 ? <Pill label={String(group.items.length)} tone="neutral" /> : undefined,
              }))}
            />
          ) : null}
        </Section>
      ) : null}

      {derived.parkings.length > 0 ? (
        <Section title="Parking">
          <Group
            rows={derived.parkings.map((p) => ({
              icon: 'car-outline',
              title: p.title,
              subtitle: [tidy(p.where), p.capacity].filter(Boolean).join('. '),
            }))}
          />
        </Section>
      ) : null}

      {derived.places.length > 0 ? (
        <Section title="Nearby">
          <Group
            rows={derived.places.map((place) => ({
              icon: placeIcon(place.type),
              title: place.name,
              subtitle: [
                place.type,
                place.km != null ? `${place.km} km` : null,
                place.walk != null ? `${Math.round(place.walk)} min walk` : null,
              ]
                .filter(Boolean)
                .join(', '),
            }))}
          />
        </Section>
      ) : null}

      <Section title="About">
        {station.station_description ? (
          <View style={[styles.description, { backgroundColor: fills.containerLow }]}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {station.station_description}
            </Text>
          </View>
        ) : null}
        <Group rows={aboutRows} limit={8} />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    paddingTop: spacing.xs,
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  header: {
    borderRadius: OUTER,
    padding: spacing.base,
    gap: spacing.base,
  },
  headTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  overline: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  name: {
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  lineChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  code: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 10,
    borderRadius: 24,
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
    gap: 4,
  },
  tileLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipsBleed: {
    marginHorizontal: -spacing.base,
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
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionTonal: {
    flex: 1,
  },
  actionFilled: {
    flex: 1.4,
  },
  actionInner: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  section: {
    gap: spacing.xs,
  },
  group: {
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.base,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
  },
  pill: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  lineCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  lineBar: {
    width: 20,
    height: 8,
    borderRadius: 4,
  },
  neighbourRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  neighbour: {
    flex: 1,
    minWidth: 0,
  },
  neighbourInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  neighbourRight: {
    justifyContent: 'flex-end',
  },
  neighbourText: {
    flexShrink: 1,
  },
  textRight: {
    textAlign: 'right',
  },
  neighbourEnd: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: shape.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  description: {
    borderRadius: OUTER,
    padding: spacing.base,
    marginBottom: 3,
  },
});
