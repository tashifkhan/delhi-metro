import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import {
  usePopularRoutesQuery,
  useStationPicker,
  useMetroLinesQuery,
  useStationSearchQuery,
} from '../hooks';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { StationPicker } from '../components/StationPicker';
import { SectionHeader } from '../components/SectionHeader';
import { Touchable } from '../components/Touchable';
import { Card } from '../components/Card';
import { JourneyFields } from '../components/JourneyFields';
import { GetTheApp } from '../components/web/GetTheApp';
import { useSaved } from '../saved/SavedContext';
import { PlaceIcon } from '../saved/PlaceIcon';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import { spacing, radius, emphasis } from '../theme';
import { stationName } from '../utils/format';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

const TIME_OPTIONS = [
  { label: 'Leave now', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 h', value: 60 },
] as const;

/** Trips shown on Plan before "All saved" takes over. */
const SAVED_TRIPS_ON_HOME = 3;

function isNormal(status: string): boolean {
  return status.trim().toLowerCase() === 'normal service';
}

/**
 * Plan: pick two stations and go.
 *
 * Kept deliberately short. Under the planner sit only things that start a
 * trip in one tap: saved places, saved trips and the trips planned most. Line
 * status and alerts live in their own tabs; the only thing that comes back here
 * is a one-line banner when a line is disrupted.
 */
export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { semantic, fills, look } = useAppTheme();
  const isDesktop = useIsDesktop();
  const fromPicker = useStationPicker();
  const toPicker = useStationPicker();
  const popularRoutes = usePopularRoutesQuery(5);
  const linesQuery = useMetroLinesQuery();
  const saved = useSaved();
  const { data: allStations } = useStationSearchQuery('');
  const [departureOffsetMinutes, setDepartureOffsetMinutes] = useState(0);
  const tabs = navigation.getParent<NavigationProp<RootTabParamList>>();

  const disrupted = useMemo(
    () =>
      (linesQuery.data ?? []).filter((l) => l.show_in_frontend !== false && !isNormal(l.status)),
    [linesQuery.data],
  );

  // "Route from here" on a station, or a saved place, lands here with From
  // filled. A place also opens the To picker, since To is the only thing left.
  // Clear the params so a later visit doesn't refill them.
  const route = useRoute<RouteProp<HomeStackParamList, 'Home'>>();
  const presetFrom = route.params?.presetFrom;
  const openTo = route.params?.openTo;
  const setFrom = fromPicker.setStation;
  const openToPicker = toPicker.open;
  useEffect(() => {
    if (!presetFrom) return;
    setFrom(presetFrom);
    if (openTo) openToPicker();
    navigation.setParams({ presetFrom: undefined, openTo: undefined });
  }, [presetFrom, openTo, setFrom, openToPicker, navigation]);

  const canSearch = Boolean(fromPicker.station && toPicker.station);

  // Frequent trips are stored as bare codes; resolve them to names.
  const stationNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allStations ?? []) map.set(s.station_code.trim().toUpperCase(), s.station_name);
    return map;
  }, [allStations]);
  const nameForCode = useCallback(
    (code: string) => stationNameMap.get(code.trim().toUpperCase()) ?? code,
    [stationNameMap],
  );

  const departureTime = useMemo(() => {
    if (departureOffsetMinutes === 0) return undefined;
    const future = new Date(Date.now() + departureOffsetMinutes * 60_000);
    const pad = (value: number) => String(value).padStart(2, '0');
    const ms = String(future.getMilliseconds()).padStart(3, '0');
    return `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}:${pad(future.getSeconds())}.${ms}`;
  }, [departureOffsetMinutes]);

  const openJourney = (fromCode: string, toCode: string, fromName: string, toName: string, journeyTime?: string) =>
    navigation.navigate('JourneyResults', { fromCode, toCode, fromName, toName, journeyTime });

  const handleFindRoute = () => {
    if (!fromPicker.station || !toPicker.station) return;
    openJourney(
      fromPicker.station.code,
      toPicker.station.code,
      fromPicker.station.name,
      toPicker.station.name,
      departureTime,
    );
  };

  const handleSwap = useCallback(() => {
    const temp = fromPicker.station;
    fromPicker.setStation(toPicker.station);
    toPicker.setStation(temp);
  }, [fromPicker, toPicker]);

  const savedTripKeys = new Set(saved.trips.map((t) => `${t.from.code}>${t.to.code}`));
  // Frequent trips that are already saved would show twice.
  const frequent = (popularRoutes.data ?? []).filter(
    (r) => !savedTripKeys.has(`${r.fromStationCode}>${r.toStationCode}`),
  );

  const planner = (
    <View
      style={[
        styles.planner,
        {
          backgroundColor: fills.container,
          borderRadius: look.style === 'material' ? 32 : look.radius.hero,
          borderColor: fills.hairline,
          borderWidth: look.edge === 'hairline' ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      <JourneyFields
        from={{
          name: fromPicker.station ? stationName(fromPicker.station.name) : null,
          placeholder: 'Choose a station',
          onPress: fromPicker.open,
          accessibilityLabel: `From: ${fromPicker.station?.name ?? 'choose a station'}`,
          accessibilityHint: 'Opens the station picker',
        }}
        to={{
          name: toPicker.station ? stationName(toPicker.station.name) : null,
          placeholder: 'Choose a station',
          onPress: toPicker.open,
          accessibilityLabel: `To: ${toPicker.station?.name ?? 'choose a station'}`,
          accessibilityHint: 'Opens the station picker',
        }}
        onSwap={handleSwap}
        swapDisabled={
          (!fromPicker.station && !toPicker.station) ||
          fromPicker.station?.code === toPicker.station?.code
        }
      />

      <View style={styles.plannerControls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChips}>
          {TIME_OPTIONS.map((option) => {
            const isActive = departureOffsetMinutes === option.value;
            const fg = isActive ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant;
            return (
              <Touchable
                key={option.label}
                radius={radius.badge}
                haptic="select"
                onPress={() => setDepartureOffsetMinutes(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={option.value === 0 ? 'Leave now' : `Leave in ${option.label}`}
                style={[
                  styles.timeChip,
                  isActive
                    ? { backgroundColor: theme.colors.secondaryContainer, borderColor: theme.colors.secondaryContainer }
                    : { borderColor: theme.colors.outlineVariant },
                ]}
              >
                <View style={styles.timeChipInner}>
                  <Ionicons
                    name={isActive ? 'checkmark' : option.value === 0 ? 'time-outline' : 'add'}
                    size={15}
                    color={fg}
                  />
                  <Text variant="labelLarge" style={[emphasis.medium, { color: fg }]}>
                    {option.label}
                  </Text>
                </View>
              </Touchable>
            );
          })}
        </ScrollView>

        <Touchable
          radius={radius.pill}
          haptic="press"
          onPress={handleFindRoute}
          disabled={!canSearch}
          accessibilityLabel="Show route"
          accessibilityHint={canSearch ? undefined : 'Pick both stations first'}
          style={{ backgroundColor: theme.colors.primary, opacity: canSearch ? 1 : 0.45 }}
        >
          <View style={styles.findButton}>
            <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onPrimary }]}>
              Show route
            </Text>
          </View>
        </Touchable>
      </View>
    </View>
  );

  const disruptionBanner =
    disrupted.length === 0 ? null : (
      <Touchable
        radius={radius.card}
        onPress={() => tabs?.navigate('NetworkTab', { screen: 'Network' })}
        accessibilityLabel={`${disrupted.length === 1 ? disrupted[0].name : `${disrupted.length} lines`} disrupted. Open the network`}
        style={{ backgroundColor: semantic.warningContainer }}
      >
        <View style={styles.banner}>
          <Ionicons name="warning-outline" size={18} color={semantic.onWarningContainer} />
          <Text variant="bodyMedium" numberOfLines={2} style={[styles.bannerText, { color: semantic.onWarningContainer }]}>
            {disrupted.length === 1
              ? `${disrupted[0].name}: ${disrupted[0].status}`
              : `${disrupted.length} lines have disruptions`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={semantic.onWarningContainer} />
        </View>
      </Touchable>
    );

  const places = (
    <View style={styles.section}>
      <SectionHeader
        title="Places"
        action={saved.places.length ? 'Edit' : undefined}
        onAction={() => tabs?.navigate('SavedTab', { screen: 'Saved' })}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeRow} style={styles.bleed}>
        {saved.places.map((place) => (
          <Touchable
            key={place.label}
            radius={radius.pill}
            haptic="press"
            onPress={() => {
              fromPicker.setStation({ code: place.station.code, name: place.station.name });
              toPicker.open();
            }}
            accessibilityLabel={`From ${place.label}, ${place.station.name}`}
            style={[styles.placeChip, { borderColor: theme.colors.outlineVariant }]}
          >
            <View style={styles.placeChipInner}>
              <PlaceIcon label={place.label} size={28} />
              <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                {place.label}
              </Text>
            </View>
          </Touchable>
        ))}
        <Touchable
          radius={radius.pill}
          onPress={() => tabs?.navigate('SavedTab', { screen: 'Saved' })}
          accessibilityLabel="Add a place"
          style={[styles.placeChip, { borderColor: theme.colors.outlineVariant, borderStyle: 'dashed' }]}
        >
          <View style={[styles.placeChipInner, styles.addChip]}>
            <Ionicons name="add" size={18} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {saved.places.length ? 'Add' : 'Add Home, Work…'}
            </Text>
          </View>
        </Touchable>
      </ScrollView>
    </View>
  );

  const tripRow = (
    key: string,
    fromName: string,
    toName: string,
    onPress: () => void,
    trailing: ReactNode,
    index: number,
  ) => (
    <View key={key}>
      {index > 0 ? <View style={[styles.divider, { backgroundColor: fills.hairline }]} /> : null}
      <Touchable radius={0} haptic="press" onPress={onPress} accessibilityLabel={`Plan ${fromName} to ${toName}`}>
        <View style={styles.routeRow}>
          <View style={styles.miniRail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.miniRing, { borderColor: theme.colors.primary }]} />
            <View style={[styles.miniLine, { backgroundColor: theme.colors.primary }]} />
            <View style={[styles.miniDot, { backgroundColor: theme.colors.primary }]} />
          </View>
          <View style={styles.routeNames}>
            <Text variant="bodyLarge" numberOfLines={1} style={[emphasis.strong, { color: theme.colors.onSurface }]}>
              {stationName(fromName)}
            </Text>
            <Text variant="bodyLarge" numberOfLines={1} style={[emphasis.strong, { color: theme.colors.onSurface }]}>
              {stationName(toName)}
            </Text>
          </View>
          {trailing}
        </View>
      </Touchable>
    </View>
  );

  const savedTrips =
    saved.trips.length === 0 ? null : (
      <View style={styles.section}>
        <SectionHeader
          title="Saved trips"
          action={saved.trips.length > SAVED_TRIPS_ON_HOME ? 'All saved' : undefined}
          onAction={() => tabs?.navigate('SavedTab', { screen: 'Saved' })}
        />
        <Card>
          {saved.trips.slice(0, SAVED_TRIPS_ON_HOME).map((trip, index) =>
            tripRow(
              `${trip.from.code}>${trip.to.code}`,
              trip.from.name,
              trip.to.name,
              () => openJourney(trip.from.code, trip.to.code, trip.from.name, trip.to.name),
              <Ionicons name="bookmark" size={18} color={theme.colors.primary} />,
              index,
            ),
          )}
        </Card>
      </View>
    );

  const frequentTrips =
    frequent.length === 0 ? null : (
      <View style={styles.section}>
        <SectionHeader title="Frequent" />
        <Card>
          {frequent.map((r, index) =>
            tripRow(
              r.routeKey,
              nameForCode(r.fromStationCode),
              nameForCode(r.toStationCode),
              () =>
                openJourney(
                  r.fromStationCode,
                  r.toStationCode,
                  nameForCode(r.fromStationCode),
                  nameForCode(r.toStationCode),
                ),
              <Text variant="labelLarge" style={[look.figures, { color: theme.colors.onSurfaceVariant }]}>
                {r.hitCount}×
              </Text>,
              index,
            ),
          )}
        </Card>
      </View>
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + (isDesktop ? spacing.xl : spacing.md) },
        isDesktop && styles.contentDesktop,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.masthead}>
        <Text
          variant="headlineLarge"
          accessibilityRole="header"
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          Plan
        </Text>
        <Touchable
          radius={radius.pill}
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Settings"
        >
          <View style={styles.iconButton}>
            <Ionicons name="settings-outline" size={22} color={theme.colors.onSurfaceVariant} />
          </View>
        </Touchable>
      </View>

      {disruptionBanner}
      {planner}
      {places}
      {savedTrips}
      {frequentTrips}

      {/* Narrow web viewports get no sidebar, so the install and download
          links sit at the foot of the screen most visitors land on. */}
      {Platform.OS === 'web' && !isDesktop ? <GetTheApp /> : null}

      <StationPicker
        visible={fromPicker.visible}
        selectedCode={fromPicker.station?.code}
        onSelect={fromPicker.select as (s: { code: string; name: string }) => void}
        onClose={fromPicker.close}
        title="From"
      />
      <StationPicker
        visible={toPicker.visible}
        selectedCode={toPicker.station?.code}
        onSelect={toPicker.select as (s: { code: string; name: string }) => void}
        onClose={toPicker.close}
        title="To"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.base,
    gap: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  contentDesktop: {
    padding: spacing.xl,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bannerText: {
    flex: 1,
  },
  planner: {
    padding: spacing.sm,
  },
  plannerControls: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  timeChips: {
    gap: spacing.sm,
  },
  timeChip: {
    borderWidth: 1,
  },
  timeChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
  },
  findButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  section: {
    gap: spacing.xs,
  },
  bleed: {
    marginHorizontal: -spacing.base,
  },
  placeRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  placeChip: {
    borderWidth: 1,
  },
  placeChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: spacing.md,
  },
  addChip: {
    paddingLeft: spacing.sm,
    minHeight: 38,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.base,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
  },
  miniRail: {
    alignItems: 'center',
    width: 10,
  },
  miniRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
  },
  miniLine: {
    width: 3,
    height: 14,
    opacity: 0.6,
  },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeNames: {
    flex: 1,
    gap: 4,
  },
});
