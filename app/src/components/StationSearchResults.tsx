import { FlatList, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useStationSearchQuery } from '../hooks';
import { StationCard } from './StationCard';
import { StationListSkeleton } from './StationListSkeleton';
import { Reveal } from './Reveal';
import { EmptyState } from './EmptyState';
import { spacing, emphasis } from '../theme';
import type { MetroNetwork } from '../types';

/** How many rows stagger before results simply appear. */
const STAGGER_LIMIT = 8;

interface Props {
  query: string;
  onOpen: (station: { code: string; name: string; network?: MetroNetwork }) => void;
}

/** Station matches for a query, across every operator. */
export function StationSearchResults({ query, onOpen }: Props) {
  const theme = useTheme();
  const { data: results, isLoading } = useStationSearchQuery(query);
  const data = results ?? [];
  const count = data.length;
  const trimmed = query.trim();

  if (isLoading) return <StationListSkeleton />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => `${item.network ?? 'dmrc'}:${item.station_code}`}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        count > 0 ? (
          <Text variant="titleSmall" style={[emphasis.strong, styles.count, { color: theme.colors.onSurfaceVariant }]}>
            {count} {count === 1 ? 'match' : 'matches'}
          </Text>
        ) : null
      }
      renderItem={({ item, index }) => {
        // Only the first screenful staggers, so a long list isn't one animated view per row.
        const card = (
          <StationCard
            station={item}
            network={item.network}
            first={index === 0}
            last={index === count - 1}
            onPress={() => onOpen({ code: item.station_code, name: item.station_name, network: item.network })}
          />
        );
        return index < STAGGER_LIMIT ? (
          <Reveal index={index} replayOnFocus={false}>
            {card}
          </Reveal>
        ) : (
          card
        );
      }}
      ListEmptyComponent={
        <EmptyState
          title="No stations found"
          icon="search-outline"
          subtitle={trimmed ? `Nothing matches "${trimmed}"` : 'No stations available right now'}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  count: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
