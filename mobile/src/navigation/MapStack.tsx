import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MetroMapScreen } from '../screens/MetroMapScreen';
import { colors } from '../theme';
import type { MapStackParamList } from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

export function MapStack() {
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
      <Stack.Screen name="MetroMap" component={MetroMapScreen} options={{ title: 'Network Map' }} />
    </Stack.Navigator>
  );
}
