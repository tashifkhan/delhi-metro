import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import {
  usePopularRoutesQuery,
  useNotificationsQuery,
  useStationPicker,
  useMetroLinesQuery,
  useStationSearchQuery,
} from '../hooks';
import { StationPicker } from '../components/StationPicker';
import { SectionHeader } from '../components/SectionHeader';
import { NotificationCard } from '../components/NotificationCard';
import { Touchable } from '../components/Touchable';
import { Reveal } from '../components/Reveal';
import { Card } from '../components/Card';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/types';
import { spacing, radius, shape, emphasis, overline, onColor } from '../theme';
import { spring } from '../theme/motion';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

const TIME_OPTIONS = [
  { label: 'Now', value: 0 },
  { label: '+15m', value: 15 },
  { label: '+30m', value: 30 },
  { label: '+1h', value: 60 },
] as const;

const RAIL_WIDTH = 28;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { semantic, fills } = useAppTheme();
  const fromPicker = useStationPicker();
  const toPicker = useStationPicker();
  const popularRoutes = usePopularRoutesQuery(5);
  const notifications = useNotificationsQuery();
  const linesQuery = useMetroLinesQuery();
  const { data: allStations } = useStationSearchQuery('');
  const disruptedLines = (linesQuery.data ?? []).filter(
    (l) => l.status.trim().toLowerCase() !== 'normal service',
  );
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

  // Half a turn per tap, accumulating, so the icon keeps rotating the same
  // way instead of snapping back — the motion mirrors what the action does.
  const swapSpin = useRef(new Animated.Value(0)).current;
  const swapTurns = useRef(0);

  const handleSwap = useCallback(() => {
    const temp = fromPicker.station;
    fromPicker.setStation(toPicker.station);
    toPicker.setStation(temp);

    swapTurns.current += 1;
    Animated.spring(swapSpin, {
      toValue: swapTurns.current,
      useNativeDriver: true,
      ...spring.spatial,
    }).start();
  }, [fromPicker, toPicker, swapSpin]);

  const handlePopularRoute = (fromCode: string, toCode: string) => {
    navigation.navigate('JourneyResults', {
      fromCode,
      toCode,
      fromName: nameForCode(fromCode),
      toName: nameForCode(toCode),
    });
  };

  const renderEndpoint = (
    kind: 'from' | 'to',
    picker: ReturnType<typeof useStationPicker>,
  ) => {
    const isFrom = kind === 'from';
    const label = isFrom ? 'From' : 'To';
    const placeholder = isFrom ? 'Choose departure' : 'Choose destination';

    return (
      <Touchable
        radius={shape.md}
        onPress={picker.open}
        accessibilityLabel={`${label}: ${picker.station?.name ?? placeholder}`}
        accessibilityHint="Opens the station picker"
      >
        <View style={styles.endpointRow}>
          <View style={styles.rail}>
            <View
              style={[
                styles.railLine,
                { backgroundColor: theme.colors.outlineVariant },
                isFrom ? styles.railFromCenter : styles.railToCenter,
              ]}
            />
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: isFrom ? semantic.success : theme.colors.error,
                  borderColor: theme.colors.background,
                },
              ]}
            />
          </View>
          <View style={styles.endpointText}>
            <Text
              variant="labelSmall"
              style={[overline, { color: theme.colors.onSurfaceVariant }]}
            >
              {label}
            </Text>
            <Text
              variant="titleLarge"
              numberOfLines={1}
              style={[
                emphasis.strong,
                { color: picker.station ? theme.colors.onSurface : theme.colors.outline },
              ]}
            >
              {picker.station?.name ?? placeholder}
            </Text>
          </View>
        </View>
      </Touchable>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Masthead */}
      <Reveal index={0}>
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text
              variant="labelSmall"
              style={[overline, { color: theme.colors.primary }]}
            >
              {greeting()}
            </Text>
            <Text
              variant="displaySmall"
              style={[emphasis.heavy, styles.heroTitle, { color: theme.colors.onSurface }]}
            >
              NCR Metro
            </Text>
          </View>
          <Touchable
            radius={radius.pill}
            onPress={() => navigation.navigate('Appearance')}
            accessibilityLabel="Appearance settings"
            style={{ backgroundColor: fills.subtle }}
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
      </Reveal>

      {/* Journey planner */}
      <Reveal index={1}>
        <Card radius={radius.hero} elevated style={styles.plannerCard}>
          {renderEndpoint('from', fromPicker)}

          {/* The divider and the swap control share a row, so the rail visibly
              runs between the two endpoints it reverses. */}
          <View style={styles.swapRow}>
            <View style={styles.rail}>
              <View
                style={[styles.railLine, { backgroundColor: theme.colors.outlineVariant }]}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
            <Touchable
              radius={radius.pill}
              haptic="press"
              onPress={handleSwap}
              accessibilityLabel="Swap departure and destination"
              style={[styles.swapBtn, { borderColor: theme.colors.outlineVariant }]}
            >
              <View style={styles.swapInner}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: swapSpin.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons name="swap-vertical" size={17} color={theme.colors.primary} />
                </Animated.View>
              </View>
            </Touchable>
          </View>

          {renderEndpoint('to', toPicker)}

          <View style={styles.plannerFooter}>
            <Text
              variant="labelSmall"
              style={[overline, styles.departLabel, { color: theme.colors.onSurfaceVariant }]}
            >
              Depart
            </Text>
            <View style={styles.timeChips}>
              {TIME_OPTIONS.map((option) => {
                const isActive = departureOffsetMinutes === option.value;
                return (
                  <Touchable
                    key={option.label}
                    radius={radius.pill}
                    haptic="select"
                    onPress={() => setDepartureOffsetMinutes(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Depart ${option.label}`}
                    style={{
                      backgroundColor: isActive ? theme.colors.primary : 'transparent',
                      borderWidth: 1,
                      borderColor: isActive ? theme.colors.primary : theme.colors.outlineVariant,
                    }}
                  >
                    <View style={styles.timeChip}>
                      <Text
                        variant="labelMedium"
                        style={[
                          emphasis.strong,
                          {
                            color: isActive
                              ? theme.colors.onPrimary
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
                backgroundColor: canSearch
                  ? theme.colors.primary
                  : theme.colors.surfaceDisabled,
              }}
            >
              <View style={styles.findButton}>
                <Text
                  variant="titleSmall"
                  style={[
                    emphasis.heavy,
                    {
                      color: canSearch
                        ? theme.colors.onPrimary
                        : theme.colors.onSurfaceDisabled,
                    },
                  ]}
                >
                  Find Route
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={canSearch ? theme.colors.onPrimary : theme.colors.onSurfaceDisabled}
                />
              </View>
            </Touchable>
          </View>
        </Card>
      </Reveal>

      {/* Disruption banner */}
      {disruptedLines.length > 0 && (
        <Reveal index={2}>
          <Touchable
            radius={radius.card}
            onPress={() => navigation.getParent()?.navigate('AlertsTab' as never)}
            scaleOnPress
            accessibilityLabel={`${disruptedLines.length} lines with service disruptions. View alerts.`}
            style={{ backgroundColor: semantic.warningContainer }}
          >
            <View style={styles.disruptionBanner}>
              <Ionicons name="warning" size={18} color={semantic.onWarningContainer} />
              <View style={styles.disruptionText}>
                <Text
                  variant="labelMedium"
                  style={[overline, { color: semantic.onWarningContainer }]}
                >
                  Service disruptions
                </Text>
                <View style={styles.disruptionChips}>
                  {disruptedLines.map((line) => (
                    <View
                      key={line.id}
                      style={[
                        styles.disruptionChip,
                        { backgroundColor: line.primary_color_code },
                      ]}
                    >
                      <Text
                        style={[
                          styles.disruptionChipText,
                          { color: onColor(line.primary_color_code) },
                        ]}
                      >
                        {line.line_code}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={semantic.onWarningContainer}
              />
            </View>
          </Touchable>
        </Reveal>
      )}

      {/* Popular routes — one grouped list rather than a stack of cards, so
          five entries read as a set instead of five competing objects. */}
      {(popularRoutes.data?.length ?? 0) > 0 && (
        <Reveal index={3}>
          <View style={styles.section}>
            <SectionHeader title="Frequent" icon="repeat-outline" />
            <Card radius={radius.hero} style={styles.groupCard}>
              {popularRoutes.data!.map((route, index) => (
                <View key={route.routeKey}>
                  {index > 0 && (
                    <View
                      style={[
                        styles.groupDivider,
                        { backgroundColor: theme.colors.outlineVariant },
                      ]}
                    />
                  )}
                  <Touchable
                    radius={0}
                    onPress={() =>
                      handlePopularRoute(route.fromStationCode, route.toStationCode)
                    }
                    accessibilityLabel={`Plan ${nameForCode(route.fromStationCode)} to ${nameForCode(route.toStationCode)}`}
                  >
                    <View style={styles.routeRow}>
                      <View style={styles.miniRail}>
                        <View
                          style={[styles.miniDot, { backgroundColor: semantic.success }]}
                        />
                        <View
                          style={[
                            styles.miniLine,
                            { backgroundColor: theme.colors.outlineVariant },
                          ]}
                        />
                        <View
                          style={[styles.miniDot, { backgroundColor: theme.colors.error }]}
                        />
                      </View>
                      <View style={styles.routeNames}>
                        <Text
                          variant="bodyLarge"
                          numberOfLines={1}
                          style={[emphasis.medium, { color: theme.colors.onSurface }]}
                        >
                          {nameForCode(route.fromStationCode)}
                        </Text>
                        <Text
                          variant="bodyLarge"
                          numberOfLines={1}
                          style={[emphasis.medium, { color: theme.colors.onSurface }]}
                        >
                          {nameForCode(route.toStationCode)}
                        </Text>
                      </View>
                      <Text
                        variant="labelSmall"
                        style={[overline, { color: theme.colors.onSurfaceVariant }]}
                      >
                        {route.hitCount}×
                      </Text>
                    </View>
                  </Touchable>
                </View>
              ))}
            </Card>
          </View>
        </Reveal>
      )}

      {/* Recent alerts */}
      {(notifications.data?.length ?? 0) > 0 && (
        <Reveal index={4}>
          <View style={styles.section}>
            <SectionHeader
              title="Alerts"
              icon="megaphone-outline"
              action="All"
              onAction={() => navigation.getParent()?.navigate('AlertsTab' as never)}
            />
            <View style={styles.notifList}>
              {notifications.data!.slice(0, 3).map((notif) => (
                <NotificationCard key={notif.id} notification={notif} />
              ))}
            </View>
          </View>
        </Reveal>
      )}

      <StationPicker
        visible={fromPicker.visible}
        onSelect={fromPicker.select as (s: { code: string; name: string }) => void}
        onClose={fromPicker.close}
        title="Departure Station"
      />
      <StationPicker
        visible={toPicker.visible}
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
  // Masthead
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTitle: {
    letterSpacing: -0.8,
  },
  heroAction: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Planner
  plannerCard: {
    borderRadius: radius.hero,
    padding: spacing.md,

  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  rail: {
    width: RAIL_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLine: {
    position: 'absolute',
    width: 2,
    top: 0,
    bottom: 0,
  },
  railFromCenter: {
    top: '50%',
  },
  railToCenter: {
    bottom: '50%',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    // A ring in the page color punches a gap in the rail, so the dot reads as
    // a station sitting on the line rather than a blob painted over it.
    borderWidth: 3,
  },
  endpointText: {
    flex: 1,
    gap: 1,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.sm,
    opacity: 0.7,
  },
  swapBtn: {
    borderWidth: 1,
    marginLeft: spacing.md,
  },
  swapInner: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plannerFooter: {
    gap: spacing.sm,
    paddingTop: spacing.base,
  },
  departLabel: {
    paddingLeft: 2,
  },
  timeChips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  timeChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    alignItems: 'center',
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    marginTop: spacing.xs,
  },
  // Sections
  section: {
    gap: spacing.xs,
  },
  groupCard: {
    borderRadius: radius.hero,

    overflow: 'hidden',
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.base + 10,
    opacity: 0.5,
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
  miniDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  miniLine: {
    width: 1.5,
    flex: 1,
    minHeight: 12,
    marginVertical: 3,
  },
  routeNames: {
    flex: 1,
    gap: 3,
  },
  notifList: {
    gap: spacing.sm,
  },
  // Disruption banner
  disruptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  disruptionText: {
    gap: spacing.sm,
    flex: 1,
  },
  disruptionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  disruptionChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: shape.xs,
  },
  disruptionChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
