import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Appbar, useTheme } from 'react-native-paper';

import { HomeScreen } from '../screens/HomeScreen';
import { JourneyResultsScreen } from '../screens/JourneyResultsScreen';
import { StationDetailScreen } from '../screens/StationDetailScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
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
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="JourneyResults" component={JourneyResultsScreen} options={{ title: 'Route Details' }} />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={({ route }) => ({ title: route.params.stationName })}
      />
    </Stack.Navigator>
  );
}
