import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apiClient } from './src/api/client';
import { queryClient } from './src/api/queryClient';
import { DIProvider } from './src/di/DIContext';
import { createServiceContainer } from './src/di/container';
import { ThemeProvider, useAppTheme, useFocusRing } from './src/theme';
import { useIsDesktop } from './src/hooks/useIsDesktop';
import { RootTabs } from './src/navigation/RootTabs';
import { DesktopRoot } from './src/navigation/DesktopRoot';
import { MetroNetworkProvider, useMetroNetwork } from './src/network';

const container = createServiceContainer(apiClient);

function AppNavigation() {
  const { isLoaded } = useMetroNetwork();
  const isDesktop = useIsDesktop();

  if (!isLoaded) {
    return null;
  }

  // Each stack keys itself by network, so a switch pops that page to its
  // root without remounting the shell or losing the selected tab. The layout
  // key only separates the two shells so resize swaps reset navigators
  // rather than re-parenting routes across layouts.
  if (isDesktop) {
    return <DesktopRoot key="desktop" />;
  }
  return <RootTabs key="mobile" />;
}

function AppInner() {
  const { paperTheme, navTheme, isDark, settingsLoaded } = useAppTheme();

  useFocusRing(paperTheme.colors.primary);

  return (
    <PaperProvider theme={paperTheme}>
      {/*
        `auto` tracks the system scheme, which is wrong once the user pins a
        theme mode — the bar has to follow the resolved app theme instead.
      */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {settingsLoaded ? (
        <NavigationContainer theme={navTheme}>
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
              <AppInner />
            </QueryClientProvider>
          </DIProvider>
        </MetroNetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
