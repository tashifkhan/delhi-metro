import { useHaptics } from '../hooks/useHaptics';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { useMetroLinesQuery } from '../hooks';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { Touchable } from '../components/Touchable';
import { SectionHeader } from '../components/SectionHeader';
import { OperatorMark } from '../components/OperatorMark';
import { LineGlyph, lineGlyph, lineSubtitle, lineTitle, terminalName } from '../components/LineGlyph';
import { useAppTheme } from '../theme/ThemeContext';
import { NETWORK_NAMES } from '../network';
import type { MetroLine, MetroNetwork } from '../types';
import type { LinesStackParamList } from '../navigation/types';
import { spacing, shape, emphasis } from '../theme';

type Nav = NativeStackNavigationProp<LinesStackParamList, 'MetroLines'>;

const NORMAL_STATUS = 'normal service';
const NETWORK_ORDER: MetroNetwork[] = ['dmrc', 'nmrc'];

function LineRow({ line, first, last }: { line: MetroLine; first: boolean; last: boolean }) {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { semantic, fills } = useAppTheme();

  const disrupted = line.status.trim().toLowerCase() !== NORMAL_STATUS;
  const title = lineTitle(line);
  const subtitle = lineSubtitle(line);
  const from = terminalName(line.start_station);
  const to = terminalName(line.end_station);

  return (
    <Touchable
      radius={shape.sm}
      onPress={() =>
        navigation.navigate('LineStations', {
          lineCode: line.line_code,
          lineName: line.name,
          lineColor: line.primary_color_code,
        })
      }
      accessibilityLabel={`${title}, ${from} to ${to}, ${disrupted ? line.status : 'running normally'}`}
      style={[
        styles.row,
        { backgroundColor: fills.containerLow },
        first && styles.rowFirst,
        last && styles.rowLast,
      ]}
    >
      <View style={styles.rowInner}>
        <LineGlyph color={line.primary_color_code} glyph={lineGlyph(line)} />
        <View style={styles.rowText}>
          <View style={styles.titleLine}>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              style={[emphasis.strong, styles.title, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Text
            variant="bodySmall"
            numberOfLines={2}
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {from} to {to}
          </Text>
          <View
            style={[
              styles.status,
              disrupted && { backgroundColor: semantic.warningContainer, paddingHorizontal: spacing.sm },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: disrupted ? semantic.warning : semantic.success },
              ]}
            />
            <Text
              variant="labelMedium"
              numberOfLines={1}
              style={{ color: disrupted ? semantic.onWarningContainer : theme.colors.onSurfaceVariant }}
            >
              {disrupted ? line.status : 'Running normally'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceVariant} />
      </View>
    </Touchable>
  );
}

export function MetroLinesScreen() {
  const haptics = useHaptics();
  const { data, isLoading, isError, isOfflineCopy, refetch, isRefetching } =
    useMetroLinesQuery();
  const theme = useTheme();
  const isDesktop = useIsDesktop();

  // Group by operator, keeping the API's order inside each group.
  const groups = useMemo(() => {
    const lines = (data ?? []).filter((line) => line.show_in_frontend !== false);
    return NETWORK_ORDER.map((network) => ({
      network,
      lines: lines.filter((line) => (line.network ?? 'dmrc') === network),
    })).filter((group) => group.lines.length > 0);
  }, [data]);

  if (isLoading) return <LoadingState message="Loading metro lines..." />;
  if (isError && !data) {
    return <ErrorState message="Could not load metro lines" onRetry={refetch} />;
  }

  const total = groups.reduce((sum, group) => sum + group.lines.length, 0);
  const disrupted = (data ?? []).filter(
    (line) => line.status.trim().toLowerCase() !== NORMAL_STATUS,
  ).length;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            haptics.select();
            void refetch();
          }}
        />
      }
    >
      {isOfflineCopy ? (
        <OfflineNote message="Saved lines. Service status may be out of date." />
      ) : null}

      <View style={styles.head}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {total} lines,{' '}
          {disrupted === 0
            ? 'all running normally'
            : `${disrupted} with ${disrupted === 1 ? 'a disruption' : 'disruptions'}`}
        </Text>
      </View>

      {groups.map((group) => (
        <View key={group.network} style={styles.section}>
          {groups.length > 1 ? (
            <View style={styles.groupHead}>
              <OperatorMark network={group.network} size={20} />
              <View style={styles.groupTitle}>
                <SectionHeader title={NETWORK_NAMES[group.network]} count={group.lines.length} />
              </View>
            </View>
          ) : null}
          <View style={[styles.list, isDesktop && styles.listDesktop]}>
            {group.lines.map((line, index) => (
              <View key={`${group.network}-${line.id}`} style={isDesktop ? styles.gridCell : undefined}>
                <LineRow
                  line={line}
                  first={isDesktop || index === 0}
                  last={isDesktop || index === group.lines.length - 1}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  contentDesktop: {
    padding: spacing.xl,
  },
  head: {
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  section: {
    gap: spacing.xs,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  groupTitle: {
    flex: 1,
  },
  list: {
    gap: 3,
  },
  listDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCell: {
    width: '49%',
  },
  row: {
    borderRadius: shape.sm,
  },
  rowFirst: {
    borderTopLeftRadius: shape.xl,
    borderTopRightRadius: shape.xl,
  },
  rowLast: {
    borderBottomLeftRadius: shape.xl,
    borderBottomRightRadius: shape.xl,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingLeft: spacing.base,
    paddingRight: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 3,
    height: 24,
    borderRadius: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
