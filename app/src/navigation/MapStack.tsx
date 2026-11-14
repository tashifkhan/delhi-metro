import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';
import { useMetroNetwork } from '../network';

import { MetroMapScreen } from '../screens/MetroMapScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { MapStackParamList } from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

export function MapStack() {
  const screenOptions = useStackScreenOptions({ networkSwitcher: true });
  const { network } = useMetroNetwork();

  return (
    <Stack.Navigator
      // Same scoped reset as HomeStack: only this page reloads on a network
      // switch, not the whole app.
      key={network}
      screenOptions={screenOptions}
    >
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
