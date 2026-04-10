import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useStationsByLineQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import type { StationByLineItem } from '../types';
import type { LinesStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<LinesStackParamList, 'LineStations'>;
type Route = RouteProp<LinesStackParamList, 'LineStations'>;

function StationTimelineRow({
  station,
  lineColor,
  isFirst,
  isLast,
  onPress,
}: {
  station: StationByLineItem;
  lineColor: string;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.timeline}>
        {!isFirst && <View style={[styles.lineTop, { backgroundColor: lineColor }]} />}
        <View
          style={[
            styles.dot,
            station.interchange ? styles.dotInterchange : { borderColor: lineColor },
          ]}
        >
          {station.interchange && (
            <Ionicons name="git-compare" size={12} color={colors.interchange} />
          )}
        </View>
        {!isLast && <View style={[styles.lineBottom, { backgroundColor: lineColor }]} />}
      </View>

      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{station.station_name}</Text>
        <View style={styles.meta}>
          <Text style={styles.stationCode}>{station.station_code}</Text>
          {station.interchange && (
            <View style={styles.interchangeBadge}>
              <Text style={styles.interchangeText}>Interchange</Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

export function LineStationsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { lineCode, lineColor } = route.params;
  const { data, isLoading, isError, refetch } = useStationsByLineQuery(lineCode);

  if (isLoading) return <LoadingState message="Loading stations..." />;
  if (isError) return <ErrorState message="Could not load stations" onRetry={refetch} />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => (
        <StationTimelineRow
          station={item}
          lineColor={lineColor}
          isFirst={index === 0}
          isLast={index === (data?.length ?? 0) - 1}
          onPress={() =>
            navigation.navigate('StationDetail', {
              stationCode: item.station_code,
              stationName: item.station_name,
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.base,
    minHeight: 60,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  timeline: {
    width: 48,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  lineTop: {
    width: 3,
    flex: 1,
  },
  lineBottom: {
    width: 3,
    flex: 1,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotInterchange: {
    borderColor: colors.interchange,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  stationInfo: {
    flex: 1,
    paddingVertical: spacing.md,
    gap: 3,
  },
  stationName: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stationCode: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  interchangeBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  interchangeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
  },
});
