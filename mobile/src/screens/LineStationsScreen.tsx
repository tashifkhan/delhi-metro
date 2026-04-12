import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Chip, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useStationsByLineQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { useAppTheme } from '../theme/ThemeContext';
import type { StationByLineItem } from '../types';
import type { LinesStackParamList } from '../navigation/types';
import { spacing } from '../theme';

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
  const theme = useTheme();
  const { semantic } = useAppTheme();

  return (
    <TouchableRipple onPress={onPress} rippleColor={theme.colors.surfaceVariant}>
      <View style={styles.row}>
        <View style={styles.timeline}>
          {!isFirst && <View style={[styles.lineTop, { backgroundColor: lineColor }]} />}
          <View
            style={[
              styles.dot,
              { borderColor: lineColor, backgroundColor: theme.colors.surface },
              station.interchange && {
                borderColor: semantic.interchange,
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 2,
              },
            ]}
          >
            {station.interchange && (
              <Ionicons name="git-compare" size={12} color={semantic.interchange} />
            )}
          </View>
          {!isLast && <View style={[styles.lineBottom, { backgroundColor: lineColor }]} />}
        </View>

        <View style={styles.stationInfo}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            {station.station_name}
          </Text>
          <View style={styles.meta}>
            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
              {station.station_code}
            </Text>
            {station.interchange && (
              <Chip
                compact
                mode="flat"
                style={{ backgroundColor: semantic.warningContainer, height: 22 }}
                textStyle={{ color: semantic.interchange, fontSize: 10, lineHeight: 12 }}
              >
                Interchange
              </Chip>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
      </View>
    </TouchableRipple>
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

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      style={{ backgroundColor: theme.colors.background }}
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.base,
    minHeight: 60,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationInfo: {
    flex: 1,
    paddingVertical: spacing.md,
    gap: 3,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
