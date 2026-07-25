import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useMetroLinesQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { Touchable } from '../components/Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import type { MetroLine } from '../types';
import type { LinesStackParamList } from '../navigation/types';
import { spacing, radius, emphasis, onColor } from '../theme';

type Nav = NativeStackNavigationProp<LinesStackParamList, 'MetroLines'>;

const NORMAL_STATUS = 'normal service';

function LineCard({ line }: { line: MetroLine }) {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { semantic, isDark } = useAppTheme();

  const disrupted = line.status.trim().toLowerCase() !== NORMAL_STATUS;
  const statusFg = disrupted ? semantic.onWarningContainer : semantic.onSuccessContainer;
  const statusBg = disrupted ? semantic.warningContainer : semantic.successContainer;

  return (
    <View style={styles.cardWrapper}>
      <Surface style={styles.card} elevation={isDark ? 2 : 1}>
        <Touchable
          radius={radius.card}
          onPress={() =>
            navigation.navigate('LineStations', {
              lineCode: line.line_code,
              lineName: line.name,
              lineColor: line.primary_color_code,
            })
          }
          accessibilityLabel={`${line.name}, ${line.start_station} to ${line.end_station}, ${
            disrupted ? line.status : 'normal service'
          }`}
        >
          <View style={styles.cardRow}>
            <View style={[styles.colorStrip, { backgroundColor: line.primary_color_code }]} />

            <View style={styles.cardContent}>
              <View style={styles.titleRow}>
                <Text
                  variant="titleSmall"
                  style={[emphasis.heavy, styles.lineName, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  {line.name}
                </Text>
                <View
                  style={[styles.codeBadge, { backgroundColor: line.primary_color_code }]}
                >
                  <Text
                    style={[styles.codeText, { color: onColor(line.primary_color_code) }]}
                  >
                    {line.line_code}
                  </Text>
                </View>
              </View>

              <View style={styles.terminiRow}>
                <Ionicons
                  name="git-commit-outline"
                  size={13}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodySmall"
                  style={[styles.termini, { color: theme.colors.onSurfaceVariant }]}
                  numberOfLines={1}
                >
                  {line.start_station} — {line.end_station}
                </Text>
              </View>

              <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                <Ionicons
                  name={disrupted ? 'warning' : 'checkmark-circle'}
                  size={11}
                  color={statusFg}
                />
                <Text
                  variant="labelSmall"
                  style={[emphasis.strong, styles.statusText, { color: statusFg }]}
                  numberOfLines={1}
                >
                  {disrupted ? line.status : 'Normal Service'}
                </Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={theme.colors.outline} />
          </View>
        </Touchable>
      </Surface>
    </View>
  );
}

export function MetroLinesScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useMetroLinesQuery();
  const theme = useTheme();

  if (isLoading) return <LoadingState message="Loading metro lines..." />;
  if (isError) return <ErrorState message="Could not load metro lines" onRetry={refetch} />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      style={{ backgroundColor: theme.colors.background }}
      renderItem={({ item }) => <LineCard line={item} />}
      contentContainerStyle={styles.list}
      refreshing={isRefetching}
      onRefresh={refetch}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xl,
  },
  cardWrapper: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
    gap: spacing.md,
  },
  colorStrip: {
    width: 6,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineName: {
    flex: 1,
  },
  codeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  codeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  terminiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  termini: {
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
  },
});
