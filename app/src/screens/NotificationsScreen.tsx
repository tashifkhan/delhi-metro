import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { useMetroLinesQuery, useNotificationsQuery } from '../hooks';
import { useHaptics } from '../hooks/useHaptics';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { NotificationCard, type NoticePosition } from '../components/NotificationCard';
import { SectionHeader } from '../components/SectionHeader';
import { Touchable } from '../components/Touchable';
import { Card } from '../components/Card';
import { useAppTheme } from '../theme/ThemeContext';
import { NETWORK_NAMES } from '../network';
import type { MetroLine, MetroNetwork, PassengerNotification } from '../types';
import type { RootTabParamList } from '../navigation/types';
import { spacing, radius, emphasis } from '../theme';

type Filter = 'all' | MetroNetwork;

/** Operators whose notices this screen reads, in display order. */
const OPERATORS: MetroNetwork[] = ['dmrc', 'nmrc'];

/** Helplines that work whatever the app knows. */
const HELPLINES: { name: string; number: string }[] = [{ name: 'Delhi Metro helpline', number: '155370' }];

function positionOf(index: number, count: number): NoticePosition {
  if (count === 1) return 'single';
  if (index === 0) return 'first';
  if (index === count - 1) return 'last';
  return 'middle';
}

function isNormal(line: MetroLine): boolean {
  return line.status.trim().toLowerCase() === 'normal service';
}

