import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Searchbar, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useDebounce, useStationSearchQuery } from '../hooks';
import { StationCard } from '../components/StationCard';
import { EmptyState } from '../components/EmptyState';
import { useAppTheme } from '../theme/ThemeContext';
import type { ExploreStackParamList } from '../navigation/types';
import { spacing } from '../theme';

type Nav = NativeStackNavigationProp<ExploreStackParamList, 'StationSearch'>;

export function StationSearchScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { isDark } = useAppTheme();
  const [searchText, setSearchText] = useState('');
  const debouncedQuery = useDebounce(searchText, 300);
  const { data: results, isLoading } = useStationSearchQuery(debouncedQuery);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Station name..."
        value={searchText}
        onChangeText={setSearchText}
        autoCapitalize="characters"
        style={[styles.searchbar, { backgroundColor: theme.colors.elevation.level3 }]}
        inputStyle={{ color: theme.colors.onSurface }}
        placeholderTextColor={theme.colors.outline}
        elevation={0}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <View style={[styles.loadingCard, { backgroundColor: isDark ? theme.colors.elevation.level2 : theme.colors.surfaceVariant }]}>
            <View style={[styles.loadingIcon, { backgroundColor: isDark ? theme.colors.elevation.level4 : theme.colors.primaryContainer }]}>
              <Ionicons name="train-outline" size={22} color={theme.colors.primary} />
            </View>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '500' }}>
              Searching stations...
            </Text>
          </View>
          {[0.6, 0.4, 0.25].map((opacity, i) => (
            <View key={i} style={[styles.skeletonRow, { opacity }]}>
              <View style={[styles.skeletonCircle, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant }]} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skeletonBar, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant, width: '70%' }]} />
                <View style={[styles.skeletonBar, { backgroundColor: isDark ? theme.colors.elevation.level3 : theme.colors.surfaceVariant, width: '40%', height: 10 }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
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
              title="No Results"
              subtitle={
                debouncedQuery.trim()
                  ? `No stations match "${debouncedQuery.trim()}"`
                  : 'No stations available'
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
    borderRadius: 999,
  },
  list: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  loadingCard: {
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  skeletonBar: {
    height: 14,
    borderRadius: 7,
  },
});
