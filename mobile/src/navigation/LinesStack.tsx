import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MetroLinesScreen } from '../screens/MetroLinesScreen';
import { LineStationsScreen } from '../screens/LineStationsScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import { colors } from '../theme';
import type { LinesStackParamList } from './types';

const Stack = createNativeStackNavigator<LinesStackParamList>();

export function LinesStack() {
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
