import { FlatList, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationsQuery } from '../hooks';
import { NotificationCard } from '../components/NotificationCard';
import { LineStatusCarousel } from '../components/LineStatusCarousel';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme';

export function NotificationsScreen() {
  const theme = useTheme();
  const { isDark } = useAppTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useNotificationsQuery();

  if (isLoading) return <LoadingState message="Loading alerts..." />;
  if (isError) return <ErrorState message="Could not load alerts" onRetry={refetch} />;

  const ListHeader = (
    <View>
      <LineStatusCarousel />
      <View style={[styles.noticeHeader, { borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={[styles.noticeIconWrap, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]}>
          <Ionicons name="megaphone-outline" size={16} color={theme.colors.primary} />
        </View>
        <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
          Passenger Notices
        </Text>
        {!!data?.length && (
          <View style={[styles.countBadge, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>
              {data.length}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={ListHeader}
      renderItem={({ item }) => <NotificationCard notification={item} />}
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
    gap: spacing.sm,
    flexGrow: 1,
    paddingBottom: spacing['3xl'],
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  noticeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
  },
});
