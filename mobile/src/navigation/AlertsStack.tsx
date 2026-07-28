import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';

import { NotificationsScreen } from '../screens/NotificationsScreen';
import type { AlertsStackParamList } from './types';

const Stack = createNativeStackNavigator<AlertsStackParamList>();

export function AlertsStack() {
  const screenOptions = useStackScreenOptions({ networkSwitcher: true });

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
    >
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Alerts' }} />
    </Stack.Navigator>
  );
}
