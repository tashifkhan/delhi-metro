import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useJourneyPlanCachedQuery, useMetroLinesQuery } from '../hooks';
import { StrategyToggle } from '../components/StrategyToggle';
import { JourneyFareSummary } from '../components/JourneyFareSummary';
import { RouteSegmentView } from '../components/RouteSegmentView';
import { FirstLastTrainCard } from '../components/FirstLastTrainCard';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import type { RouteStrategy } from '../types';
import type { HomeStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type Route = RouteProp<HomeStackParamList, 'JourneyResults'>;

export function JourneyResultsScreen() {
  const route = useRoute<Route>();
  const { fromCode, toCode, fromName, toName } = route.params;
  const [strategy, setStrategy] = useState<RouteStrategy>('least-distance');

  const { data: plan, isLoading, isError, refetch } = useJourneyPlanCachedQuery(fromCode, toCode);
  const { data: lines } = useMetroLinesQuery();

  const lineColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (lines) {
      for (const line of lines) {
        map.set(line.name, line.primary_color_code);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Journey header */}
      <View style={styles.journeyHeader}>
        <View style={styles.stationBubble}>
          <Ionicons name="radio-button-on" size={14} color={colors.success} />
          <Text style={styles.stationLabel} numberOfLines={1}>{fromName}</Text>
        </View>
        <Ionicons name="arrow-down" size={16} color={colors.textTertiary} />
        <View style={styles.stationBubble}>
          <Ionicons name="location" size={14} color={colors.error} />
          <Text style={styles.stationLabel} numberOfLines={1}>{toName}</Text>
        </View>
      </View>

      {/* Strategy toggle */}
      <StrategyToggle active={strategy} onChange={setStrategy} />

      {/* Fare summary */}
      <JourneyFareSummary fare={fare} />

      {/* Route visualization */}
      <View style={styles.routeCard}>
        <Text style={styles.routeHeading}>Route</Text>
        <View style={styles.routeSegments}>
          {fare.route.map((segment, index) => (
            <RouteSegmentView
              key={`${segment.line}-${index}`}
              segment={segment}
              lineColor={lineColorMap.get(segment.line) ?? colors.primary}
              isLast={index === fare.route.length - 1}
            />
          ))}
        </View>
      </View>

      {/* First/Last train */}
      <FirstLastTrainCard data={trainTimes} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.base,
    gap: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  journeyHeader: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  stationBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '80%',
  },
  stationLabel: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  routeHeading: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  routeSegments: {
    gap: spacing.sm,
  },
});
