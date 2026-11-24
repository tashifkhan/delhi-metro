import { Platform, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apiClient } from './src/api/client';
import { queryClient } from './src/api/queryClient';
import { DIProvider } from './src/di/DIContext';
import { createServiceContainer } from './src/di/container';
import { ThemeProvider, useAppTheme, useFocusRing, useBrowserChrome } from './src/theme';
import { SavedProvider } from './src/saved/SavedContext';
import { OfflinePackProvider } from './src/offline/OfflinePackContext';
import { QuickActionsBridge } from './src/saved/QuickActionsBridge';
import type { RootTabParamList } from './src/navigation/types';
import { useIsDesktop } from './src/hooks/useIsDesktop';
import { RootTabs } from './src/navigation/RootTabs';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DesktopRoot } from './src/navigation/DesktopRoot';
import { navigationLinking } from './src/navigation/linking';
import { MetroNetworkProvider, useMetroNetwork } from './src/network';

const container = createServiceContainer(apiClient);
const navigationRef = createNavigationContainerRef<RootTabParamList>();

function AppNavigation() {
  const { isLoaded } = useMetroNetwork();
  const isDesktop = useIsDesktop();

  if (!isLoaded) {
    return null;
  }

  // A resize that switches layouts mounts that layout's tab navigator.
  if (isDesktop) {
    return <DesktopRoot key="desktop" />;
  }
  return <RootTabs key="mobile" />;
}

function AppInner() {
  const { paperTheme, navTheme, isDark, settingsLoaded, settings } = useAppTheme();
  // The web skips setup: a visitor often arrives on a shared route link and
  // should land on it. The same choices sit in Settings there.
  const onboarding = settingsLoaded && !settings.onboarded && Platform.OS !== 'web';

  useFocusRing(paperTheme.colors.primary);
  useBrowserChrome(isDark, paperTheme.colors.background, settingsLoaded);

  return (
    <PaperProvider theme={paperTheme}>
      {/*
        `auto` tracks the system scheme, which is wrong once the user pins a
        theme mode — the bar has to follow the resolved app theme instead.
      */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <QuickActionsBridge navigationRef={navigationRef} />
      {onboarding ? (
        <OnboardingScreen />
      ) : settingsLoaded ? (
        <NavigationContainer ref={navigationRef} theme={navTheme} linking={navigationLinking}>
          <AppNavigation />
        </NavigationContainer>
      ) : (
        // Hold on the themed background for the one frame the stored palette
        // takes to read, rather than flashing the default and repainting.
        <View style={{ flex: 1, backgroundColor: paperTheme.colors.background }} />
      )}
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MetroNetworkProvider>
          <DIProvider container={container}>
            <QueryClientProvider client={queryClient}>
              <SavedProvider>
                <OfflinePackProvider>
                  <AppInner />
                </OfflinePackProvider>
              </SavedProvider>
            </QueryClientProvider>
          </DIProvider>
        </MetroNetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
