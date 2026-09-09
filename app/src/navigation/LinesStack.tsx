import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';
import { useMetroNetwork } from '../network';

import { MetroLinesScreen } from '../screens/MetroLinesScreen';
import { LineStationsScreen } from '../screens/LineStationsScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { LinesStackParamList } from './types';

const Stack = createNativeStackNavigator<LinesStackParamList>();

export function LinesStack() {
  const screenOptions = useStackScreenOptions();
  const { network } = useMetroNetwork();

  return (
    <Stack.Navigator
      // Same scoped reset as HomeStack: only this page reloads on a network
      // switch, not the whole app.
      key={network}
      screenOptions={screenOptions}
    >
      <Stack.Screen name="MetroLines" component={MetroLinesScreen} options={{ title: 'Metro Lines' }} />
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
