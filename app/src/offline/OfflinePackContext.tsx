import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { env } from '../config/env';
import { useAppTheme } from '../theme/ThemeContext';
import { packStore } from './store';
import { syncPack, type SyncOutcome } from './sync';
import { dueForCheck, mayAutoSync, type Connection, type PackMeta } from './model';

type Status = 'idle' | 'syncing';

interface OfflinePackApi {
  /** The pack on this phone, if any. */
  meta: PackMeta | null;
  status: Status;
  /** Result of the most recent sync attempt, for the Offline data page. */
  last: (SyncOutcome & { at: number }) | null;
  /** Check and download now, whatever the auto-sync switches say. */
  syncNow: () => Promise<SyncOutcome>;
  remove: () => Promise<void>;
}

const OfflinePackContext = createContext<OfflinePackApi | null>(null);

function connectionOf(state: Network.NetworkState): Connection {
  if (state.isInternetReachable === false || state.isConnected === false) return 'none';
  switch (state.type) {
    case Network.NetworkStateType.WIFI:
    case Network.NetworkStateType.ETHERNET:
      return 'wifi';
    case Network.NetworkStateType.CELLULAR:
      return 'cellular';
    case Network.NetworkStateType.NONE:
      return 'none';
    case Network.NetworkStateType.UNKNOWN:
      return 'unknown';
    default:
      return 'other';
  }
}

/**
 * Keeps the offline pack current.
 *
 * With auto-sync on, it checks the manifest when the app opens, when it comes
 * back to the foreground, and when the connection returns, at most every six
 * hours, and only downloads when the server has a newer pack. "Wi-Fi only"
 * holds background downloads until the phone is on Wi-Fi.
 */
export function OfflinePackProvider({ children }: { children: ReactNode }) {
  const { settings, settingsLoaded } = useAppTheme();
  const [meta, setMeta] = useState<PackMeta | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [last, setLast] = useState<OfflinePackApi['last']>(null);
  const running = useRef<Promise<SyncOutcome> | null>(null);
  const lastCheckedAt = useRef<number | null>(null);
  const policy = useRef({ autoSync: settings.offlineAutoSync, wifiOnly: settings.offlineWifiOnly });
  policy.current = { autoSync: settings.offlineAutoSync, wifiOnly: settings.offlineWifiOnly };

  useEffect(() => {
    void packStore.readMeta().then(setMeta);
  }, []);

  const run = useCallback((): Promise<SyncOutcome> => {
    // One sync at a time; a second caller shares the first one's result.
    if (running.current) return running.current;
    setStatus('syncing');
    const job = syncPack({ apiBase: env.apiBaseUrl, fetchFn: fetch, store: packStore, now: Date.now })
      .then((outcome) => {
        lastCheckedAt.current = Date.now();
        if (outcome.kind === 'downloaded' || outcome.kind === 'up-to-date') setMeta(outcome.meta);
        setLast({ ...outcome, at: Date.now() });
        return outcome;
      })
      .finally(() => {
        running.current = null;
        setStatus('idle');
      });
    running.current = job;
    return job;
  }, []);

  const maybeAutoSync = useCallback(
    async (state?: Network.NetworkState) => {
      if (!dueForCheck(lastCheckedAt.current, Date.now())) return;
      const connection = connectionOf(state ?? (await Network.getNetworkStateAsync()));
      // Background syncs only refresh a pack someone chose to download.
      const held = await packStore.readMeta();
      if (!held || !mayAutoSync(policy.current, connection)) return;
      await run();
    },
    [run],
  );

  useEffect(() => {
    if (!settingsLoaded) return undefined;
    void maybeAutoSync();
    const network = Network.addNetworkStateListener((state) => {
      if (connectionOf(state) !== 'none') void maybeAutoSync(state);
    });
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') void maybeAutoSync();
    });
    return () => {
      network.remove();
      app.remove();
    };
  }, [settingsLoaded, maybeAutoSync]);

  const remove = useCallback(async () => {
    await packStore.clear();
    setMeta(null);
    setLast(null);
  }, []);

  const value = useMemo<OfflinePackApi>(
    () => ({ meta, status, last, syncNow: run, remove }),
    [meta, status, last, run, remove],
  );

  return <OfflinePackContext.Provider value={value}>{children}</OfflinePackContext.Provider>;
}

export function useOfflinePack(): OfflinePackApi {
  const value = useContext(OfflinePackContext);
  if (!value) throw new Error('useOfflinePack needs an OfflinePackProvider');
  return value;
}
