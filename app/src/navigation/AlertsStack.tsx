import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStackScreenOptions } from './useStackScreenOptions';
import { useMetroNetwork } from '../network';

import { NotificationsScreen } from '../screens/NotificationsScreen';
import type { AlertsStackParamList } from './types';

const Stack = createNativeStackNavigator<AlertsStackParamList>();

export function AlertsStack() {
  const screenOptions = useStackScreenOptions({ networkSwitcher: true });
  const { network } = useMetroNetwork();

  return (
    <Stack.Navigator
      // Same scoped reset as HomeStack: only this page reloads on a network
      // switch, not the whole app.
      key={network}
      screenOptions={screenOptions}
    >
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Alerts' }} />
    </Stack.Navigator>
  );
}
