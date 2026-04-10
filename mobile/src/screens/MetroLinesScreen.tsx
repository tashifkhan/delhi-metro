import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useMetroLinesQuery } from '../hooks';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import type { MetroLine } from '../types';
import type { LinesStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type Nav = NativeStackNavigationProp<LinesStackParamList, 'MetroLines'>;

function LineRow({ line }: { line: MetroLine }) {
  const navigation = useNavigation<Nav>();

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() =>
        navigation.navigate('LineStations', {
          lineCode: line.line_code,
          lineName: line.name,
          lineColor: line.primary_color_code,
        })
      }
    >
      <View style={[styles.colorStrip, { backgroundColor: line.primary_color_code }]} />
      <View style={styles.rowContent}>
        <Text style={styles.lineName} numberOfLines={1}>{line.name}</Text>
        <Text style={styles.lineRange} numberOfLines={1}>
          {line.start_station} — {line.end_station}
        </Text>
      </View>
      <View style={[styles.codeBadge, { backgroundColor: line.primary_color_code + '18' }]}>
        <Text style={[styles.codeText, { color: line.primary_color_code }]}>{line.line_code}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

export function MetroLinesScreen() {
  const { data, isLoading, isError, refetch } = useMetroLinesQuery();

  if (isLoading) return <LoadingState message="Loading metro lines..." />;
  if (isError) return <ErrorState message="Could not load metro lines" onRetry={refetch} />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <LineRow line={item} />}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    backgroundColor: colors.surface,
    paddingRight: spacing.base,
    gap: spacing.md,
    minHeight: 68,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  colorStrip: {
    width: 5,
    alignSelf: 'stretch',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  rowContent: {
    flex: 1,
    paddingVertical: spacing.md,
    gap: 3,
  },
  lineName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  lineRange: {
    fontSize: typography.sizes.sm,
    color: colors.textTertiary,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.base,
  },
});
