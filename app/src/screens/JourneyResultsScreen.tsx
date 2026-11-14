import { useHaptics } from '../hooks/useHaptics';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Appbar, Text, useTheme } from 'react-native-paper';
import {
  useJourneyPlanCachedQuery,
  useMetroLinesQuery,
  useStationSearchQuery,
} from '../hooks';
import { StrategyToggle } from '../components/StrategyToggle';
import { RouteSegmentView } from '../components/RouteSegmentView';
import { TransferSegmentView } from '../components/TransferSegmentView';
import { WhatsAppBookingCard } from '../components/WhatsAppBookingCard';
import { TicketPass, type PassColumn } from '../components/TicketPass';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { StationPicker } from '../components/StationPicker';
import { Touchable } from '../components/Touchable';
import { Reveal } from '../components/Reveal';
import { useAppTheme } from '../theme/ThemeContext';
import { NETWORK_NAMES } from '../network';
import type { MetroNetwork, PlannedFare, RouteStrategy, WhatsAppBooking } from '../types';
import type { HomeStackParamList } from '../navigation/types';
import { spacing, shape, emphasis, tabular } from '../theme';
import { clockTime, durationLabel, stationName } from '../utils/format';
import { bookingsFor } from '../services/whatsappBooking';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'JourneyResults'>;
type Route = RouteProp<HomeStackParamList, 'JourneyResults'>;

const WEB_ORIGIN = 'https://ncr-metro.tashif.codes';

function normalizeLineKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function inr(value: number): string {
  return `₹${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

/** "₹50 + ₹40" for a two-operator trip, else the fare that applies now. */
function fareChip(fare: PlannedFare): string {
  if (fare.breakdown.length > 1) {
    return fare.breakdown.map((part) => inr(part.applicable ?? part.normal)).join(' + ');
  }
  return inr(fare.applicable ?? fare.normal);
}

type ChipTone = 'accent' | 'tonal' | 'outline';

export function JourneyResultsScreen() {
  const haptics = useHaptics();
  const route = useRoute<Route>();
  const isFocused = useIsFocused();
  const lastOutcome = useRef<string | null>(null);
  const navigation = useNavigation<Nav>();
  const { fromCode, toCode, journeyTime } = route.params;
  const theme = useTheme();
  const { fills } = useAppTheme();
  const [strategy, setStrategy] = useState<RouteStrategy>(
    route.params.strategy ?? 'least-distance',
  );
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [bookY, setBookY] = useState(0);
  // Hide the jump-to-booking button once the booking cards are on screen.
  const [bookingVisible, setBookingVisible] = useState(false);
  const viewportH = useRef(0);

  const { data: plan, isPending, isError, isPlaceholderData, savedAt, refetch } =
    useJourneyPlanCachedQuery(fromCode, toCode, strategy, journeyTime);

  // Deep links carry only codes, so fall back to the plan's own names.
  const fromName = stationName(route.params.fromName ?? plan?.origin.name ?? fromCode);
  const toName = stationName(route.params.toName ?? plan?.destination.name ?? toCode);

  const handleSwapStations = useCallback(() => {
    navigation.setParams({
      fromCode: toCode,
      fromName: toName,
      toCode: fromCode,
      toName: fromName,
    });
  }, [navigation, fromCode, fromName, toCode, toName]);

  const handleShare = useCallback(() => {
    const url = `${WEB_ORIGIN}/journey/${encodeURIComponent(fromCode)}/${encodeURIComponent(toCode)}`;
    const content =
      Platform.OS === 'ios'
        ? { message: `${fromName} to ${toName}`, url }
        : { message: `${fromName} to ${toName} on the metro: ${url}` };
    Share.share(content).catch(() => undefined);
  }, [fromCode, toCode, fromName, toName]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: ({ tintColor }) => (
        <>
          <Appbar.Action
            icon={({ size, color }) => <Ionicons name="swap-vertical" size={size} color={color} />}
            color={tintColor}
            accessibilityLabel="Reverse this journey"
            onPress={() => {
              haptics.press();
              handleSwapStations();
            }}
          />
          <Appbar.Action
            icon={({ size, color }) => <Ionicons name="share-outline" size={size} color={color} />}
            color={tintColor}
            accessibilityLabel="Share this route"
            onPress={handleShare}
          />
        </>
      ),
    });
  }, [navigation, handleSwapStations, handleShare, haptics]);

  const handleStationSelect = useCallback(
    (station: { code: string; name: string }) => {
      const target = editing;
      setEditing(null);
      if (!target) return;
      if (target === 'from') {
        if (station.code === toCode) return handleSwapStations();
        navigation.setParams({ fromCode: station.code, fromName: station.name });
      } else {
        if (station.code === fromCode) return handleSwapStations();
        navigation.setParams({ toCode: station.code, toName: station.name });
      }
    },
    [editing, navigation, fromCode, toCode, handleSwapStations],
  );

  // The API attaches booking links to fresh plans. Saved plans, and an API
  // deploy without the field, get the app's own copy of the same links.
  const bookings: WhatsAppBooking[] = !plan
    ? []
    : plan.bookings && plan.bookings.length > 0
      ? plan.bookings
      : bookingsFor(
          plan.networks.length > 0 ? plan.networks : [plan.source === 'nmrc' ? 'nmrc' : 'dmrc'],
        );

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
        const next: RouteStrategy | null =
          gs.dx < -50 && current !== 'minimum-interchange'
            ? 'minimum-interchange'
            : gs.dx > 50 && current !== 'least-distance'
              ? 'least-distance'
              : null;
        if (!next) return;
        haptics.select();
        setStrategy(next);
        Animated.sequence([
          Animated.timing(swipeHint, {
            toValue: gs.dx < 0 ? -8 : 8,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.spring(swipeHint, { toValue: 0, useNativeDriver: true }),
        ]).start();
      },
    }),
  ).current;

  const departureDate = useMemo(() => {
    const parsed = journeyTime ? new Date(journeyTime) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [journeyTime]);

  const stationCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allStations ?? []) map.set(s.station_name.trim().toLowerCase(), s.station_code);
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

  if (isPending && !plan) return <LoadingState message="Planning your journey..." />;
  if (isError && !plan) {
    return <ErrorState message="Could not plan this journey" onRetry={refetch} />;
  }
  if (!plan) return <ErrorState message="No route data available" />;

  const rideLegs = plan.legs.filter((leg) => leg.kind !== 'transfer');
  // Strategies only differ where the network has alternate paths; the Aqua
  // Line has one, so an NMRC-only journey has a single route.
  const hasStrategyChoice = plan.networks.length === 0 || plan.networks.includes('dmrc');
  // Upstream interchange metadata also contains the destination. Count the
  // changes between trains so the terminal stop does not add a fake change.
  const changes = Math.max(0, rideLegs.length - 1);
  const colorFor = (lineName: string, explicit: string | null) =>
    explicit ?? lineColorMap.get(normalizeLineKey(lineName)) ?? theme.colors.primary;

  const leave = clockTime(rideLegs[0]?.start_time);
  const arrive = clockTime(rideLegs[rideLegs.length - 1]?.end_time);
  const totalTime = durationLabel(plan.total_time) ?? plan.total_time;
  const transfer = plan.legs.find((leg) => leg.kind === 'transfer');

  // Each operator's share of the trip, for the booking cards and the pass.
  const networkEnds: Partial<Record<MetroNetwork, { from: string; to: string; color: string }>> =
    {};
  for (const network of plan.networks) {
    const legs = rideLegs.filter((leg) => leg.network === network);
    if (legs.length === 0) continue;
    networkEnds[network] = {
      from: stationName(legs[0].from_station),
      to: stationName(legs[legs.length - 1].to_station),
      color: colorFor(legs[0].line_name, legs[0].line_color),
    };
  }
  const networkRoutes: Partial<Record<MetroNetwork, string>> = {};
  for (const [network, ends] of Object.entries(networkEnds) as [
    MetroNetwork,
    { from: string; to: string },
  ][]) {
    networkRoutes[network] = `${ends.from} to ${ends.to}`;
  }
  if (plan.networks.length <= 1 && bookings[0]) {
    networkRoutes[bookings[0].network] = `${fromName} to ${toName}`;
  }

  const weekend = plan.fare.special ?? plan.fare.normal;
  const breakdown = plan.fare.breakdown;
  const passColumns: [PassColumn, PassColumn] =
    breakdown.length > 1
      ? [
          {
            label: `Leg 1, ${breakdown[0].network.toUpperCase()}`,
            value: inr(breakdown[0].applicable ?? breakdown[0].normal),
            note: networkEnds[breakdown[0].network]
              ? `To ${networkEnds[breakdown[0].network]!.to}`
              : NETWORK_NAMES[breakdown[0].network],
            color: networkEnds[breakdown[0].network]?.color,
          },
          {
            label: `Leg 2, ${breakdown[1].network.toUpperCase()}`,
            value: inr(breakdown[1].applicable ?? breakdown[1].normal),
            note: networkEnds[breakdown[1].network]
              ? `From ${networkEnds[breakdown[1].network]!.from}`
              : NETWORK_NAMES[breakdown[1].network],
            color: networkEnds[breakdown[1].network]?.color,
          },
        ]
      : [
          { label: 'Weekday', value: inr(plan.fare.normal), note: 'Monday to Saturday' },
          { label: 'Weekend', value: inr(weekend), note: 'Sunday and holidays' },
        ];

  const fareRows: { label: string; value: string }[] = [
    { label: 'Monday to Saturday', value: inr(plan.fare.normal) },
    { label: 'Sunday and holidays', value: inr(weekend) },
  ];
  if (
    plan.fare.applicable !== null &&
    plan.fare.applicable !== plan.fare.normal &&
    plan.fare.applicable !== weekend
  ) {
    fareRows.push({ label: 'At your departure time', value: inr(plan.fare.applicable) });
  }

  const sourceLabel =
    plan.source === 'combined'
      ? 'Delhi Metro and Noida Metro'
      : plan.source === 'sarthi'
        ? 'Sarthi'
        : plan.source === 'nmrc'
          ? 'the NMRC website'
          : 'DMRC';

  const savedLabel = savedAt
    ? `Saved plan from ${new Date(savedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })}. Fares may have changed.`
    : 'Saved plan. Fares may have changed.';

  const chips: { key: string; icon: keyof typeof Ionicons.glyphMap; text: string; tone: ChipTone }[] =
    [
      { key: 'time', icon: 'time-outline', text: totalTime, tone: 'accent' },
      { key: 'fare', icon: 'cash-outline', text: fareChip(plan.fare), tone: 'tonal' },
      {
        key: 'changes',
        icon: 'swap-horizontal',
        text: changes === 0 ? 'No changes' : `${changes} ${changes === 1 ? 'change' : 'changes'}`,
        tone: 'tonal',
      },
      { key: 'stops', icon: 'ellipsis-horizontal', text: `${plan.station_count} stops`, tone: 'outline' },
    ];

  const firstTrain = clockTime(plan.metro_service?.first?.trim());
  const lastTrain = clockTime(plan.metro_service?.last?.trim());

  const scrollToBooking = () =>
    scrollRef.current?.scrollTo({ y: Math.max(0, bookY - spacing.base), animated: true });

  return (
    <View
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      {...(hasStrategyChoice ? panResponder.panHandlers : {})}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        scrollEventThrottle={100}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
        onScroll={(e) => {
          const bottom = e.nativeEvent.contentOffset.y + viewportH.current;
          const visible = bookY > 0 && bottom > bookY + 160;
          if (visible !== bookingVisible) setBookingVisible(visible);
        }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {savedAt !== null && !isPlaceholderData ? <OfflineNote message={savedLabel} /> : null}

        {/* Headline. Each station name opens the picker to change it. */}
        <Reveal index={0} replayOnFocus={false}>
          <View style={styles.head}>
            <Text
              variant="headlineMedium"
              style={[styles.headline, { color: theme.colors.onSurface }]}
            >
              <Text
                onPress={() => setEditing('from')}
                accessibilityRole="button"
                accessibilityHint="Change the starting station"
              >
                {fromName}
              </Text>
              <Text style={[styles.headlineJoin, { color: theme.colors.onSurfaceVariant }]}>
                {' to '}
              </Text>
              <Text
                onPress={() => setEditing('to')}
                accessibilityRole="button"
                accessibilityHint="Change the destination"
              >
                {toName}
              </Text>
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {leave && arrive
                ? `Leave ${leave}, arrive ${arrive}`
                : leave
                  ? `Leave ${leave}, about ${totalTime} in all`
                  : `Leaving ${journeyTime ? departureDate.toLocaleString() : 'now'}`}
            </Text>
          </View>
        </Reveal>

        <Reveal index={1} replayOnFocus={false}>
          <View style={styles.chips}>
            {chips.map((chip) => {
              const fg =
                chip.tone === 'accent' ? theme.colors.onPrimaryContainer : theme.colors.onSurface;
              return (
                <View
                  key={chip.key}
                  style={[
                    styles.chip,
                    chip.tone === 'accent' && { backgroundColor: theme.colors.primaryContainer },
                    chip.tone === 'tonal' && { backgroundColor: fills.containerHigh },
                    chip.tone === 'outline' && {
                      borderWidth: 1,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  {chip.tone !== 'outline' ? (
                    <Ionicons name={chip.icon} size={16} color={fg} />
                  ) : null}
                  <Text variant="labelLarge" style={[emphasis.strong, tabular, { color: fg }]}>
                    {chip.text}
                  </Text>
                </View>
              );
            })}
          </View>
        </Reveal>

        {plan.separate_tickets ? (
          <Reveal index={2} replayOnFocus={false}>
            <View style={[styles.note, { backgroundColor: theme.colors.tertiaryContainer }]}>
              <Ionicons name="ticket" size={22} color={theme.colors.onTertiaryContainer} />
              <View style={styles.noteText}>
                <Text
                  variant="titleSmall"
                  style={[emphasis.strong, { color: theme.colors.onTertiaryContainer }]}
                >
                  You need two tickets
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onTertiaryContainer }}>
                  Delhi Metro and Noida Metro don't share tickets.
                  {transfer ? ` Buy the second one at ${stationName(transfer.to_station)}.` : ''}
                </Text>
              </View>
            </View>
          </Reveal>
        ) : null}

        {hasStrategyChoice ? (
          <Reveal index={3} replayOnFocus={false}>
            <Animated.View style={{ transform: [{ translateX: swipeHint }] }}>
              <StrategyToggle active={strategy} onChange={setStrategy} />
            </Animated.View>
          </Reveal>
        ) : null}

        <Reveal index={4} replayOnFocus={false}>
          <View style={[styles.timeline, { backgroundColor: fills.containerLow }]}>
            {plan.legs.map((leg, index) =>
              leg.kind === 'transfer' ? (
                <TransferSegmentView key={`transfer-${leg.from_station}-${index}`} leg={leg} />
              ) : (
                <RouteSegmentView
                  key={`${leg.line_name}-${leg.from_station}-${index}`}
                  leg={leg}
                  lineColor={colorFor(leg.line_name, leg.line_color)}
                  isLast={index === plan.legs.length - 1}
                  stationCodeMap={stationCodeMap}
                  onStationPress={(code, name) =>
                    navigation.navigate('StationDetail', { stationCode: code, stationName: name })
                  }
                />
              ),
            )}
          </View>
          <Text
            variant="labelSmall"
            style={[styles.source, { color: theme.colors.onSurfaceVariant }]}
          >
            {plan.fallback_reason
              ? `Planned by ${sourceLabel}, using the backup planner`
              : `Planned by ${sourceLabel}`}
          </Text>
        </Reveal>

        {firstTrain || lastTrain ? (
          <View style={styles.tiles}>
            {[
              { label: 'First train', value: firstTrain },
              { label: 'Last train', value: lastTrain },
            ].map((tile) => (
              <View
                key={tile.label}
                style={[styles.tile, { backgroundColor: fills.containerHigh }]}
              >
                <Text
                  variant="labelSmall"
                  style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  {tile.label}
                </Text>
                <Text
                  variant="headlineSmall"
                  style={[emphasis.strong, tabular, { color: theme.colors.onSurface }]}
                >
                  {tile.value ?? '—'}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  from {fromName}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View onLayout={(e) => setBookY(e.nativeEvent.layout.y)} style={styles.section}>
          <SectionHeader
            title={
              bookings.length > 1 ? 'Book tickets' : bookings.length === 1 ? 'Book a ticket' : 'Your ticket'
            }
          />
          <View style={styles.bookStack}>
            <TicketPass
              fromCode={plan.origin.code || fromCode}
              toCode={plan.destination.code || toCode}
              fromName={fromName}
              toName={toName}
              date={departureDate.toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              duration={totalTime}
              columns={passColumns}
            />
            <WhatsAppBookingCard bookings={bookings} routes={networkRoutes} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Fare by day" />
          <View style={[styles.fareTable, { backgroundColor: fills.containerLow }]}>
            {fareRows.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.fareRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  {row.label}
                </Text>
                <Text
                  variant="titleSmall"
                  style={[emphasis.strong, tabular, { color: theme.colors.onSurface }]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {bookings.length > 0 && !bookingVisible ? (
        <View style={styles.fabWrap} pointerEvents="box-none">
          <Touchable
            radius={shape.lg + 2}
            haptic="navigate"
            onPress={scrollToBooking}
            accessibilityLabel="Jump to booking"
            style={[styles.fab, { backgroundColor: theme.colors.primaryContainer }]}
          >
            <View style={styles.fabInner}>
              <Ionicons name="logo-whatsapp" size={22} color={theme.colors.onPrimaryContainer} />
              <Text
                variant="titleSmall"
                style={[emphasis.strong, { color: theme.colors.onPrimaryContainer }]}
              >
                {bookings.length > 1 ? 'Book tickets' : 'Book ticket'}
              </Text>
            </View>
          </Touchable>
        </View>
      ) : null}

      <StationPicker
        visible={editing !== null}
        selectedCode={editing === 'from' ? fromCode : toCode}
        onSelect={handleStationSelect}
        onClose={() => setEditing(null)}
        title={editing === 'to' ? 'Change destination' : 'Change start'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: 120,
    gap: spacing.base,
  },
  head: {
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  headline: {
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  headlineJoin: {
    fontWeight: '400',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: 20,
  },
  noteText: {
    flex: 1,
    gap: 2,
  },
  timeline: {
    borderRadius: 28,
    paddingTop: 18,
    paddingRight: spacing.base,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.xs,
  },
  source: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
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
  section: {
    gap: spacing.xs,
  },
  bookStack: {
    gap: spacing.sm,
  },
  fareTable: {
    borderRadius: 24,
    paddingHorizontal: spacing.base,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.base,
    bottom: spacing.xl,
  },
  fab: {
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    paddingLeft: spacing.base,
    paddingRight: spacing.lg,
  },
});
