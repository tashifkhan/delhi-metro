import { FlatList, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNotificationsQuery } from '../hooks';
import { NotificationCard } from '../components/NotificationCard';
import { LineStatusCarousel } from '../components/LineStatusCarousel';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { spacing } from '../theme';

export function NotificationsScreen() {
  const theme = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useNotificationsQuery();

  if (isLoading) return <LoadingState message="Loading alerts..." />;
  if (isError) return <ErrorState message="Could not load alerts" onRetry={refetch} />;

  const ListHeader = (
    <View>
      <LineStatusCarousel />
      <SectionHeader
        title="Passenger Notices"
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
      onRefresh={refetch}
      ListEmptyComponent={
        <EmptyState
          title="No Notices"
          subtitle="There are no active passenger notices"
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
