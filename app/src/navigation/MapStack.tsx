import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';

import { MetroMapScreen } from '../screens/MetroMapScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { MapStackParamList } from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

export function MapStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {/* The map is full-bleed with its own floating search bar, so no app bar. */}
      <Stack.Screen
        name="MetroMap"
        component={MetroMapScreen}
        options={{ title: 'Network Map', headerShown: false }}
      />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={({ route }) => ({ title: route.params.stationName })}
      />
    </Stack.Navigator>
  );
}
