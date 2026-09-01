import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';

import { MetroMapScreen } from '../screens/MetroMapScreen';
import type { MapStackParamList } from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

export function MapStack() {
  const screenOptions = useStackScreenOptions({ networkSwitcher: true });

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
    >
      <Stack.Screen name="MetroMap" component={MetroMapScreen} options={{ title: 'Network Map' }} />
    </Stack.Navigator>
  );
}
