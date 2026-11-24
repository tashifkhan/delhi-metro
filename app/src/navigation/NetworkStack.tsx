import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';

import { NetworkScreen } from '../screens/NetworkScreen';
import { LineStationsScreen } from '../screens/LineStationsScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { NetworkStackParamList } from './types';

const Stack = createNativeStackNavigator<NetworkStackParamList>();

export function NetworkStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Network" component={NetworkScreen} options={{ title: 'Network' }} />
      <Stack.Screen
        name="LineStations"
        component={LineStationsScreen}
        options={({ route }) => ({ title: route.params.lineName })}
      />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={({ route }) => ({ title: route.params.stationName })}
      />
    </Stack.Navigator>
  );
}
