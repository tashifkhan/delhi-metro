import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Appbar, useTheme } from 'react-native-paper';

import { MetroMapScreen } from '../screens/MetroMapScreen';
import type { MapStackParamList } from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

export function MapStack() {
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
      <Stack.Screen name="MetroMap" component={MetroMapScreen} options={{ title: 'Network Map' }} />
    </Stack.Navigator>
  );
}
