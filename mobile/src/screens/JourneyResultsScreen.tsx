import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useJourneyPlanCachedQuery, useMetroLinesQuery, useStationSearchQuery } from '../hooks';
import { StrategyToggle } from '../components/StrategyToggle';
import { JourneyFareSummary } from '../components/JourneyFareSummary';
import { RouteSegmentView } from '../components/RouteSegmentView';
import { FirstLastTrainCard } from '../components/FirstLastTrainCard';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { StationPicker } from '../components/StationPicker';
import { Touchable } from '../components/Touchable';
import { Reveal } from '../components/Reveal';
import { Card } from '../components/Card';
import { useAppTheme } from '../theme/ThemeContext';
import type { RouteStrategy } from '../types';
import type { HomeStackParamList } from '../navigation/types';
import { spacing, radius, emphasis } from '../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'JourneyResults'>;
type Route = RouteProp<HomeStackParamList, 'JourneyResults'>;

const STRATEGIES: RouteStrategy[] = ['least-distance', 'minimum-interchange'];

function normalizeLineKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function JourneyResultsScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { fromCode, toCode, fromName, toName, journeyTime } = route.params;
  const theme = useTheme();
  const { semantic, fills, isDark } = useAppTheme();
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

  const { data: plan, isLoading, isError, refetch } = useJourneyPlanCachedQuery(
    fromCode,
    toCode,
    journeyTime,
  );
  const { data: lines } = useMetroLinesQuery();
  const { data: allStations } = useStationSearchQuery('');
  const swipeHint = useRef(new Animated.Value(0)).current;
  const strategyRef = useRef(strategy);
  strategyRef.current = strategy;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        const current = strategyRef.current;
        if (gs.dx < -50 && current !== 'minimum-interchange') {
          setStrategy('minimum-interchange');
          Animated.sequence([
            Animated.timing(swipeHint, { toValue: -8, duration: 120, useNativeDriver: true }),
            Animated.spring(swipeHint, { toValue: 0, useNativeDriver: true }),
          ]).start();
        } else if (gs.dx > 50 && current !== 'least-distance') {
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

  if (isLoading) return <LoadingState message="Planning your journey..." />;
  if (isError) return <ErrorState message="Could not plan this journey" onRetry={refetch} />;
  if (!plan) return <ErrorState message="No route data available" />;

  const fare =
    strategy === 'least-distance' ? plan.least_distance_fare : plan.minimum_interchange_fare;
  const trainTimes =
    strategy === 'least-distance' ? plan.least_distance_train : plan.minimum_interchange_train;
  const interchanges = Math.max(0, fare.route.length - 1);

  const heroIconColor = isDark ? theme.colors.primary : theme.colors.onPrimaryContainer;

  /**
   * The edit target and the details link are siblings rather than nested
   * touchables — a pressable inside a pressable swallows the inner ripple on
   * Android and makes the details button feel dead.
   */
  const renderEndpoint = (kind: 'from' | 'to', name: string, code: string) => {
    const isFrom = kind === 'from';
    const label = isFrom ? 'departure' : 'destination';

    return (
      <View style={styles.heroStationRow}>
        <View style={styles.heroStationMain}>
          <Touchable
            radius={radius.iconSmall}
            onPress={() => setEditing(kind)}
            accessibilityLabel={`Change ${label}, currently ${name}`}
          >
            <View style={styles.heroStationPress}>
              {/* Same vertical rail as the planner on Home, so a journey looks
                  like the same object before and after it is planned. */}
              <View style={styles.heroRail}>
                <View
                  style={[
                    styles.heroRailLine,
                    { backgroundColor: fills.onHeroText },
                    isFrom ? styles.heroRailFromCenter : styles.heroRailToCenter,
                  ]}
                />
                <View
                  style={[
                    styles.heroDot,
                    {
                      backgroundColor: isFrom ? semantic.success : theme.colors.error,
                      borderColor: fills.hero,
                    },
                  ]}
                />
              </View>
              <Text
                variant="titleLarge"
                style={[emphasis.heavy, styles.heroStationName, { color: fills.onHeroText }]}
                numberOfLines={2}
              >
                {name}
              </Text>
              <Ionicons
                name="pencil"
                size={13}
                color={fills.onHeroText}
                style={styles.heroEditIcon}
              />
            </View>
          </Touchable>
        </View>

        <Touchable
          radius={radius.pill}
          onPress={() =>
            navigation.navigate('StationDetail', { stationCode: code, stationName: name })
          }
          accessibilityLabel={`Station details for ${name}`}
          style={{ backgroundColor: fills.onHero }}
        >
          <View style={styles.heroInfoBtn}>
            <Ionicons name="information-circle-outline" size={18} color={heroIconColor} />
          </View>
        </Touchable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Journey hero */}
        <Reveal index={0} replayOnFocus={false}>
        <View style={[styles.heroCard, { backgroundColor: fills.hero }]}>
          <View>
            {renderEndpoint('from', fromName, fromCode)}

            <View style={styles.heroConnector}>
              <View style={styles.heroRail}>
                <View style={[styles.heroRailLine, { backgroundColor: fills.onHeroText }]} />
              </View>
              <View style={[styles.heroLine, { backgroundColor: fills.onHeroText }]} />
              <Touchable
                radius={radius.pill}
                onPress={handleSwapStations}
                accessibilityLabel="Reverse this journey"
                style={[styles.heroSwapBtn, { backgroundColor: fills.onHero }]}
              >
                <View style={styles.heroSwapInner}>
                  <Ionicons name="swap-vertical" size={18} color={heroIconColor} />
                </View>
              </Touchable>
            </View>

            {renderEndpoint('to', toName, toCode)}
          </View>

          {/* Journey stats */}
          <View style={styles.heroStats}>
            {[
              { key: 'stops', icon: 'git-commit-outline' as const, text: `${fare.stations} stops` },
              { key: 'time', icon: 'time-outline' as const, text: fare.total_time },
              {
                key: 'changes',
                icon: 'swap-horizontal-outline' as const,
                text: `${interchanges} ${interchanges === 1 ? 'change' : 'changes'}`,
              },
            ].map((stat) => (
              <View key={stat.key} style={[styles.heroStat, { backgroundColor: fills.onHero }]}>
                <Ionicons name={stat.icon} size={14} color={heroIconColor} />
                <Text
                  variant="labelMedium"
                  style={[emphasis.heavy, styles.heroStatText, { color: fills.onHeroText }]}
                  numberOfLines={1}
                >
                  {stat.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
        </Reveal>

        {/* Strategy toggle */}
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
                      strategy === s ? theme.colors.primary : theme.colors.outlineVariant,
                    width: strategy === s ? 20 : 6,
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>
        </Reveal>

        {/* Departure time */}
        <Reveal index={2} replayOnFocus={false}>
        <Card style={styles.timePill}>
          <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
          <Text
            variant="bodyMedium"
            style={[styles.timeLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Departure
          </Text>
          <View style={[styles.timeValue, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text
              variant="labelLarge"
              style={[emphasis.strong, { color: theme.colors.onPrimaryContainer }]}
            >
              {selectedTimeLabel}
            </Text>
          </View>
        </Card>
        </Reveal>

        <Reveal index={3} replayOnFocus={false}>
          <JourneyFareSummary fare={fare} />
        </Reveal>

        {/* Route visualization */}
        <Reveal index={4} replayOnFocus={false}>
        <Card radius={radius.hero} style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <View style={[styles.routeHeaderIcon, { backgroundColor: fills.accentSubtle }]}>
              <Ionicons name="navigate-outline" size={15} color={theme.colors.primary} />
            </View>
            <Text
              variant="titleSmall"
              style={[emphasis.heavy, styles.routeTitle, { color: theme.colors.onSurface }]}
            >
              Route
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {fare.route.length} {fare.route.length === 1 ? 'line' : 'lines'}
            </Text>
          </View>
          <View style={styles.routeSegments}>
            {fare.route.map((segment, index) => (
              <RouteSegmentView
                key={`${segment.line}-${index}`}
                segment={segment}
                lineColor={lineColorMap.get(normalizeLineKey(segment.line)) ?? theme.colors.primary}
                isLast={index === fare.route.length - 1}
                stationCodeMap={stationCodeMap}
                onStationPress={(code, name) =>
                  navigation.navigate('StationDetail', { stationCode: code, stationName: name })
                }
              />
            ))}
          </View>
        </Card>
        </Reveal>

        <Reveal index={5} replayOnFocus={false}>
          <FirstLastTrainCard data={trainTimes} />
        </Reveal>
      </ScrollView>

      <StationPicker
        visible={editing !== null}
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
  heroCard: {
    borderRadius: radius.hero,
    padding: spacing.base,
    gap: spacing.base,
  },
  heroStationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroStationMain: {
    flex: 1,
  },
  heroStationPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  heroRail: {
    width: 26,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRailLine: {
    position: 'absolute',
    width: 2,
    top: 0,
    bottom: 0,
    opacity: 0.25,
  },
  heroRailFromCenter: {
    top: '50%',
  },
  heroRailToCenter: {
    bottom: '50%',
  },
  heroDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  heroStationName: {
    flex: 1,
  },
  heroEditIcon: {
    opacity: 0.5,
  },
  heroInfoBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  heroLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.sm,
    opacity: 0.3,
  },
  heroSwapBtn: {
    marginLeft: spacing.md,
  },
  heroSwapInner: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heroStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.iconSmall,
  },
  heroStatText: {
    flexShrink: 1,
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
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.card,
    paddingLeft: spacing.base,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  timeLabel: {
    flex: 1,
  },
  timeValue: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
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
  routeHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.badge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeTitle: {
    flex: 1,
  },
  routeSegments: {
    gap: spacing.base,
  },
});
