import { createContext, useContext, type ReactNode } from 'react';
import { BASE_GEOMETRY, type NetworkGeometry } from './geometry';

const NetworkGeometryContext = createContext<NetworkGeometry>(BASE_GEOMETRY);

/** Supplies the geometry the map draws, with any official-map layouts applied. */
export function NetworkGeometryProvider({
  value,
  children,
}: {
  value: NetworkGeometry;
  children: ReactNode;
}) {
  return <NetworkGeometryContext.Provider value={value}>{children}</NetworkGeometryContext.Provider>;
}

export function useNetworkGeometry(): NetworkGeometry {
  return useContext(NetworkGeometryContext);
}
