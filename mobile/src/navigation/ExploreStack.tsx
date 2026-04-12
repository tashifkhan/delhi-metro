import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Appbar, useTheme } from 'react-native-paper';

import { StationSearchScreen } from '../screens/StationSearchScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { ExploreStackParamList } from './types';

const Stack = createNativeStackNavigator<ExploreStackParamList>();

export function ExploreStack() {
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
      <Stack.Screen name="StationSearch" component={StationSearchScreen} options={{ title: 'Search Stations' }} />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={({ route }) => ({ title: route.params.stationName })}
      />
    </Stack.Navigator>
  );
}
