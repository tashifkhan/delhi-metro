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

const container = createServiceContainer(apiClient);

function AppInner() {
  const { paperTheme, navTheme } = useAppTheme();

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="auto" />
        <RootTabs />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DIProvider container={container}>
          <QueryClientProvider client={queryClient}>
            <AppInner />
          </QueryClientProvider>
        </DIProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
