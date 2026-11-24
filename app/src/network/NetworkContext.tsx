import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { metroNetworkRepository } from '../storage/metroNetworkRepository';
import type { MetroNetwork } from '../types';

export type { MetroNetwork };

/** Every operator the app covers, in display order. */
export const OPERATORS: MetroNetwork[] = ['dmrc', 'nmrc', 'ncrtc'];

export const NETWORK_NAMES: Record<MetroNetwork, string> = {
  dmrc: 'Delhi Metro',
  nmrc: 'Noida Metro',
  // NCRTC runs both; riders know the services, not the operator.
  ncrtc: 'Namo Bharat & Meerut',
};

interface MetroNetworkContextValue {
  network: MetroNetwork;
  networkName: string;
  isLoaded: boolean;
  setNetwork: (network: MetroNetwork) => void;
  toggleNetwork: () => void;
}

const MetroNetworkContext = createContext<MetroNetworkContextValue | null>(null);

export function MetroNetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<MetroNetwork>('dmrc');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void metroNetworkRepository.load().then((savedNetwork) => {
      if (!active) return;
      setNetworkState(savedNetwork);
      setIsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setNetwork = useCallback((nextNetwork: MetroNetwork) => {
    setNetworkState(nextNetwork);
    void metroNetworkRepository.save(nextNetwork);
  }, []);

  const toggleNetwork = useCallback(() => {
    setNetworkState((current) => {
      // Cycles through every operator.
      const next = OPERATORS[(OPERATORS.indexOf(current) + 1) % OPERATORS.length];
      void metroNetworkRepository.save(next);
      return next;
    });
  }, []);

  const value = useMemo<MetroNetworkContextValue>(
    () => ({
      network,
      networkName: NETWORK_NAMES[network],
      isLoaded,
      setNetwork,
      toggleNetwork,
    }),
    [isLoaded, network, setNetwork, toggleNetwork],
  );

  return (
    <MetroNetworkContext.Provider value={value}>
      {children}
    </MetroNetworkContext.Provider>
  );
}

export function useMetroNetwork(): MetroNetworkContextValue {
  const context = useContext(MetroNetworkContext);
  if (!context) {
    throw new Error('useMetroNetwork must be used within MetroNetworkProvider');
  }
  return context;
}

