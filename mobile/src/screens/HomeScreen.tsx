import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Surface, Text, useTheme } from 'react-native-paper';
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
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/types';
import { spacing, radius, emphasis, onColor } from '../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

const TIME_OPTIONS = [
  { label: 'Now', value: 0 },
  { label: '+15m', value: 15 },
  { label: '+30m', value: 30 },
  { label: '+1h', value: 60 },
] as const;

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
  const { semantic, fills, isDark } = useAppTheme();
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

  const renderStationRow = (
    kind: 'from' | 'to',
    picker: ReturnType<typeof useStationPicker>,
  ) => {
    const isFrom = kind === 'from';
    const dotColor = isFrom ? semantic.success : theme.colors.error;
    const label = isFrom ? 'From' : 'To';
    const placeholder = isFrom ? 'Select departure' : 'Select destination';

    return (
      <Touchable
        radius={radius.field}
        onPress={picker.open}
        accessibilityLabel={`${label}: ${picker.station?.name ?? placeholder}`}
        accessibilityHint="Opens the station picker"
      >
        <View style={styles.stationRow}>
          <View style={styles.dotColumn}>
            <View style={[styles.connector, !isFrom && { backgroundColor: theme.colors.outlineVariant }]} />
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <View style={[styles.connector, isFrom && { backgroundColor: theme.colors.outlineVariant }]} />
          </View>
          <View style={styles.stationText}>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {label}
            </Text>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              style={[
                picker.station ? emphasis.strong : undefined,
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
      {/* Hero */}
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Ionicons name="train" size={28} color={theme.colors.onPrimaryContainer} />
        </View>
        <View style={styles.heroText}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {greeting()}
          </Text>
          <Text
            variant="headlineMedium"
            style={[emphasis.heavy, { color: theme.colors.onSurface }]}
          >
            Delhi Metro
          </Text>
        </View>
      </View>

      {/* Journey planner */}
      <Surface style={styles.plannerCard} elevation={isDark ? 2 : 1}>
        <View style={styles.plannerRows}>
          {renderStationRow('from', fromPicker)}
          <View style={[styles.rowDivider, { backgroundColor: theme.colors.outlineVariant }]} />
          {renderStationRow('to', toPicker)}

          <View style={styles.swapAnchor} pointerEvents="box-none">
            <Touchable
              radius={radius.pill}
              onPress={handleSwap}
              accessibilityLabel="Swap departure and destination"
              style={[styles.swapBtn, { backgroundColor: fills.accentSubtle }]}
            >
              <View style={styles.swapInner}>
                <Ionicons name="swap-vertical" size={20} color={theme.colors.primary} />
              </View>
            </Touchable>
          </View>
        </View>

        {/* Departure time */}
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={16} color={theme.colors.onSurfaceVariant} />
          <View style={styles.timeChips}>
            {TIME_OPTIONS.map((option) => {
              const isActive = departureOffsetMinutes === option.value;
              return (
                <Touchable
                  key={option.label}
                  radius={radius.pill}
                  onPress={() => setDepartureOffsetMinutes(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Depart ${option.label}`}
                  style={{
                    backgroundColor: isActive ? theme.colors.primary : fills.subtle,
                  }}
                >
                  <View style={styles.timeChip}>
                    <Text
                      variant="labelMedium"
                      style={[
                        isActive ? emphasis.heavy : emphasis.medium,
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
        </View>

        {/* Find route */}
        <Touchable
          radius={radius.pill}
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
              name="navigate"
              size={20}
              color={canSearch ? theme.colors.onPrimary : theme.colors.onSurfaceDisabled}
            />
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
          </View>
        </Touchable>
      </Surface>

      {/* Disruption banner — only shown when lines have issues */}
      {disruptedLines.length > 0 && (
        <Touchable
          radius={radius.card}
          onPress={() => navigation.getParent()?.navigate('AlertsTab' as never)}
          scaleOnPress
          accessibilityLabel={`${disruptedLines.length} lines with service disruptions. View alerts.`}
          style={{ backgroundColor: semantic.warningContainer }}
        >
          <View style={styles.disruptionBanner}>
            <View style={[styles.disruptionIconWrap, { backgroundColor: semantic.warning }]}>
              <Ionicons name="warning" size={16} color={semantic.onWarning} />
            </View>
            <View style={styles.disruptionText}>
              <Text
                variant="labelLarge"
                style={[emphasis.heavy, { color: semantic.onWarningContainer }]}
              >
                Service Disruptions
              </Text>
              <View style={styles.disruptionChips}>
                {disruptedLines.map((line) => (
                  <View
                    key={line.id}
                    style={[styles.disruptionChip, { backgroundColor: line.primary_color_code }]}
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
            <Ionicons name="chevron-forward" size={18} color={semantic.onWarningContainer} />
          </View>
        </Touchable>
      )}

      {/* Popular routes */}
      {(popularRoutes.data?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Popular Routes" icon="repeat-outline" />
          <View style={styles.popularList}>
            {popularRoutes.data!.map((route) => (
              <Touchable
                key={route.routeKey}
                radius={radius.card}
                scaleOnPress
                onPress={() => handlePopularRoute(route.fromStationCode, route.toStationCode)}
                accessibilityLabel={`Plan ${nameForCode(route.fromStationCode)} to ${nameForCode(route.toStationCode)}`}
                style={{ backgroundColor: fills.subtle }}
              >
                <View style={styles.popularCard}>
                  <View style={styles.popularDots}>
                    <View style={[styles.popularDot, { backgroundColor: semantic.success }]} />
                    <View
                      style={[styles.popularDotLine, { backgroundColor: theme.colors.outlineVariant }]}
                    />
                    <View style={[styles.popularDot, { backgroundColor: theme.colors.error }]} />
                  </View>
                  <View style={styles.popularNames}>
                    <Text
                      variant="bodyMedium"
                      numberOfLines={1}
                      style={[emphasis.strong, { color: theme.colors.onSurface }]}
                    >
                      {nameForCode(route.fromStationCode)}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      numberOfLines={1}
                      style={[emphasis.strong, { color: theme.colors.onSurface }]}
                    >
                      {nameForCode(route.toStationCode)}
                    </Text>
                  </View>
                  <View style={[styles.hitsBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text
                      variant="labelSmall"
                      style={[emphasis.heavy, { color: theme.colors.onPrimaryContainer }]}
                    >
                      {route.hitCount}×
                    </Text>
                  </View>
                </View>
              </Touchable>
            ))}
          </View>
        </View>
      )}

      {/* Recent alerts */}
      {(notifications.data?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title="Recent Alerts"
            icon="megaphone-outline"
            action="See all"
            onAction={() => navigation.getParent()?.navigate('AlertsTab' as never)}
          />
          <View style={styles.notifList}>
            {notifications.data!.slice(0, 3).map((notif) => (
              <NotificationCard key={notif.id} notification={notif} />
            ))}
          </View>
        </View>
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

const SWAP_SIZE = 44;

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.icon,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
  },
  // Planner
  plannerCard: {
    borderRadius: radius.hero,
    padding: spacing.md,
    gap: spacing.md,
  },
  plannerRows: {
    position: 'relative',
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: SWAP_SIZE + spacing.md,
    minHeight: 64,
  },
  dotColumn: {
    width: 32,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: 'transparent',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stationText: {
    flex: 1,
    gap: 1,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 32 + spacing.sm,
    opacity: 0.6,
  },
  swapAnchor: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  swapBtn: {
    width: SWAP_SIZE,
    height: SWAP_SIZE,
  },
  swapInner: {
    width: SWAP_SIZE,
    height: SWAP_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Time
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  timeChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
  },
  // Sections
  section: {
    gap: spacing.xs,
  },
  popularList: {
    gap: spacing.sm,
  },
  popularCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  popularDots: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  popularDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  popularDotLine: {
    width: 2,
    height: 14,
    marginVertical: 2,
  },
  popularNames: {
    flex: 1,
    gap: 6,
  },
  hitsBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  notifList: {
    gap: spacing.sm,
  },
  // Disruption banner
  disruptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  disruptionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.iconSmall,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disruptionText: {
    gap: spacing.xs,
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
    borderRadius: radius.badge,
  },
  disruptionChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
