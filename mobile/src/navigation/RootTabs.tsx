import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';
import { HomeStack } from './HomeStack';
import { ExploreStack } from './ExploreStack';
import { LinesStack } from './LinesStack';
import { MapStack } from './MapStack';
import { AlertsStack } from './AlertsStack';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  HomeTab: { focused: 'train', default: 'train-outline' },
  SearchTab: { focused: 'search', default: 'search-outline' },
  LinesTab: { focused: 'git-branch', default: 'git-branch-outline' },
  MapTab: { focused: 'map', default: 'map-outline' },
  AlertsTab: { focused: 'notifications', default: 'notifications-outline' },
};

export function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.default;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ tabBarLabel: 'Plan' }} />
      <Tab.Screen name="SearchTab" component={ExploreStack} options={{ tabBarLabel: 'Search' }} />
      <Tab.Screen name="LinesTab" component={LinesStack} options={{ tabBarLabel: 'Lines' }} />
      <Tab.Screen name="MapTab" component={MapStack} options={{ tabBarLabel: 'Map' }} />
      <Tab.Screen name="AlertsTab" component={AlertsStack} options={{ tabBarLabel: 'Alerts' }} />
    </Tab.Navigator>
  );
}
