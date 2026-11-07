import { useHaptics } from '../hooks/useHaptics';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNotificationsQuery } from '../hooks';
import { NotificationCard } from '../components/NotificationCard';
import { LineStatusCarousel } from '../components/LineStatusCarousel';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { spacing } from '../theme';
import { useMetroNetwork } from '../network';

export function NotificationsScreen() {
  const theme = useTheme();
  const haptics = useHaptics();
  const { network } = useMetroNetwork();
  const { data, isLoading, isError, isOfflineCopy, refetch, isRefetching } =
    useNotificationsQuery();

  if (isLoading) return <LoadingState message="Loading alerts..." />;
  if (isError && !data) return <ErrorState message="Could not load alerts" onRetry={refetch} />;

  const ListHeader = (
    <View>
      {isOfflineCopy ? (
        <OfflineNote
          inset
          message="Saved notices. Newer ones will not appear until you are back online."
        />
      ) : null}
      <LineStatusCarousel />
      <SectionHeader
        title={network === 'nmrc' ? 'NMRC Press Releases' : 'Passenger Notices'}
        icon="megaphone-outline"
        count={data?.length}
        inset
      />
    </View>
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={ListHeader}
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <NotificationCard notification={item} />
        </View>
      )}
      refreshing={isRefetching}
      onRefresh={() => { haptics.select(); void refetch(); }}
      ListEmptyComponent={
        <EmptyState
          title={network === 'nmrc' ? 'No Press Releases' : 'No Notices'}
          subtitle={
            network === 'nmrc'
              ? 'No NMRC press releases are available'
              : 'There are no active passenger notices'
          }
          icon="notifications-off-outline"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingBottom: spacing['3xl'],
  },
  cardWrapper: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
});
