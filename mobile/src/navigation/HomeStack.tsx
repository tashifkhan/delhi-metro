import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';

import { HomeScreen } from '../screens/HomeScreen';
import { JourneyResultsScreen } from '../screens/JourneyResultsScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import { AppearanceScreen } from '../screens/AppearanceScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="JourneyResults" component={JourneyResultsScreen} options={{ title: 'Route Details' }} />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={({ route }) => ({ title: route.params.stationName })}
      />
      <Stack.Screen
        name="Appearance"
        component={AppearanceScreen}
        options={{ title: 'Appearance' }}
      />
    </Stack.Navigator>
  );
}
