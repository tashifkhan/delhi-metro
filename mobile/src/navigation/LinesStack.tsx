import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Appbar, useTheme } from 'react-native-paper';

import { MetroLinesScreen } from '../screens/MetroLinesScreen';
import { LineStationsScreen } from '../screens/LineStationsScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { LinesStackParamList } from './types';

const Stack = createNativeStackNavigator<LinesStackParamList>();

export function LinesStack() {
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
      <Stack.Screen name="MetroLines" component={MetroLinesScreen} options={{ title: 'Metro Lines' }} />
      <Stack.Screen
        name="LineStations"
        component={LineStationsScreen}
        options={({ route }) => ({ title: route.params.lineName })}
      />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={({ route }) => ({ title: route.params.stationName })}
      />
    </Stack.Navigator>
  );
}
