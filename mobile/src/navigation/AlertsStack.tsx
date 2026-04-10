import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { NotificationsScreen } from '../screens/NotificationsScreen';
import { colors } from '../theme';
import type { AlertsStackParamList } from './types';

const Stack = createNativeStackNavigator<AlertsStackParamList>();

export function AlertsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  );
}
