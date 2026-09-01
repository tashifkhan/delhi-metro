import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useStationsByLineQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { Touchable } from '../components/Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import type { StationByLineItem } from '../types';
import type { LinesStackParamList } from '../navigation/types';
import { spacing, radius, shape, emphasis, tabular } from '../theme';

type Nav = NativeStackNavigationProp<LinesStackParamList, 'LineStations'>;
type Route = RouteProp<LinesStackParamList, 'LineStations'>;

const RAIL_WIDTH = 52;
const RAIL_THICKNESS = 4;

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
  const theme = useTheme();
  const { semantic, fills } = useAppTheme();
  const isTerminus = isFirst || isLast;

  return (
    <Touchable
      radius={shape.md}
      onPress={onPress}
      accessibilityLabel={`${station.station_name}, code ${station.station_code}${
        station.interchange ? ', interchange station' : ''
      }`}
    >
      <View style={styles.row}>
        <View style={styles.rail}>
          {/* Rail segments stop at the dot on the first and last rows. */}
          <View
            style={[
              styles.railLine,
              { backgroundColor: lineColor },
              isFirst && styles.railLineFromCenter,
              isLast && styles.railLineToCenter,
            ]}
          />
          <View
            style={[
              styles.dot,
              { borderColor: lineColor, backgroundColor: theme.colors.background },
              isTerminus && { backgroundColor: lineColor, borderWidth: 0 },
              station.interchange && [
                styles.dotInterchange,
                {
                  borderColor: semantic.interchange,
                  backgroundColor: theme.colors.background,
                  borderWidth: 2.5,
                },
              ],
            ]}
          >
            {station.interchange && (
              <Ionicons name="git-compare" size={12} color={semantic.interchange} />
            )}
          </View>
        </View>

        <View style={styles.stationInfo}>
          <Text
            variant="bodyLarge"
            style={[
              isTerminus ? emphasis.strong : undefined,
              { color: theme.colors.onSurface },
            ]}
            numberOfLines={1}
          >
            {station.station_name}
          </Text>
          <View style={styles.meta}>
            <View style={[styles.codeBadge, { backgroundColor: fills.subtle }]}>
              <Text
                variant="labelSmall"
                style={[emphasis.strong, tabular, { color: theme.colors.onSurfaceVariant }]}
              >
                {station.station_code}
              </Text>
            </View>
            {station.interchange && (
              <View
                style={[
                  styles.interchangeTag,
                  { backgroundColor: semantic.interchangeContainer },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={[
                    emphasis.strong,
                    styles.interchangeText,
                    { color: semantic.onInterchangeContainer },
                  ]}
                >
                  Interchange
                </Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
      </View>
    </Touchable>
  );
}

export function LineStationsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const theme = useTheme();
  const { lineCode, lineColor } = route.params;
  const { data, isLoading, isError, refetch } = useStationsByLineQuery(lineCode);

  if (isLoading) return <LoadingState message="Loading stations..." />;
  if (isError) return <ErrorState message="Could not load stations" onRetry={refetch} />;

  const total = data?.length ?? 0;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        total > 0 ? (
          <Text
            variant="labelMedium"
            style={[styles.count, { color: theme.colors.onSurfaceVariant }]}
          >
            {total} stations
          </Text>
        ) : null
      }
      renderItem={({ item, index }) => (
        <StationTimelineRow
          station={item}
          lineColor={lineColor}
          isFirst={index === 0}
          isLast={index === total - 1}
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
    paddingBottom: spacing.xl,
  },
  count: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.base,
    minHeight: 64,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  railLine: {
    position: 'absolute',
    width: RAIL_THICKNESS,
    top: 0,
    bottom: 0,
  },
  railLineFromCenter: {
    top: '50%',
  },
  railLineToCenter: {
    bottom: '50%',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotInterchange: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  stationInfo: {
    flex: 1,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  interchangeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  interchangeText: {
    fontSize: 10,
  },
});