function ago(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * Alerts for every operator at once.
 *
 * The rule here is that this tab never turns into an error screen. Each
 * operator loads on its own; whatever arrived, or whatever was saved last
 * time, is shown with its age, and an operator that couldn't be reached gets
 * one line saying so. Line problems come first because they change a trip;
 * notices follow, newest first.
 */
export function NotificationsScreen() {
  const theme = useTheme();
  const haptics = useHaptics();
  const isDesktop = useIsDesktop();
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();
  const { semantic, look } = useAppTheme();
  const [filter, setFilter] = useState<Filter>('all');

  const dmrc = useNotificationsQuery('dmrc');
  const nmrc = useNotificationsQuery('nmrc');
  const lines = useMetroLinesQuery();
  const queries: Record<MetroNetwork, typeof dmrc> = { dmrc, nmrc } as Record<MetroNetwork, typeof dmrc>;

  const shown = filter === 'all' ? OPERATORS : [filter];

  const notices = useMemo(() => {
    const all: { network: MetroNetwork; notice: PassengerNotification }[] = [];
    for (const network of shown) {
      for (const notice of queries[network]?.data ?? []) all.push({ network, notice });
    }
    return all.sort((a, b) => (Date.parse(b.notice.date) || 0) - (Date.parse(a.notice.date) || 0));
    // The query objects change identity every render; their data is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, dmrc.data, nmrc.data]);

  const disrupted = (lines.data ?? []).filter(
    (line) =>
      line.show_in_frontend !== false && !isNormal(line) && shown.includes(line.network ?? 'dmrc'),
  );

  const loading = shown.some((n) => queries[n]?.isLoading);
  const unreachable = shown.filter((n) => queries[n]?.isError && !queries[n]?.data);
  const offlineCopies = shown.filter((n) => queries[n]?.isOfflineCopy);
  const oldest = Math.min(
    ...shown.map((n) => queries[n]?.dataUpdatedAt || Number.POSITIVE_INFINITY),
  );
  const nothingAtAll = !loading && notices.length === 0 && unreachable.length === shown.length;

  const refresh = () => {
    haptics.select();
    for (const n of OPERATORS) void queries[n]?.refetch();
    void lines.refetch();
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
    >
      <View style={styles.chips} accessibilityRole="radiogroup">
        {(['all', ...OPERATORS] as Filter[]).map((option) => {
          const active = filter === option;
          return (
            <Touchable
              key={option}
              radius={radius.pill}
              haptic="select"
              onPress={() => setFilter(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: theme.colors.secondaryContainer, borderColor: theme.colors.secondaryContainer }
                  : { borderColor: theme.colors.outlineVariant },
              ]}
            >
              <View style={styles.chipInner}>
                <Text
                  variant="labelLarge"
                  style={{ color: active ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant }}
                >
                  {option === 'all' ? 'All' : NETWORK_NAMES[option]}
                </Text>
              </View>
            </Touchable>
          );
        })}
      </View>

      {offlineCopies.length > 0 && Number.isFinite(oldest) ? (
        <View style={[styles.note, { backgroundColor: theme.colors.surfaceVariant, borderRadius: look.radius.card }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodyMedium" style={[styles.noteText, { color: theme.colors.onSurfaceVariant }]}>
            You're offline. These alerts were saved {ago(oldest)}. Newer ones load when you're back online.
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Disruptions" count={disrupted.length || undefined} />
        {disrupted.length === 0 ? (
          <Text variant="bodyMedium" style={[styles.quiet, { color: theme.colors.onSurfaceVariant }]}>
            {lines.data
              ? 'Every line is running normally.'
              : lines.isLoading
                ? 'Checking line status…'
                : 'Line status is unavailable right now.'}
          </Text>
        ) : (
          <Card>
            {disrupted.map((line, index) => (
              <Touchable
                key={`${line.network ?? 'dmrc'}-${line.id}`}
                radius={0}
                onPress={() =>
                  navigation.navigate('NetworkTab', {
                    screen: 'LineStations',
                    params: { lineCode: line.line_code, lineName: line.name, lineColor: line.primary_color_code },
                  })
                }
                accessibilityLabel={`${line.name}: ${line.status}`}
              >
                <View style={[styles.lineRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outlineVariant }]}>
                  <View style={[styles.lineSwatch, { backgroundColor: line.primary_color_code }]} />
                  <View style={styles.lineText}>
                    <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                      {line.name}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: semantic.warning }}>
                      {line.status}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.onSurfaceVariant} />
                </View>
              </Touchable>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Notices" count={notices.length || undefined} />
        {loading && notices.length === 0 ? (
          <Text variant="bodyMedium" style={[styles.quiet, { color: theme.colors.onSurfaceVariant }]}>
            Loading notices…
          </Text>
        ) : null}
        {notices.length > 0 ? (
          <View style={styles.notices}>
            {notices.map(({ network, notice }, index) => (
              <View key={`${network}-${notice.id}`}>
                {filter === 'all' ? (
                  <Text variant="labelSmall" style={[styles.operator, look.meta, { color: theme.colors.onSurfaceVariant }]}>
                    {NETWORK_NAMES[network]}
                  </Text>
                ) : null}
                <NotificationCard notification={notice} position={positionOf(index, notices.length)} />
              </View>
            ))}
          </View>
        ) : !loading && !nothingAtAll ? (
          <Text variant="bodyMedium" style={[styles.quiet, { color: theme.colors.onSurfaceVariant }]}>
            No notices right now.
          </Text>
        ) : null}

        {unreachable.length > 0 && !nothingAtAll ? (
          <Text variant="bodySmall" style={[styles.quiet, { color: theme.colors.onSurfaceVariant }]}>
            Couldn't reach {unreachable.map((n) => NETWORK_NAMES[n]).join(' or ')}. Pull down to try again.
          </Text>
        ) : null}
      </View>

      {nothingAtAll ? (
        <Card>
          <View style={styles.offline}>
            <Ionicons name="cloud-offline-outline" size={28} color={theme.colors.onSurfaceVariant} />
            <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
              No alerts saved on this phone yet
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Alerts come from the operators, so the first copy needs a connection. Pull down to try again once
              you're online. Stations, lines and the routes you've planned still work offline.
            </Text>
            {HELPLINES.map((h) => (
              <Text key={h.number} variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                {h.name}: <Text style={[emphasis.strong, look.figures]}>{h.number}</Text>
              </Text>
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  contentDesktop: {
    padding: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
  },
  chipInner: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
  },
  noteText: {
    flex: 1,
  },
  section: {
    gap: spacing.xs,
  },
  quiet: {
    paddingHorizontal: spacing.xs,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  lineSwatch: {
    width: 6,
    alignSelf: 'stretch',
    borderRadius: 3,
  },
  lineText: {
    flex: 1,
    gap: 2,
  },
  notices: {
    gap: 3,
  },
  operator: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  offline: {
    padding: spacing.base,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
});
