import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';
import { useMetroNetwork } from '../network';

import { HomeScreen } from '../screens/HomeScreen';
import { JourneyResultsScreen } from '../screens/JourneyResultsScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import { AppearanceScreen } from '../screens/AppearanceScreen';
import { AboutScreen } from '../screens/AboutScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  const screenOptions = useStackScreenOptions();
  const { network } = useMetroNetwork();

  return (
    <Stack.Navigator
      // A network switch pops this stack to its root so a Delhi detail route
      // never lingers under Noida (and vice versa). Scoped here rather than
      // at the app root, so the shell and the selected tab stay put.
      key={network}
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
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
    </Stack.Navigator>
  );
}
