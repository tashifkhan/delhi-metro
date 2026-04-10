import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apiClient } from './src/api/client';
import { queryClient } from './src/api/queryClient';
import { DIProvider } from './src/di/DIContext';
import { createServiceContainer } from './src/di/container';
import { RootTabs } from './src/navigation/RootTabs';

const container = createServiceContainer(apiClient);

export default function App() {
  return (
    <SafeAreaProvider>
      <DIProvider container={container}>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootTabs />
          </NavigationContainer>
        </QueryClientProvider>
      </DIProvider>
    </SafeAreaProvider>
  );
}
