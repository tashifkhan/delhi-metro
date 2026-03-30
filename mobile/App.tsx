import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { queryClient } from './src/api/queryClient';
import {
  useJourneyPlanQuery,
  useMapFamilyPrimaryQuery,
  useMetroLinesQuery,
  useNotificationsQuery,
  useStationSearchQuery,
} from './src/hooks';

function HomeScreen() {
  const fromCode = 'RG';
  const toCode = 'VASI';
  const searchText = 'RAJOURI';

  const linesQuery = useMetroLinesQuery();
  const notificationsQuery = useNotificationsQuery();
  const searchQuery = useStationSearchQuery(searchText);
  const journeyPlanQuery = useJourneyPlanQuery(fromCode, toCode);
  const networkMapQuery = useMapFamilyPrimaryQuery('network');

  const isLoading =
    linesQuery.isLoading ||
    notificationsQuery.isLoading ||
    searchQuery.isLoading ||
    journeyPlanQuery.isLoading ||
    networkMapQuery.isLoading;

  const lineCount = linesQuery.data?.length ?? 0;
  const notificationCount = notificationsQuery.data?.length ?? 0;
  const stationCount = searchQuery.data?.length ?? 0;

  const estimatedFare = useMemo(() => {
    if (!journeyPlanQuery.data) {
      return '-';
    }
    return String(journeyPlanQuery.data.least_distance_fare.weekday_fare);
  }, [journeyPlanQuery.data]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Delhi Metro Mobile</Text>
      <Text style={styles.subtitle}>TanStack Query + typed services scaffold</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Station search (demo)</Text>
        <TextInput value={searchText} editable={false} style={styles.input} />
      </View>

      {isLoading ? <ActivityIndicator size="small" color="#0b63c9" /> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Line count</Text>
        <Text style={styles.cardValue}>{lineCount}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.cardValue}>{notificationCount}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search matches</Text>
        <Text style={styles.cardValue}>{stationCount}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>RG → VASI weekday fare</Text>
        <Text style={styles.cardValue}>{estimatedFare}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Network map URLs</Text>
        <Text style={styles.linkText}>{networkMapQuery.data?.image?.url ?? '-'}</Text>
        <Text style={styles.linkText}>{networkMapQuery.data?.pdf?.url ?? 'PDF unavailable'}</Text>
      </View>

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Hooked and ready</Text>
      </Pressable>

      <StatusBar style="auto" />
    </ScrollView>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HomeScreen />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 56,
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: '#f5f7fb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0e1726',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d8dee9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  cardValue: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
  },
  linkText: {
    color: '#0b63c9',
    fontSize: 12,
  },
  button: {
    marginTop: 6,
    backgroundColor: '#0b63c9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
