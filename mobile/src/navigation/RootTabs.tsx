import { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeStack } from './HomeStack';
import { ExploreStack } from './ExploreStack';
import { LinesStack } from './LinesStack';
import { MapStack } from './MapStack';
import { AlertsStack } from './AlertsStack';
import { useHaptics } from '../hooks/useHaptics';
import { spring } from '../theme/motion';
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
 * M3 navigation bar geometry. The bar is 76dp tall above the safe-area inset:
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

/**
 * Tab icon with an animated M3 selection indicator.
 *
 * The pill grows out from the icon rather than appearing at full width, and
 * the icon lifts slightly as it settles — the same "indicator travels to the
 * selection" idea Material uses, expressed per-item.
 */
function TabBarIcon({
  focused,
  name,
  color,
  indicatorColor,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  indicatorColor: string;
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      ...spring.spatial,
    }).start();
  }, [focused, progress]);

  return (
    <View style={styles.iconSlot}>
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: indicatorColor,
            opacity: progress,
            transform: [
              {
                scaleX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.45, 1],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
          ],
        }}
      >
        <Ionicons name={name} size={22} color={color} />
      </Animated.View>
    </View>
  );
}

export function RootTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

  return (
    <Tab.Navigator
      screenListeners={({ navigation, route }) => ({
        tabPress: () => {
          const state = navigation.getState();
          // Re-tapping the active tab pops its stack rather than navigating,
          // so it is not a change and should stay silent.
          const alreadyFocused = state.routes[state.index]?.key === route.key;
          if (!alreadyFocused) haptics.select();
        },
      })}
      screenOptions={({ route }) => ({
        headerShown: false,
        // Tabs are siblings, so they cross-fade and shift rather than sliding
        // in a direction — Material's shared axis for lateral navigation.
        animation: 'shift',
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
          // React Navigation pads its tab items by 5dp, which BAR_HEIGHT does
          // not budget for, so the column overflows and the label — the only
          // shrinkable child — is what gives. Native lets the squashed text
          // spill; web clips it to the box and eats the descenders.
          flexShrink: 0,
        },
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <TabBarIcon
              focused={focused}
              name={focused ? icons.focused : icons.default}
              color={focused ? theme.colors.onSecondaryContainer : color}
              indicatorColor={theme.colors.secondaryContainer}
            />
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
  iconSlot: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
});
