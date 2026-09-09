import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import {
  createBottomTabNavigator,
  type BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';

import { AlertsStack } from './AlertsStack';
import { ExploreStack } from './ExploreStack';
import { HomeStack } from './HomeStack';
import { LinesStack } from './LinesStack';
import { MapStack } from './MapStack';
import type { RootTabParamList } from './types';
import { useHaptics } from '../hooks/useHaptics';
import { DesktopShell, type DesktopTab } from '../components/web/DesktopShell';

const Tab = createBottomTabNavigator<RootTabParamList>();

/**
 * Desktop web root. A real tab navigator sits underneath, so client-side
 * routes, deep links, and browser history all work exactly like mobile — the
 * only difference is presentation. The tab bar itself is hidden; each scene
 * renders the persistent sidebar next to its stack instead.
 *
 * Content is centred in a max-width column: without the constraint every
 * screen stretches to the full window and reads as a blown-up phone. The map
 * is the exception — it wants every pixel, so it stays full-bleed.
 */
const CONTENT_MAX_WIDTH = 920;

function DesktopFrame({
  active,
  fullBleed = false,
  children,
}: {
  active: DesktopTab;
  fullBleed?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  return (
    <View style={[styles.shell, { backgroundColor: theme.colors.background }]}>
      <DesktopShell active={active} onSelect={(tab) => navigation.navigate(tab as never)} />
      <View style={styles.main}>
        <View
          style={[
            styles.content,
            fullBleed && styles.contentFullBleed,
            !fullBleed && { maxWidth: CONTENT_MAX_WIDTH },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

function HomeDesktopScene() {
  return (
    <DesktopFrame active="HomeTab">
      <HomeStack />
    </DesktopFrame>
  );
}

function SearchDesktopScene() {
  return (
    <DesktopFrame active="SearchTab">
      <ExploreStack />
    </DesktopFrame>
  );
}

function LinesDesktopScene() {
  return (
    <DesktopFrame active="LinesTab">
      <LinesStack />
    </DesktopFrame>
  );
}

function MapDesktopScene() {
  return (
    <DesktopFrame active="MapTab" fullBleed>
      <MapStack />
    </DesktopFrame>
  );
}

function AlertsDesktopScene() {
  return (
    <DesktopFrame active="AlertsTab">
      <AlertsStack />
    </DesktopFrame>
  );
}

export function DesktopRoot() {
  const haptics = useHaptics();

  return (
    <Tab.Navigator
      tabBar={() => null}
      screenListeners={({ navigation, route }) => ({
        tabPress: () => {
          const state = navigation.getState();
          // Re-tapping the active sidebar entry is not a change and stays silent.
          const alreadyFocused = state.routes[state.index]?.key === route.key;
          if (!alreadyFocused) haptics.select();
        },
      })}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab" component={HomeDesktopScene} />
      <Tab.Screen name="SearchTab" component={SearchDesktopScene} />
      <Tab.Screen name="LinesTab" component={LinesDesktopScene} />
      <Tab.Screen name="MapTab" component={MapDesktopScene} />
      <Tab.Screen name="AlertsTab" component={AlertsDesktopScene} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
  },
  main: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentFullBleed: {
    maxWidth: undefined,
  },
});
