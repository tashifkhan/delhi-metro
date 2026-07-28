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
import { ThemeProvider, useAppTheme } from './src/theme';
import { RootTabs } from './src/navigation/RootTabs';
import { MetroNetworkProvider, useMetroNetwork } from './src/network';

const container = createServiceContainer(apiClient);

function AppNavigation() {
  const { network, isLoaded } = useMetroNetwork();

  if (!isLoaded) {
    return null;
  }

  // Remounting on a network change also returns every tab to its root. That
  // prevents a Delhi station-detail route from lingering after switching to
  // Noida (and vice versa).
  return <RootTabs key={network} />;
}

function AppInner() {
  const { paperTheme, navTheme, isDark, settingsLoaded } = useAppTheme();

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
