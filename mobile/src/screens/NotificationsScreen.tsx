import { FlatList, StyleSheet, View } from 'react-native';
import { useNotificationsQuery } from '../hooks';
import { NotificationCard } from '../components/NotificationCard';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { spacing } from '../theme';

export function NotificationsScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useNotificationsQuery();

  if (isLoading) return <LoadingState message="Loading notifications..." />;
  if (isError) return <ErrorState message="Could not load notifications" onRetry={refetch} />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <NotificationCard notification={item} />}
      refreshing={isRefetching}
      onRefresh={refetch}
      ListEmptyComponent={
        <EmptyState
          title="No Notifications"
          subtitle="There are no active passenger notices"
          icon="notifications-off-outline"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.base,
    gap: spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
});
