import { useEffect, useState } from 'react';
import {
  loadMapLayout,
  readCachedLayout,
  writeCachedLayout,
  type LayoutStage,
  type MapLayout,
} from '../services/mapLayout';
import type { MetroNetwork } from '../types';

/** How long a saved layout is trusted before the server is asked again. */
const REFRESH_MS = 6 * 60 * 60 * 1000;

/**
 * Networks already checked this session. The server only re-reads the map
 * when its image changed, so one check per session (or per refresh window)
 * is plenty, even if the map screen mounts many times.
 */
const checkedAt = new Map<MetroNetwork, number>();

export interface MapLayoutState {
  /** The best layout known: the fresh one, else the last good one saved. */
  layout: MapLayout | null;
  /** Server progress while the official map is being read again. */
  stage: LayoutStage | null;
  message: string | null;
  progress: { done: number; total: number } | null;
  /** Set when the last check failed; `layout` may still hold a saved copy. */
  error: string | null;
}

const IDLE: MapLayoutState = { layout: null, stage: null, message: null, progress: null, error: null };

/**
 * The official-map layout for one network.
 *
 * Shows the saved layout straight away, then, if it is older than the refresh
 * window, streams a fresh one. While the server re-reads a changed map it
 * reports `extracting` and `progress` with a message meant for people, which
 * the map screen shows as a banner.
 */
export function useMapLayout(network: MetroNetwork, enabled = true): MapLayoutState {
  const [state, setState] = useState<MapLayoutState>(IDLE);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const patch = (next: Partial<MapLayoutState>) => {
      if (active) setState((current) => ({ ...current, ...next }));
    };

    (async () => {
      const cached = await readCachedLayout(network);
      if (cached) patch({ layout: cached.layout });

      const now = Date.now();
      const lastChecked = Math.max(checkedAt.get(network) ?? 0, cached?.savedAt ?? 0);
      if (now - lastChecked < REFRESH_MS) return;

      try {
        const layout = await loadMapLayout(
          network,
          {
            onStatus: (event) =>
              patch({
                stage: event.stage,
                message: event.message,
                progress:
                  event.done != null && event.total != null
                    ? { done: event.done, total: event.total }
                    : null,
              }),
          },
          controller.signal,
        );
        checkedAt.set(network, Date.now());
        await writeCachedLayout(layout);
        // A disabled or unavailable answer never hides a good saved layout.
        const keep = layout.status === 'ready' || !cached;
        patch({
          ...(keep ? { layout } : null),
          stage: null,
          message: null,
          progress: null,
          error: layout.status === 'unavailable' ? layout.detail ?? 'The map layout is unavailable.' : null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        patch({
          stage: null,
          message: null,
          progress: null,
          error: error instanceof Error ? error.message : 'The map layout could not be loaded.',
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [network, enabled]);

  return state;
}
