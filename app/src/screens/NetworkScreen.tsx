import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { StationSearchBar } from '../components/StationSearchBar';
import { StationSearchResults } from '../components/StationSearchResults';
import { MetroLinesScreen } from './MetroLinesScreen';
import type { NetworkStackParamList } from '../navigation/types';
import { spacing } from '../theme';

type Nav = NativeStackNavigationProp<NetworkStackParamList, 'Network'>;
type Route = RouteProp<NetworkStackParamList, 'Network'>;

/** The address bar follows the field, a beat behind the typing. */
function useDebounced(value: string, ms = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Lines and stations in one place. With the field empty it lists every line
 * by operator with its status; typing switches to station matches. The field
 * stays mounted across both, so focus and the keyboard survive the switch.
 */
export function NetworkScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const theme = useTheme();
  const [query, setQuery] = useState(route.params?.q ?? '');

  // Deep links arrive with ?q=; typing updates it after a pause so the URL
  // stays shareable without a history entry per keystroke.
  const debounced = useDebounced(query);
  useEffect(() => {
    const q = debounced.trim() || undefined;
    if (q !== route.params?.q) navigation.setParams({ q });
  }, [debounced, navigation, route.params?.q]);

  const searching = query.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.barWrap}>
        <StationSearchBar value={query} onChangeText={setQuery} placeholder="Search stations by name or code" />
      </View>
      <View style={styles.body}>
        {searching ? (
          <StationSearchResults
            query={query}
            onOpen={(station) =>
              navigation.navigate('StationDetail', { stationCode: station.code, stationName: station.name })
            }
          />
        ) : (
          <MetroLinesScreen />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  barWrap: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  body: {
    flex: 1,
  },
});
