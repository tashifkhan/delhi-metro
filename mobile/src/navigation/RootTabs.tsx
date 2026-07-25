import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeStack } from './HomeStack';
import { ExploreStack } from './ExploreStack';
import { LinesStack } from './LinesStack';
import { MapStack } from './MapStack';
import { AlertsStack } from './AlertsStack';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<
  keyof RootTabParamList,
  { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }
> = {
  HomeTab: { focused: 'train', default: 'train-outline' },
  SearchTab: { focused: 'search', default: 'search-outline' },
  LinesTab: { focused: 'git-branch', default: 'git-branch-outline' },
  MapTab: { focused: 'map', default: 'map-outline' },
  AlertsTab: { focused: 'notifications', default: 'notifications-outline' },
};

/**
 * M3 navigation bar geometry. The bar is 80dp tall above the safe-area inset:
 * 12dp padding, a 32dp active indicator, 4dp gap, the label, then 12dp padding.
 * Content must clear INDICATOR_HEIGHT + LABEL_GAP + LABEL_HEIGHT (52dp), so the
 * vertical padding is budgeted on top of that rather than carved out of it.
 */
const INDICATOR_HEIGHT = 32;
const INDICATOR_WIDTH = 64;
const LABEL_GAP = 4;
const LABEL_HEIGHT = 16;
const BAR_PADDING_TOP = 12;
const BAR_PADDING_BOTTOM = 12;
const BAR_HEIGHT =
  BAR_PADDING_TOP + INDICATOR_HEIGHT + LABEL_GAP + LABEL_HEIGHT + BAR_PADDING_BOTTOM;

export function RootTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.onSecondaryContainer,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.elevation.level2,
          borderTopWidth: 0,
          elevation: 0,
          // The inset extends the bar; it is not shared with the content box.
          height: BAR_HEIGHT + insets.bottom,
          paddingTop: BAR_PADDING_TOP,
          paddingBottom: BAR_PADDING_BOTTOM + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: LABEL_HEIGHT,
          fontWeight: '500',
          marginTop: LABEL_GAP,
        },
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <View
              style={[
                styles.indicator,
                focused && { backgroundColor: theme.colors.secondaryContainer },
              ]}
            >
              <Ionicons
                name={focused ? icons.focused : icons.default}
                size={22}
                color={focused ? theme.colors.onSecondaryContainer : color}
              />
            </View>
          );
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

const styles = StyleSheet.create({
  indicator: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
