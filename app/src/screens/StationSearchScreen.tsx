import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Searchbar, Text, useTheme } from 'react-native-paper';
import { useStationSearchQuery } from '../hooks';
import { StationCard } from '../components/StationCard';
import { StationListSkeleton } from '../components/StationListSkeleton';
import { Reveal } from '../components/Reveal';
import { EmptyState } from '../components/EmptyState';
import { useAppTheme } from '../theme/ThemeContext';
import type { ExploreStackParamList } from '../navigation/types';
import { spacing, radius } from '../theme';

type Nav = NativeStackNavigationProp<ExploreStackParamList, 'StationSearch'>;
type Route = RouteProp<ExploreStackParamList, 'StationSearch'>;

/** How many rows stagger before results simply appear. */
const STAGGER_LIMIT = 8;

/** The address bar follows the field, a beat behind the typing. */
function useDebouncedUrlQuery(value: string): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 300);
    return () => clearTimeout(timer);
  }, [value]);

  return debounced;
}

export function StationSearchScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const theme = useTheme();
  const { fills } = useAppTheme();
  // Deep links arrive with ?q= already set; typing updates it below so the
  // URL stays shareable.
  const [searchText, setSearchText] = useState(route.params?.q ?? '');
  const { data: results, isLoading } = useStationSearchQuery(searchText);

  // The URL stays shareable, but it follows the field after a pause. Updating
  // it on every keystroke rewrites the history entry per character.
  const debouncedQuery = useDebouncedUrlQuery(searchText);

  useEffect(() => {
    const q = debouncedQuery.trim() || undefined;
    if (q !== route.params?.q) {
      navigation.setParams({ q });
    }
  }, [debouncedQuery, navigation, route.params?.q]);

  const resultCount = results?.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search by name or code"
        value={searchText}
        onChangeText={setSearchText}
        autoCapitalize="characters"
        style={[styles.searchbar, { backgroundColor: fills.subtle }]}
        inputStyle={{ color: theme.colors.onSurface }}
        placeholderTextColor={theme.colors.outline}
        elevation={0}
      />

      {isLoading ? (
        <StationListSkeleton />
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(item) => `${item.network ?? 'dmrc'}:${item.station_code}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            resultCount > 0 ? (
              <Text
                variant="labelMedium"
                style={[styles.count, { color: theme.colors.onSurfaceVariant }]}
              >
                {resultCount} {resultCount === 1 ? 'station' : 'stations'}
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => {
            // Only the first screenful staggers. Past that the row is the
            // card on its own, so a long result list is not one animated
            // view per row.
            const card = (
              <StationCard
                station={item}
                network={item.network}
                onPress={() =>
                  navigation.navigate('StationDetail', {
                    stationCode: item.station_code,
                    stationName: item.station_name,
                  })
                }
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
              subtitle={
                searchText.trim()
                  ? `Nothing matches "${searchText.trim()}"`
                  : 'No stations available right now'
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.pill,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  count: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xs,
  },
});
