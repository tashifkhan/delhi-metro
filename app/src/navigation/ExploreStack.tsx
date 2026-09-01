import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';

import { StationSearchScreen } from '../screens/StationSearchScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { ExploreStackParamList } from './types';

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export function ExploreStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
    >
      <Stack.Screen name="StationSearch" component={StationSearchScreen} options={{ title: 'Search Stations' }} />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={({ route }) => ({ title: route.params.stationName })}
      />
    </Stack.Navigator>
  );
}
