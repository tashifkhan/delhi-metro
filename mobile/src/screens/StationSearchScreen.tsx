import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Searchbar, Text, useTheme } from 'react-native-paper';
import { useDebounce, useStationSearchQuery } from '../hooks';
import { StationCard } from '../components/StationCard';
import { StationListSkeleton } from '../components/StationListSkeleton';
import { EmptyState } from '../components/EmptyState';
import { useAppTheme } from '../theme/ThemeContext';
import type { ExploreStackParamList } from '../navigation/types';
import { spacing, radius } from '../theme';

type Nav = NativeStackNavigationProp<ExploreStackParamList, 'StationSearch'>;

export function StationSearchScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { fills } = useAppTheme();
  const [searchText, setSearchText] = useState('');
  const debouncedQuery = useDebounce(searchText, 300);
  const { data: results, isLoading } = useStationSearchQuery(debouncedQuery);

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
          keyExtractor={(item) => String(item.id)}
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
          renderItem={({ item }) => (
            <StationCard
              station={item}
              onPress={() =>
                navigation.navigate('StationDetail', {
                  stationCode: item.station_code,
                  stationName: item.station_name,
                })
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="No stations found"
              icon="search-outline"
              subtitle={
                debouncedQuery.trim()
                  ? `Nothing matches "${debouncedQuery.trim()}"`
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
