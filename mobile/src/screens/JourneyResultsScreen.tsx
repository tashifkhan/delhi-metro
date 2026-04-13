import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useJourneyPlanCachedQuery, useMetroLinesQuery, useStationSearchQuery } from '../hooks';
import { StrategyToggle } from '../components/StrategyToggle';
import { JourneyFareSummary } from '../components/JourneyFareSummary';
import { RouteSegmentView } from '../components/RouteSegmentView';
import { FirstLastTrainCard } from '../components/FirstLastTrainCard';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { useAppTheme } from '../theme/ThemeContext';
import type { RouteStrategy } from '../types';
import type { HomeStackParamList } from '../navigation/types';
type Nav = NativeStackNavigationProp<HomeStackParamList, 'JourneyResults'>;
import { spacing } from '../theme';

type Route = RouteProp<HomeStackParamList, 'JourneyResults'>;

function normalizeLineKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function JourneyResultsScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { fromCode, toCode, fromName, toName, journeyTime } = route.params;
  const theme = useTheme();
  const { semantic, isDark } = useAppTheme();
  const [strategy, setStrategy] = useState<RouteStrategy>('least-distance');

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

  const strategies: RouteStrategy[] = ['least-distance', 'minimum-interchange'];

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
    if (allStations) {
      for (const s of allStations) {
        map.set(s.station_name.trim().toLowerCase(), s.station_code);
      }
    }
    return map;
  }, [allStations]);

  const lineColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (lines) {
      for (const line of lines) {
        map.set(normalizeLineKey(line.name), line.primary_color_code);
        map.set(normalizeLineKey(line.line_color), line.primary_color_code);
        map.set(normalizeLineKey(line.line_code), line.primary_color_code);
      }
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

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Journey header — big hero card */}
      <Surface
        style={[
          styles.heroCard,
          { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.primaryContainer },
        ]}
        elevation={0}
      >
        <View style={styles.heroStations}>
          <View style={styles.heroStationRow}>
            <View style={[styles.heroDot, { backgroundColor: semantic.success }]} />
            <Text
              variant="titleMedium"
              style={{ flex: 1, color: isDark ? theme.colors.onSurface : theme.colors.onPrimaryContainer, fontWeight: '700' }}
              numberOfLines={1}
            >
              {fromName}
            </Text>
            <Pressable
              onPress={() => navigation.navigate('StationDetail', { stationCode: fromCode, stationName: fromName })}
              hitSlop={8}
              style={[styles.heroInfoBtn, { backgroundColor: isDark ? theme.colors.elevation.level5 : 'rgba(255,255,255,0.5)' }]}
            >
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
            </Pressable>
          </View>

          <View style={styles.heroConnector}>
            <View style={[styles.heroLine, { backgroundColor: isDark ? theme.colors.outlineVariant : theme.colors.primary, opacity: 0.3 }]} />
            <View style={[styles.heroArrowCircle, { backgroundColor: isDark ? theme.colors.elevation.level5 : theme.colors.surface }]}>
              <Ionicons name="arrow-down" size={18} color={theme.colors.primary} />
            </View>
            <View style={[styles.heroLine, { backgroundColor: isDark ? theme.colors.outlineVariant : theme.colors.primary, opacity: 0.3 }]} />
          </View>

          <View style={styles.heroStationRow}>
            <View style={[styles.heroDot, { backgroundColor: theme.colors.error }]} />
            <Text
              variant="titleMedium"
              style={{ flex: 1, color: isDark ? theme.colors.onSurface : theme.colors.onPrimaryContainer, fontWeight: '700' }}
              numberOfLines={1}
            >
              {toName}
            </Text>
            <Pressable
              onPress={() => navigation.navigate('StationDetail', { stationCode: toCode, stationName: toName })}
              hitSlop={8}
              style={[styles.heroInfoBtn, { backgroundColor: isDark ? theme.colors.elevation.level5 : 'rgba(255,255,255,0.5)' }]}
            >
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Inline stats row */}
        <View style={styles.heroStats}>
          <View style={[styles.heroStat, { backgroundColor: isDark ? theme.colors.elevation.level5 : 'rgba(255,255,255,0.7)' }]}>
            <Ionicons name="git-commit-outline" size={16} color={theme.colors.primary} />
            <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {fare.stations} stops
            </Text>
          </View>
          <View style={[styles.heroStat, { backgroundColor: isDark ? theme.colors.elevation.level5 : 'rgba(255,255,255,0.7)' }]}>
            <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
            <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {fare.total_time}
            </Text>
          </View>
        </View>
      </Surface>

      {/* Strategy toggle */}
      <Animated.View style={{ transform: [{ translateX: swipeHint }] }}>
        <StrategyToggle active={strategy} onChange={setStrategy} />
        <View style={styles.swipeDots}>
          {strategies.map((s) => (
            <View
              key={s}
              style={[
                styles.swipeDot,
                {
                  backgroundColor: strategy === s ? theme.colors.primary : theme.colors.outlineVariant,
                  width: strategy === s ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Departure time */}
      <Surface style={styles.timePill} elevation={1}>
        <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
          Departure
        </Text>
        <View style={[styles.timeValue, { backgroundColor: theme.colors.primaryContainer }]}>
          <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600' }}>
            {selectedTimeLabel}
          </Text>
        </View>
      </Surface>

      {/* Fare cards */}
      <JourneyFareSummary fare={fare} />

      {/* Route visualization */}
      <Surface style={styles.routeCard} elevation={1}>
        <View style={styles.routeHeader}>
          <Ionicons name="navigate-outline" size={18} color={theme.colors.primary} />
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
            Route
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.outline, marginLeft: 'auto' }}>
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
      </Surface>

      {/* First/Last train */}
      <FirstLastTrainCard data={trainTimes} />
    </ScrollView>
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
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.base,
  },
  heroStations: {
    gap: 0,
  },
  heroStationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  heroInfoBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
    gap: 0,
    paddingVertical: 2,
  },
  heroLine: {
    flex: 1,
    height: 2,
  },
  heroArrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    borderRadius: 14,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
  },
  timeValue: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  routeCard: {
    borderRadius: 24,
    padding: spacing.base,
    gap: spacing.md,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeSegments: {
    gap: spacing.sm,
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
});
