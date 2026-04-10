import React, { createContext, useContext, ReactNode } from 'react';
import type { ServiceContainer } from './container';

const DIContext = createContext<ServiceContainer | null>(null);

export interface DIProviderProps {
  container: ServiceContainer;
  children: ReactNode;
}

export function DIProvider({ container, children }: DIProviderProps) {
  return (
    <DIContext.Provider value={container}>
      {children}
    </DIContext.Provider>
  );
}

export function useDI(): ServiceContainer {
  const context = useContext(DIContext);
  if (!context) {
    throw new Error('useDI must be used within a DIProvider');
  }
  return context;
}
