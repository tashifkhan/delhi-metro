import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { useStationSearchQuery } from '../hooks';
import { useMapLayout } from '../hooks/useMapLayout';
import { useHaptics } from '../hooks/useHaptics';
import { Touchable } from '../components/Touchable';
import { NetworkSwitcher } from '../components/NetworkSwitcher';
import { NetworkMapCanvas, type NetworkMapHandle } from '../components/map/NetworkMapCanvas';
import { StationSheet } from '../components/map/StationSheet';
import { OfficialMapView } from '../components/map/OfficialMapView';
import { LINE_BY_CODE, project, type MapStation } from '../components/map/networkData';
import {
  BASE_GEOMETRY,
  LAYOUT_REGISTRY,
  applyLayouts,
  type NetworkGeometry,
} from '../components/map/geometry';
import { NetworkGeometryProvider } from '../components/map/NetworkGeometryContext';
import { useAppTheme } from '../theme/ThemeContext';
import { emphasis, onColor, radius, spacing } from '../theme';
import { stationName } from '../utils/format';
import type { MapStackParamList, RootTabParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MapStackParamList, 'MetroMap'>;

const SEARCH_HEIGHT = 56;
const FAB_SIZE = 56;
const MAX_RESULTS = 6;

/** Station codes differ between the search catalog and the map snapshot only in case and spacing. */
function mapStationFor(geo: NetworkGeometry, code: string, name: string): MapStation | null {
  const byCode = geo.stationByCode.get(code.trim().toUpperCase());
  if (byCode) return byCode;
  const wanted = name.trim().toLowerCase();
  return geo.stations.find((s) => s.name.trim().toLowerCase() === wanted) ?? null;
}

/** How long a "couldn't refresh" note stays up before it gets out of the way. */
const NOTE_MS = 4_000;

/**
 * The network map.
 *
 * Draws every line from station coordinates (see `components/map`), with a
 * floating search bar, a near-me button and a layers button that switches to
 * the operators' official published map. Tapping a station opens a sheet with
 * its lines, first and last train, facilities, and "Route from here".
 */
export function MetroMapScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { fills } = useAppTheme();
  const haptics = useHaptics();
  const mapRef = useRef<NetworkMapHandle>(null);

  const [mode, setMode] = useState<'schematic' | 'official'>('schematic');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [userPoint, setUserPoint] = useState<{ x: number; y: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);

  // Official-map layouts (see components/map/geometry). One hook per network,
  // gated by the registry, so Delhi makes no request while it is switched off.
  const nmrcLayout = useMapLayout('nmrc', LAYOUT_REGISTRY.nmrc.enabled);
  const dmrcLayout = useMapLayout('dmrc', LAYOUT_REGISTRY.dmrc.enabled);
  const geometry = useMemo(
    () => applyLayouts(BASE_GEOMETRY, { nmrc: nmrcLayout.layout, dmrc: dmrcLayout.layout }),
    [nmrcLayout.layout, dmrcLayout.layout],
  );
  const reading = [nmrcLayout, dmrcLayout].find(
    (state) => state.stage === 'extracting' || state.stage === 'progress',
  );
  const layoutError = nmrcLayout.error ?? dmrcLayout.error;
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (!layoutError) return;
    setShowError(true);
    const timer = setTimeout(() => setShowError(false), NOTE_MS);
    return () => clearTimeout(timer);
  }, [layoutError]);

  const { data: results } = useStationSearchQuery(query);
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const seen = new Set<string>();
    const out: { result: (typeof results)[number]; station: MapStation }[] = [];
    for (const result of results ?? []) {
      const station = mapStationFor(geometry, result.station_code, result.station_name);
      if (!station || seen.has(station.code)) continue;
      seen.add(station.code);
      out.push({ result, station });
      if (out.length >= MAX_RESULTS) break;
    }
    return out;
  }, [query, results, geometry]);

  const selected = selectedCode ? geometry.stationByCode.get(selectedCode) ?? null : null;

  const select = useCallback(
    (code: string | null) => {
      if (code) haptics.select();
      setSelectedCode(code);
    },
    [haptics],
  );

  const pickResult = (station: MapStation) => {
    Keyboard.dismiss();
    setSearching(false);
    setQuery('');
    select(station.code);
    mapRef.current?.focusStation(station.code);
  };

  const handleNearMe = () => {
    haptics.press();
    const geo = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    // Native builds don't ship a location module, so the button recentres the
    // map there instead of asking for a position it can't read.
    if (!geo) {
      mapRef.current?.reset();
      return;
    }
    setLocating(true);
    geo.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point = project(position.coords.latitude, position.coords.longitude);
        setUserPoint(point);
        let nearest: MapStation | null = null;
        let best = Infinity;
        for (const station of geometry.stations) {
          const d = Math.hypot(station.x - point.x, station.y - point.y);
          if (d < best) {
            best = d;
            nearest = station;
          }
        }
        // Within 5 km, open the nearest station; further out, just show where you are.
        if (nearest && best < 5_000) {
          setSelectedCode(nearest.code);
          mapRef.current?.focusStation(nearest.code);
        } else {
          mapRef.current?.focusPoint(point.x, point.y);
        }
      },
      () => {
        setLocating(false);
        haptics.warning();
        mapRef.current?.reset();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const routeFromHere = (station: MapStation) => {
    navigation.getParent<NavigationProp<RootTabParamList>>()?.navigate('HomeTab', {
      screen: 'Home',
      params: { presetFrom: { code: station.code, name: stationName(station.name) } },
    });
  };

  const top = insets.top + spacing.sm;
  const sheetOpen = mode === 'schematic' && selected !== null;

  if (mode === 'official') {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.officialBar, { paddingTop: top }]}>
          <Touchable
            radius={radius.pill}
            onPress={() => setMode('schematic')}
            accessibilityLabel="Back to the line map"
            style={{ backgroundColor: fills.containerHigh }}
          >
            <View style={styles.officialBack}>
              <Ionicons name="arrow-back" size={20} color={theme.colors.onSurface} />
              <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                Line map
              </Text>
            </View>
          </Touchable>
          <Text variant="titleMedium" style={[emphasis.strong, styles.officialTitle, { color: theme.colors.onSurface }]}>
            Official map
          </Text>
          <NetworkSwitcher compact />
        </View>
        <View style={styles.fill}>
          <OfficialMapView />
        </View>
      </View>
    );
  }

  const banner = reading
    ? {
        busy: true,
        text:
          reading.message ??
          'The official map changed. Reading it again, this takes about a minute.',
        count: reading.progress ? `${reading.progress.done} of ${reading.progress.total}` : null,
      }
    : showError
      ? { busy: false, text: "Couldn't check the official map. Showing the saved layout.", count: null }
      : null;
  // Sits above whatever occupies the bottom edge: the sheet, else the line key.
  const bannerBottom = sheetOpen ? sheetHeight + spacing.sm : spacing.base + 32 + spacing.sm;

  return (
    <NetworkGeometryProvider value={geometry}>
    <View style={[styles.fill, { backgroundColor: fills.containerLow }]}>
      <NetworkMapCanvas
        ref={mapRef}
        selectedCode={selectedCode}
        onSelect={(code) => {
          if (searching) {
            Keyboard.dismiss();
            setSearching(false);
          }
          select(code);
        }}
        userPoint={userPoint}
        insetTop={top + SEARCH_HEIGHT}
        insetBottom={sheetOpen ? sheetHeight : 0}
      />

      {/* Search */}
      <View style={[styles.searchWrap, { top }]} pointerEvents="box-none">
        <View style={[styles.search, { backgroundColor: fills.containerHigh }]}>
          <Ionicons name="search" size={22} color={theme.colors.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearching(true)}
            placeholder="Search stations"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            returnKeyType="search"
            onSubmitEditing={() => matches[0] && pickResult(matches[0].station)}
            style={[
              styles.searchInput,
              { color: theme.colors.onSurface, fontFamily: theme.fonts.bodyLarge.fontFamily },
            ]}
            accessibilityLabel="Search stations on the map"
          />
          {query ? (
            <Touchable
              radius={radius.pill}
              onPress={() => setQuery('')}
              accessibilityLabel="Clear search"
            >
              <View style={styles.searchAction}>
                <Ionicons name="close" size={20} color={theme.colors.onSurfaceVariant} />
              </View>
            </Touchable>
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.colors.tertiaryContainer }]}>
              <Ionicons name="train" size={18} color={theme.colors.onTertiaryContainer} />
            </View>
          )}
        </View>

        {searching && matches.length > 0 ? (
          <View style={[styles.results, { backgroundColor: fills.containerHigh }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {matches.map(({ station }) => (
                <Touchable
                  key={station.code}
                  radius={0}
                  onPress={() => pickResult(station)}
                  accessibilityLabel={`Show ${stationName(station.name)} on the map`}
                >
                  <View style={styles.resultRow}>
                    <View style={styles.resultDots}>
                      {station.lines.slice(0, 3).map((code) => (
                        <View
                          key={code}
                          style={[styles.resultDot, { backgroundColor: LINE_BY_CODE.get(code)?.color ?? theme.colors.primary }]}
                        />
                      ))}
                    </View>
                    <Text variant="bodyLarge" numberOfLines={1} style={[styles.resultName, { color: theme.colors.onSurface }]}>
                      {stationName(station.name)}
                    </Text>
                    {station.interchange ? (
                      <Ionicons name="swap-horizontal" size={16} color={theme.colors.onSurfaceVariant} />
                    ) : null}
                  </View>
                </Touchable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Floating actions */}
      {!(searching && matches.length > 0) ? (
        <View style={[styles.fabs, { top: top + SEARCH_HEIGHT + spacing.xl }]} pointerEvents="box-none">
          <Touchable
            radius={18}
            onPress={handleNearMe}
            accessibilityLabel={Platform.OS === 'web' ? 'Show stations near me' : 'Recentre the map'}
            style={[styles.fab, { backgroundColor: theme.colors.primaryContainer }]}
          >
            <View style={styles.fabInner}>
              <Ionicons
                name={locating ? 'locate' : 'navigate'}
                size={24}
                color={theme.colors.onPrimaryContainer}
              />
            </View>
          </Touchable>
          <Touchable
            radius={18}
            onPress={() => {
              setSelectedCode(null);
              setMode('official');
            }}
            accessibilityLabel="Show the official network map"
            style={[styles.fab, { backgroundColor: fills.containerHigh }]}
          >
            <View style={styles.fabInner}>
              <Ionicons name="layers-outline" size={24} color={theme.colors.onSurface} />
            </View>
          </Touchable>
        </View>
      ) : null}

      {/* Line key when nothing is selected, so colours read without a legend hunt. */}
      {!selected ? (
        <View style={styles.legendWrap} pointerEvents="box-none">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legend}>
            {Array.from(new Map([...LINE_BY_CODE.values()].map((l) => [l.color + l.name.replace(/\s*\(Ext\.\)$/i, ''), l])).values()).map(
              (line) => (
                <View key={line.code} style={[styles.legendChip, { backgroundColor: fills.containerHigh }]}>
                  <View style={[styles.legendSwatch, { backgroundColor: line.color }]} />
                  <Text variant="labelMedium" style={[emphasis.medium, { color: theme.colors.onSurface }]}>
                    {line.name.replace(/\s*\(Ext\.\)$/i, '').replace(/\s+Line$/i, '').replace('RMGL', 'Rapid')}
                  </Text>
                </View>
              ),
            )}
          </ScrollView>
        </View>
      ) : null}

      {selected ? (
        <View
          style={styles.sheetWrap}
          onLayout={(e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height)}
        >
          <StationSheet
            key={selected.code}
            station={selected}
            onClose={() => setSelectedCode(null)}
            onDetails={() =>
              navigation.navigate('StationDetail', {
                stationCode: selected.code,
                stationName: stationName(selected.name),
              })
            }
            onRouteFromHere={() => routeFromHere(selected)}
          />
        </View>
      ) : null}

      {banner ? (
        <View
          style={[styles.bannerWrap, { bottom: bannerBottom }]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.banner, { backgroundColor: theme.colors.inverseSurface }]}>
            {banner.busy ? (
              <ActivityIndicator size="small" color={theme.colors.inversePrimary} />
            ) : (
              <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.inverseOnSurface} />
            )}
            <Text
              variant="bodyMedium"
              style={[styles.bannerText, { color: theme.colors.inverseOnSurface }]}
            >
              {banner.text}
            </Text>
            {banner.count ? (
              <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.inversePrimary }]}>
                {banner.count}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
    </NetworkGeometryProvider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  searchWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  search: {
    height: SEARCH_HEIGHT,
    borderRadius: SEARCH_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: SEARCH_HEIGHT,
    // The pill is the focus affordance; the browser's own ring doubled it.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null),
  },
  searchAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: {
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: 340,
    paddingVertical: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  resultDots: {
    flexDirection: 'row',
    gap: 3,
    width: 36,
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  resultName: {
    flex: 1,
  },
  fabs: {
    position: 'absolute',
    right: spacing.md,
    gap: spacing.md,
  },
  fab: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.base,
  },
  legend: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 10,
    paddingRight: spacing.md,
    borderRadius: 16,
  },
  legendSwatch: {
    width: 14,
    height: 6,
    borderRadius: 3,
  },
  bannerWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bannerText: {
    flex: 1,
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  officialBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  officialBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingLeft: spacing.md,
    paddingRight: spacing.base,
  },
  officialTitle: {
    flex: 1,
  },
});
