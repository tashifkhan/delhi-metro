import { useHaptics } from '../hooks/useHaptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import {
  useBookingQuery,
  useJourneyPlanCachedQuery,
  useMetroLinesQuery,
  useStationSearchQuery,
} from '../hooks';
import { StrategyToggle } from '../components/StrategyToggle';
import { JourneyFareSummary } from '../components/JourneyFareSummary';
import { RouteSegmentView } from '../components/RouteSegmentView';
import { TransferSegmentView } from '../components/TransferSegmentView';
import { FirstLastTrainCard } from '../components/FirstLastTrainCard';
import { WhatsAppBookingCard } from '../components/WhatsAppBookingCard';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { StationPicker } from '../components/StationPicker';
import { Touchable } from '../components/Touchable';
import { Reveal } from '../components/Reveal';
import { Card } from '../components/Card';
import { JourneyFields } from '../components/JourneyFields';
import { useAppTheme } from '../theme/ThemeContext';
import type { MetroNetwork, RouteStrategy, WhatsAppBooking } from '../types';
import type { HomeStackParamList } from '../navigation/types';
import { spacing, radius, emphasis } from '../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'JourneyResults'>;
type Route = RouteProp<HomeStackParamList, 'JourneyResults'>;

const STRATEGIES: RouteStrategy[] = ['least-distance', 'minimum-interchange'];

function normalizeLineKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function JourneyResultsScreen() {
  const haptics = useHaptics();
  const route = useRoute<Route>();
  const isFocused = useIsFocused();
  const lastOutcome = useRef<string | null>(null);
  const navigation = useNavigation<Nav>();
  const { fromCode, toCode, fromName, toName, journeyTime } = route.params;
  const theme = useTheme();
  const { fills } = useAppTheme();
  const [strategy, setStrategy] = useState<RouteStrategy>('least-distance');
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);

  const handleSwapStations = useCallback(() => {
    navigation.setParams({
      fromCode: toCode,
      fromName: toName,
      toCode: fromCode,
      toName: fromName,
    });
  }, [navigation, fromCode, fromName, toCode, toName]);

  const handleStationSelect = useCallback(
    (station: { code: string; name: string }) => {
      const target = editing;
      setEditing(null);
      if (!target) return;

      if (target === 'from') {
        // Picking the current destination as origin just reverses the journey.
        if (station.code === toCode) {
          handleSwapStations();
          return;
        }
        navigation.setParams({ fromCode: station.code, fromName: station.name });
      } else {
        if (station.code === fromCode) {
          handleSwapStations();
          return;
        }
        navigation.setParams({ toCode: station.code, toName: station.name });
      }
    },
    [editing, navigation, fromCode, toCode, handleSwapStations],
  );

  const { data: plan, isPending, isError, isPlaceholderData, savedAt, refetch } =
    useJourneyPlanCachedQuery(
    fromCode,
    toCode,
    strategy,
    journeyTime,
  );
  // Plans saved before booking links existed have none. Fetch the operator
  // link instead of hiding the button. A fresh plan already carries them.
  const planBookings = plan?.bookings ?? [];
  const fallbackNetwork: MetroNetwork =
    plan?.networks[0] ?? (plan?.source === 'nmrc' ? 'nmrc' : 'dmrc');
  const { data: fallbackBooking } = useBookingQuery(
    fallbackNetwork,
    Boolean(plan) && planBookings.length === 0,
  );
  const bookings: WhatsAppBooking[] =
    planBookings.length > 0 ? planBookings : fallbackBooking ? [fallbackBooking] : [];
  // One outcome per requested journey, including cached results. Refetches stay quiet.
  const journeyKey = JSON.stringify([fromCode, toCode, strategy, journeyTime]);
  useEffect(() => {
    if (!isFocused || isPending || isPlaceholderData || (!plan && !isError)) return;
    const outcomeKey = `${journeyKey}:${plan ? 'success' : 'error'}`;
    if (lastOutcome.current === outcomeKey) return;
    lastOutcome.current = outcomeKey;
    if (plan) haptics.success();
    else haptics.error();
  }, [isFocused, isPending, isPlaceholderData, plan, isError, journeyKey, haptics]);
  const { data: lines } = useMetroLinesQuery();
  const { data: allStations } = useStationSearchQuery('');
  const swipeHint = useRef(new Animated.Value(0)).current;
  const canSwipe = !plan || plan.networks.length === 0 || plan.networks.includes('dmrc');
  const canSwipeRef = useRef(canSwipe);
  canSwipeRef.current = canSwipe;
  const strategyRef = useRef(strategy);
  strategyRef.current = strategy;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        canSwipeRef.current && Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (!canSwipeRef.current) return;
        const current = strategyRef.current;
        if (gs.dx < -50 && current !== 'minimum-interchange') {
          haptics.select();
          setStrategy('minimum-interchange');
          Animated.sequence([
            Animated.timing(swipeHint, { toValue: -8, duration: 120, useNativeDriver: true }),
            Animated.spring(swipeHint, { toValue: 0, useNativeDriver: true }),
          ]).start();
        } else if (gs.dx > 50 && current !== 'least-distance') {
          haptics.select();
          setStrategy('least-distance');
          Animated.sequence([
            Animated.timing(swipeHint, { toValue: 8, duration: 120, useNativeDriver: true }),
            Animated.spring(swipeHint, { toValue: 0, useNativeDriver: true }),
          ]).start();
        }
      },
    }),
  ).current;

  const selectedTimeLabel = useMemo(() => {
    if (!journeyTime) return 'Now';
    const parsed = new Date(journeyTime);
    if (Number.isNaN(parsed.getTime())) return 'Custom time';
    return parsed.toLocaleString();
  }, [journeyTime]);

  const stationCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allStations ?? []) {
      map.set(s.station_name.trim().toLowerCase(), s.station_code);
    }
    return map;
  }, [allStations]);

  const lineColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of lines ?? []) {
      map.set(normalizeLineKey(line.name), line.primary_color_code);
      map.set(normalizeLineKey(line.line_color), line.primary_color_code);
      map.set(normalizeLineKey(line.line_code), line.primary_color_code);
    }
    return map;
  }, [lines]);

  // Only block the whole screen on the first load for this OD pair.
  if (isPending && !plan) return <LoadingState message="Planning your journey..." />;
  if (isError && !plan) {
    return <ErrorState message="Could not plan this journey" onRetry={refetch} />;
  }
  if (!plan) return <ErrorState message="No route data available" />;

  const rideLegs = plan.legs.filter((leg) => leg.kind !== 'transfer');
  // Optimization strategies only differ where the network has alternate paths;
  // the Aqua Line has one, so an NMRC-only journey has a single route.
  const hasStrategyChoice = plan.networks.length === 0 || plan.networks.includes('dmrc');
  const rideCount = rideLegs.length;
  // Upstream interchange metadata also contains the destination. Count the
  // changes between trains so the terminal stop does not add a fake change.
  const interchanges = Math.max(0, rideCount - 1);
  const savedLabel = savedAt
    ? `Saved plan from ${new Date(savedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })}. Fares may have changed.`
    : 'Saved plan. Fares may have changed.';

  const sourceLabel =
    plan.source === 'combined'
      ? 'Delhi Metro and Noida Metro'
      : plan.source === 'sarthi'
        ? 'Sarthi'
        : plan.source === 'nmrc'
          ? 'NMRC website'
          : 'DMRC';

  const detailsButton = (name: string, code: string) => (
    <Touchable
      radius={radius.pill}
      onPress={() => navigation.navigate('StationDetail', { stationCode: code, stationName: name })}
      accessibilityLabel={`Station details for ${name}`}
    >
      <View style={styles.infoBtn}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </View>
    </Touchable>
  );

  const stats: { key: string; icon: keyof typeof Ionicons.glyphMap; text: string; accent?: boolean }[] =
    [
      { key: 'time', icon: 'time-outline', text: plan.total_time, accent: true },
      {
        key: 'changes',
        icon: 'swap-horizontal-outline',
        text: `${interchanges} ${interchanges === 1 ? 'change' : 'changes'}`,
      },
      { key: 'stops', icon: 'git-commit-outline', text: `${plan.station_count} stops` },
      { key: 'depart', icon: 'calendar-outline', text: `Leaving ${selectedTimeLabel.toLowerCase() === 'now' ? 'now' : selectedTimeLabel}` },
    ];

  return (
    <View
      style={{ flex: 1 }}
      {...(hasStrategyChoice ? panResponder.panHandlers : {})}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {savedAt !== null && !isPlaceholderData ? <OfflineNote message={savedLabel} /> : null}
        {/* Journey header: the same fields as the Home planner, so the plan
            reads as the same object, then the summary chips. */}
        <Reveal index={0} replayOnFocus={false}>
          <View style={[styles.header, { backgroundColor: fills.container }]}>
            <JourneyFields
              from={{
                name: fromName,
                placeholder: 'Choose departure',
                onPress: () => setEditing('from'),
                accessibilityLabel: `Change departure, currently ${fromName}`,
                trailing: detailsButton(fromName, fromCode),
              }}
              to={{
                name: toName,
                placeholder: 'Choose destination',
                onPress: () => setEditing('to'),
                accessibilityLabel: `Change destination, currently ${toName}`,
                trailing: detailsButton(toName, toCode),
              }}
              onSwap={handleSwapStations}
              swapLabel="Reverse this journey"
            />
            <View style={styles.chips}>
              {stats.map((stat) => (
                <View
                  key={stat.key}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: stat.accent
                        ? theme.colors.primaryContainer
                        : fills.containerHigh,
                    },
                  ]}
                >
                  <Ionicons
                    name={stat.icon}
                    size={16}
                    color={
                      stat.accent ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant
                    }
                  />
                  <Text
                    variant="labelLarge"
                    numberOfLines={1}
                    style={[
                      emphasis.strong,
                      {
                        color: stat.accent
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurface,
                      },
                    ]}
                  >
                    {stat.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Reveal>

        {hasStrategyChoice && (
          <Reveal index={1} replayOnFocus={false}>
            <Animated.View style={{ transform: [{ translateX: swipeHint }] }}>
              <StrategyToggle active={strategy} onChange={setStrategy} />
              <View style={styles.swipeDots}>
                {STRATEGIES.map((s) => (
                  <View
                    key={s}
                    style={[
                      styles.swipeDot,
                      {
                        backgroundColor:
                          strategy === s
                            ? theme.colors.primary
                            : theme.colors.outlineVariant,
                        width: strategy === s ? 20 : 6,
                      },
                    ]}
                  />
                ))}
              </View>
            </Animated.View>
          </Reveal>
        )}

        <Reveal index={3} replayOnFocus={false}>
          <JourneyFareSummary fare={plan.fare} separateTickets={plan.separate_tickets} />
        </Reveal>

        <Reveal index={4} replayOnFocus={false}>
          <WhatsAppBookingCard bookings={bookings} />
        </Reveal>

        {/* Route visualization */}
        <Reveal index={5} replayOnFocus={false}>
        <Card radius={radius.hero} style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Text
              variant="titleMedium"
              style={[emphasis.heavy, styles.routeTitle, { color: theme.colors.onSurface }]}
            >
              Route
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {rideCount} {rideCount === 1 ? 'line' : 'lines'}
            </Text>
          </View>
          <View style={styles.routeSegments}>
            {plan.legs.map((leg, index) =>
              leg.kind === 'transfer' ? (
                <TransferSegmentView
                  key={`transfer-${leg.from_station}-${index}`}
                  leg={leg}
                />
              ) : (
                <RouteSegmentView
                  key={`${leg.line_name}-${leg.from_station}-${index}`}
                  leg={leg}
                  lineColor={
                    leg.line_color ??
                    lineColorMap.get(normalizeLineKey(leg.line_name)) ??
                    theme.colors.primary
                  }
                  isLast={index === plan.legs.length - 1}
                  stationCodeMap={stationCodeMap}
                  onStationPress={(code, name) =>
                    navigation.navigate('StationDetail', { stationCode: code, stationName: name })
                  }
                />
              ),
            )}
          </View>
          <View style={styles.sourceRow}>
            <Ionicons name="cloud-outline" size={12} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {plan.fallback_reason
                ? `Planned via ${sourceLabel} (fallback)`
                : `Planned via ${sourceLabel}`}
            </Text>
          </View>
        </Card>
        </Reveal>

        <Reveal index={6} replayOnFocus={false}>
          <FirstLastTrainCard data={plan.metro_service} />
        </Reveal>
      </ScrollView>

      <StationPicker
        visible={editing !== null}
        selectedCode={editing === 'from' ? fromCode : toCode}
        onSelect={handleStationSelect}
        onClose={() => setEditing(null)}
        title={editing === 'to' ? 'Change Destination' : 'Change Departure'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  header: {
    borderRadius: radius.hero + 4,
    padding: spacing.sm,
    gap: spacing.md,
    marginHorizontal: -spacing.xs,
  },
  infoBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.badge + 2,
  },
  swipeDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  swipeDot: {
    height: 6,
    borderRadius: 3,
  },
  routeCard: {
    borderRadius: radius.hero,
    padding: spacing.base,
    gap: spacing.base,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeTitle: {
    flex: 1,
  },
  routeSegments: {
    gap: 0,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
