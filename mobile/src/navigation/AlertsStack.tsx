import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Appbar, useTheme } from 'react-native-paper';

import { NotificationsScreen } from '../screens/NotificationsScreen';
import type { AlertsStackParamList } from './types';

const Stack = createNativeStackNavigator<AlertsStackParamList>();

export function AlertsStack() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        header: ({ options, back }) => (
          <Appbar.Header style={{ backgroundColor: theme.colors.elevation.level2 }} elevated={false}>
            {back && <Appbar.BackAction onPress={navigation.goBack} color={theme.colors.onSurface} />}
            <Appbar.Content
              title={options.title ?? ''}
              color={theme.colors.onSurface}
              titleStyle={{ fontWeight: '700' }}
            />
          </Appbar.Header>
        ),
        contentStyle: { backgroundColor: theme.colors.background },
      })}
    >
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Alerts' }} />
    </Stack.Navigator>
  );
}
