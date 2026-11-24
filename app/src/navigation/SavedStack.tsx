import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';

import { SavedScreen } from '../screens/SavedScreen';
import { JourneyResultsScreen } from '../screens/JourneyResultsScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { SavedStackParamList } from './types';

const Stack = createNativeStackNavigator<SavedStackParamList>();

export function SavedStack() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Saved" component={SavedScreen} options={{ title: 'Saved' }} />
      <Stack.Screen name="JourneyResults" component={JourneyResultsScreen} options={{ title: '' }} />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={({ route }) => ({ title: route.params.stationName })}
      />
    </Stack.Navigator>
  );
}
