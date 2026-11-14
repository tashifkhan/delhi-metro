import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import {
  usePopularRoutesQuery,
  useNotificationsQuery,
  useStationPicker,
  useMetroLinesQuery,
  useStationSearchQuery,
} from '../hooks';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { StationPicker } from '../components/StationPicker';
import { SectionHeader } from '../components/SectionHeader';
import { NotificationCard } from '../components/NotificationCard';
import { Touchable } from '../components/Touchable';
import { Reveal } from '../components/Reveal';
import { JourneyFields } from '../components/JourneyFields';
import { OfflineNote } from '../components/OfflineNote';
import { GetTheApp } from '../components/web/GetTheApp';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import { spacing, radius, shape, emphasis, overline, onColor } from '../theme';
import type { MetroLine } from '../types';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

const TIME_OPTIONS = [
  { label: 'Now', value: 0 },
  { label: '+15m', value: 15 },
  { label: '+30m', value: 30 },
  { label: '+1h', value: 60 },
] as const;

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function isNormal(status: string): boolean {
  return status.trim().toLowerCase() === 'normal service';
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { semantic, fills } = useAppTheme();
  const isDesktop = useIsDesktop();
  const fromPicker = useStationPicker();
  const toPicker = useStationPicker();
  const popularRoutes = usePopularRoutesQuery(5);
  const notifications = useNotificationsQuery();
  const linesQuery = useMetroLinesQuery();
  const savedAlerts = notifications.isOfflineCopy;
  const savedLines = linesQuery.isOfflineCopy;
  let savedNote = 'Line status is from your last visit.';
  if (savedAlerts && savedLines) {
    savedNote =
      'You are offline. Search and saved journeys still work. Alerts and line status are from your last visit.';
  } else if (savedAlerts) {
    savedNote = 'Alerts are from your last visit.';
  }
  const { data: allStations } = useStationSearchQuery('');
  const disruptedLines = (linesQuery.data ?? []).filter((l) => !isNormal(l.status));
  // Disrupted lines first, so a problem is visible without scrolling the strip.
  const lineStrip: MetroLine[] = useMemo(() => {
    const all = (linesQuery.data ?? []).filter((l) => l.show_in_frontend !== false);
    return [...all.filter((l) => !isNormal(l.status)), ...all.filter((l) => isNormal(l.status))];
  }, [linesQuery.data]);
  const [departureOffsetMinutes, setDepartureOffsetMinutes] = useState(0);

  const canSearch = Boolean(fromPicker.station && toPicker.station);

  // Popular routes are stored as bare codes; resolve them to names so the
  // list reads as places rather than as identifiers.
  const stationNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allStations ?? []) {
      map.set(s.station_code.trim().toUpperCase(), s.station_name);
    }
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

  const handleFindRoute = () => {
    if (!fromPicker.station || !toPicker.station) return;
    navigation.navigate('JourneyResults', {
      fromCode: fromPicker.station.code,
      toCode: toPicker.station.code,
      fromName: fromPicker.station.name,
      toName: toPicker.station.name,
      journeyTime: departureTime,
    });
  };

  const handleSwap = useCallback(() => {
    const temp = fromPicker.station;
    fromPicker.setStation(toPicker.station);
    toPicker.setStation(temp);
  }, [fromPicker, toPicker]);

  const handlePopularRoute = (fromCode: string, toCode: string) => {
    navigation.navigate('JourneyResults', {
      fromCode,
      toCode,
      fromName: nameForCode(fromCode),
      toName: nameForCode(toCode),
    });
  };

  const hasFrequent = (popularRoutes.data?.length ?? 0) > 0;
  const hasAlerts = (notifications.data?.length ?? 0) > 0;

  const goToAlerts = () => {
    navigation.getParent()?.navigate('AlertsTab' as never);
  };

  const renderFrequent = () => {
    if (!hasFrequent) return null;
    const routes = popularRoutes.data!;
    return (
      <Reveal index={3}>
        <View style={styles.section}>
          <SectionHeader title="Frequent" icon="repeat-outline" />
          {/* A segmented list: separate tiles with tight gaps, only the outer
              corners fully rounded, so the group reads as one block. */}
          <View style={styles.groupList}>
            {routes.map((route, index) => {
              const first = index === 0;
              const last = index === routes.length - 1;
              return (
                <Touchable
                  key={route.routeKey}
                  radius={shape.sm}
                  haptic="press"
                  onPress={() =>
                    handlePopularRoute(route.fromStationCode, route.toStationCode)
                  }
                  accessibilityLabel={`Plan ${nameForCode(route.fromStationCode)} to ${nameForCode(route.toStationCode)}`}
                  style={[
                    styles.groupTile,
                    { backgroundColor: fills.containerLow },
                    first && styles.groupTileFirst,
                    last && styles.groupTileLast,
                  ]}
                >
                  <View style={styles.routeRow}>
                    <View style={styles.miniRail}>
                      <View style={[styles.miniRing, { borderColor: theme.colors.primary }]} />
                      <View
                        style={[styles.miniLine, { backgroundColor: theme.colors.primary }]}
                      />
                      <View style={[styles.miniDot, { backgroundColor: theme.colors.primary }]} />
                    </View>
                    <View style={styles.routeNames}>
                      <Text
                        variant="bodyLarge"
                        numberOfLines={1}
                        style={[emphasis.strong, { color: theme.colors.onSurface }]}
                      >
                        {nameForCode(route.fromStationCode)}
                      </Text>
                      <Text
                        variant="bodyLarge"
                        numberOfLines={1}
                        style={[emphasis.strong, { color: theme.colors.onSurface }]}
                      >
                        {nameForCode(route.toStationCode)}
                      </Text>
                    </View>
                    <View style={[styles.countPill, { backgroundColor: fills.containerHigh }]}>
                      <Text
                        variant="labelMedium"
                        style={[emphasis.strong, { color: theme.colors.onSurfaceVariant }]}
                      >
                        {route.hitCount}×
                      </Text>
                    </View>
                  </View>
                </Touchable>
              );
            })}
          </View>
        </View>
      </Reveal>
    );
  };

  const renderAlerts = () => {
    if (!hasAlerts) return null;
    return (
      <Reveal index={4}>
        <View style={styles.section}>
          <SectionHeader
            title="Alerts"
            icon="megaphone-outline"
            action="All"
            onAction={goToAlerts}
          />
          <View style={styles.notifList}>
            {notifications.data!.slice(0, 3).map((notif) => (
              <NotificationCard key={notif.id} notification={notif} />
            ))}
          </View>
        </View>
      </Reveal>
    );
  };

  const renderLineStatus = () => {
    if (lineStrip.length === 0) return null;
    return (
      <Reveal index={2}>
        <View style={styles.section}>
          <SectionHeader
            title="Lines right now"
            icon="pulse-outline"
            action={disruptedLines.length > 0 ? 'Alerts' : undefined}
            onAction={disruptedLines.length > 0 ? goToAlerts : undefined}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lineStrip}
            // Bleed to the screen edge so the strip reads as scrollable.
            style={styles.lineStripBleed}
          >
            {lineStrip.map((line) => {
              const ok = isNormal(line.status);
              const badgeText = onColor(line.primary_color_code);
              return (
                <Touchable
                  key={`${line.network ?? 'dmrc'}-${line.id}`}
                  radius={shape.lg + 4}
                  onPress={() =>
                    navigation
                      .getParent<NavigationProp<RootTabParamList>>()
                      ?.navigate('LinesTab', {
                        screen: 'LineStations',
                        params: {
                          lineCode: line.line_code,
                          lineName: line.name,
                          lineColor: line.primary_color_code,
                        },
                      })
                  }
                  accessibilityLabel={`${line.name}, ${ok ? 'running normally' : line.status}`}
                  style={{ backgroundColor: ok ? fills.containerLow : semantic.warningContainer }}
                >
                  <View style={styles.lineCard}>
                    <View style={[styles.lineSquare, { backgroundColor: line.primary_color_code }]}>
                      <Text style={[styles.lineSquareText, { color: badgeText }]}>
                        {line.line_code.slice(0, 2)}
                      </Text>
                    </View>
                    <View style={styles.lineCardText}>
                      <Text
                        variant="labelLarge"
                        numberOfLines={1}
                        style={[
                          emphasis.strong,
                          { color: ok ? theme.colors.onSurface : semantic.onWarningContainer },
                        ]}
                      >
                        {line.line_color || line.name}
                      </Text>
                      <View style={styles.lineStatusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: ok ? semantic.success : semantic.warning },
                          ]}
                        />
                        <Text
                          variant="labelSmall"
                          numberOfLines={1}
                          style={[
                            styles.lineStatusText,
                            {
                              color: ok
                                ? theme.colors.onSurfaceVariant
                                : semantic.onWarningContainer,
                            },
                          ]}
                        >
                          {ok ? 'Running normally' : line.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Touchable>
              );
            })}
          </ScrollView>
        </View>
      </Reveal>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + (isDesktop ? spacing.xl : spacing.base) },
        // The desktop shell already centres a max-width column, so the screen
        // just fills it. On mobile the column is the full window.
        isDesktop && styles.contentDesktop,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Masthead */}
      <Reveal index={0}>
        <View style={styles.masthead}>
          <View style={styles.mastheadTop}>
            <Text
              variant="labelMedium"
              style={[overline, styles.mastheadDate, { color: theme.colors.onSurfaceVariant }]}
            >
              {todayLabel()}
            </Text>
            <Touchable
              radius={radius.pill}
              onPress={() => navigation.navigate('About')}
              accessibilityLabel="About this app"
              style={{ backgroundColor: fills.containerHigh }}
            >
              <View style={styles.heroAction}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </Touchable>
            <Touchable
              radius={radius.pill}
              onPress={() => navigation.navigate('Appearance')}
              accessibilityLabel="Appearance settings"
              style={{ backgroundColor: fills.containerHigh }}
            >
              <View style={styles.heroAction}>
                <Ionicons
                  name="color-palette-outline"
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            </Touchable>
          </View>
          <Text
            variant="displaySmall"
            accessibilityRole="header"
            style={[emphasis.medium, styles.heroTitle, { color: theme.colors.onSurface }]}
          >
            Where are you headed?
          </Text>
        </View>
      </Reveal>

      {savedAlerts || savedLines ? <OfflineNote message={savedNote} /> : null}

      {/* Journey planner */}
      <Reveal index={1}>
        <View style={[styles.planner, { backgroundColor: fills.container }]}>
          <JourneyFields
            from={{
              name: fromPicker.station?.name ?? null,
              placeholder: 'Choose departure',
              onPress: fromPicker.open,
              accessibilityLabel: `From: ${fromPicker.station?.name ?? 'Choose departure'}`,
              accessibilityHint: 'Opens the station picker',
            }}
            to={{
              name: toPicker.station?.name ?? null,
              placeholder: 'Choose destination',
              onPress: toPicker.open,
              accessibilityLabel: `To: ${toPicker.station?.name ?? 'Choose destination'}`,
              accessibilityHint: 'Opens the station picker',
            }}
            onSwap={handleSwap}
            swapDisabled={
              (!fromPicker.station && !toPicker.station) ||
              fromPicker.station?.code === toPicker.station?.code
            }
          />

          <View style={styles.departRow}>
            <Ionicons name="time-outline" size={16} color={theme.colors.onSurfaceVariant} />
            <View style={styles.timeChips}>
              {TIME_OPTIONS.map((option) => {
                const isActive = departureOffsetMinutes === option.value;
                return (
                  <Touchable
                    key={option.label}
                    radius={shape.sm}
                    haptic="select"
                    onPress={() => setDepartureOffsetMinutes(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Depart ${option.label}`}
                    style={{
                      backgroundColor: isActive ? theme.colors.secondaryContainer : 'transparent',
                      borderWidth: 1,
                      borderColor: isActive
                        ? theme.colors.secondaryContainer
                        : theme.colors.outlineVariant,
                    }}
                  >
                    <View style={styles.timeChip}>
                      {isActive ? (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={theme.colors.onSecondaryContainer}
                        />
                      ) : null}
                      <Text
                        variant="labelLarge"
                        style={[
                          emphasis.strong,
                          {
                            color: isActive
                              ? theme.colors.onSecondaryContainer
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                  </Touchable>
                );
              })}
            </View>
          </View>

          <Touchable
            radius={radius.pill}
            haptic="press"
            onPress={handleFindRoute}
            disabled={!canSearch}
            accessibilityLabel="Find route"
            accessibilityHint={
              canSearch ? undefined : 'Select a departure and destination station first'
            }
            style={{
              backgroundColor: canSearch ? theme.colors.primary : theme.colors.surfaceDisabled,
            }}
          >
            <View style={styles.findButton}>
              <Ionicons
                name="search"
                size={20}
                color={canSearch ? theme.colors.onPrimary : theme.colors.onSurfaceDisabled}
              />
              <Text
                variant="titleMedium"
                style={[
                  emphasis.strong,
                  { color: canSearch ? theme.colors.onPrimary : theme.colors.onSurfaceDisabled },
                ]}
              >
                Find route
              </Text>
            </View>
          </Touchable>
        </View>
      </Reveal>

      {renderLineStatus()}

      {/* Popular routes and recent alerts stack on mobile; on desktop they
          sit side by side so the wider column reads as two panels. */}
      {isDesktop ? (
        <View style={styles.desktopColumns}>
          <View style={styles.desktopColumn}>{renderFrequent()}</View>
          <View style={styles.desktopColumn}>{renderAlerts()}</View>
        </View>
      ) : (
        <>
          {renderFrequent()}
          {renderAlerts()}
        </>
      )}

      {/* Narrow web viewports get no sidebar, so the install and download
          links sit at the foot of the screen most visitors land on. Desktop
          has them in the rail already, and native is the app. */}
      {Platform.OS === 'web' && !isDesktop ? (
        <Reveal index={5}>
          <GetTheApp />
        </Reveal>
      ) : null}

      <StationPicker
        visible={fromPicker.visible}
        selectedCode={fromPicker.station?.code}
        onSelect={fromPicker.select as (s: { code: string; name: string }) => void}
        onClose={fromPicker.close}
        title="Departure Station"
      />
      <StationPicker
        visible={toPicker.visible}
        selectedCode={toPicker.station?.code}
        onSelect={toPicker.select as (s: { code: string; name: string }) => void}
        onClose={toPicker.close}
        title="Destination Station"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  contentDesktop: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  desktopColumns: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  desktopColumn: {
    flex: 1,
    minWidth: 0,
  },
  // Masthead
  masthead: {
    gap: spacing.md,
  },
  mastheadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mastheadDate: {
    flex: 1,
  },
  heroTitle: {
    letterSpacing: -0.6,
  },
  heroAction: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Planner
  planner: {
    borderRadius: shape.xl + 4,
    padding: spacing.sm,
    gap: spacing.md,
    marginHorizontal: -spacing.xs,
  },
  departRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  timeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 32,
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
  },
  // Sections
  section: {
    gap: spacing.sm,
  },
  // Line status strip
  lineStripBleed: {
    marginHorizontal: -spacing.base,
  },
  lineStrip: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.base,
    maxWidth: 240,
  },
  lineSquare: {
    width: 32,
    height: 32,
    borderRadius: shape.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineSquareText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  lineCardText: {
    flexShrink: 1,
    gap: 2,
  },
  lineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  lineStatusText: {
    flexShrink: 1,
  },
  // Frequent
  groupList: {
    gap: 3,
  },
  groupTile: {
    borderRadius: shape.sm,
  },
  groupTileFirst: {
    borderTopLeftRadius: shape.xl,
    borderTopRightRadius: shape.xl,
  },
  groupTileLast: {
    borderBottomLeftRadius: shape.xl,
    borderBottomRightRadius: shape.xl,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  miniRail: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 6,
  },
  miniRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
  },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  miniLine: {
    width: 2.5,
    flex: 1,
    minHeight: 12,
    opacity: 0.5,
  },
  routeNames: {
    flex: 1,
    gap: 6,
  },
  countPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: shape.sm,
  },
  notifList: {
    gap: spacing.sm,
  },
});
