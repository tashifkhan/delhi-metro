import { useHaptics } from '../hooks/useHaptics';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNotificationsQuery } from '../hooks';
import { NotificationCard, type NoticePosition } from '../components/NotificationCard';
import { LineStatusCarousel } from '../components/LineStatusCarousel';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { spacing } from '../theme';
import { useMetroNetwork } from '../network';

function positionOf(index: number, count: number): NoticePosition {
  if (count === 1) return 'single';
  if (index === 0) return 'first';
  if (index === count - 1) return 'last';
  return 'middle';
}

/**
 * Alerts: the selected network's line status, then its notices as one
 * segmented list. The network switch lives in the app bar.
 */
export function NotificationsScreen() {
  const theme = useTheme();
  const haptics = useHaptics();
  const isDesktop = useIsDesktop();
  const { network } = useMetroNetwork();
  const { data, isLoading, isError, isOfflineCopy, refetch, isRefetching } =
    useNotificationsQuery();

  if (isLoading) {
    return (
      <LoadingState
        message="Loading alerts"
        subtitle={network === 'nmrc' ? 'Noida Metro press releases' : 'Delhi Metro notices and line status'}
      />
    );
  }
  if (isError && !data) return <ErrorState message="Couldn't load alerts" onRetry={refetch} />;

  const count = data?.length ?? 0;
  const noticesTitle = network === 'nmrc' ? 'Press releases' : 'Passenger notices';

  const ListHeader = (
    <View style={styles.header}>
      {isOfflineCopy ? (
        <OfflineNote message="Saved notices. Newer ones will appear when you're back online." />
      ) : null}
      <LineStatusCarousel />
      {count > 0 ? <SectionHeader title={noticesTitle} count={count} /> : null}
    </View>
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
      ListHeaderComponent={ListHeader}
      ItemSeparatorComponent={Separator}
      renderItem={({ item, index }) => (
        <NotificationCard notification={item} position={positionOf(index, count)} />
      )}
      refreshing={isRefetching}
      onRefresh={() => {
        haptics.select();
        void refetch();
      }}
      ListEmptyComponent={
        <EmptyState
          title={network === 'nmrc' ? 'No press releases' : 'No notices right now'}
          subtitle={
            network === 'nmrc'
              ? 'Noida Metro has no press releases to show.'
              : 'Delhi Metro has no active passenger notices.'
          }
          icon="notifications-off-outline"
        />
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  listDesktop: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  separator: {
    height: 3,
  },
});
