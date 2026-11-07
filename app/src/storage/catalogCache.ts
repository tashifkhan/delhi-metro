import type { Query } from '@tanstack/react-query';

import { offlineStore } from './offlineStore';
import type {
  MetroLine,
  MetroNetwork,
  PassengerNotification,
  PassengerNotificationDetail,
  StationByLineItem,
  StationDetail,
} from '../types';
import type { MapAssetByFormatResponse } from '../types/maps';

/**
 * The catalogs a rider can keep using once the train enters a tunnel.
 *
 * A successful response replaces the stored copy. A failed request returns the
 * stored copy instead of failing the screen. Nothing here expires: an old line
 * list is more useful underground than an error, and the screens say when a
 * copy is the stored one.
 */
export interface Cached<T> {
  data: T;
  savedAt: number;
  /** True when this answer came from storage because the network failed. */
  fromCache: boolean;
}

/**
 * A stored copy is shown immediately and stays stale, so the next focus or
 * reconnect refetches it. A live response keeps the normal five-minute window.
 */
export function catalogStaleTime<T>(query: Query<Cached<T>, Error, Cached<T>>): number {
  return query.state.data?.fromCache ? 0 : 5 * 60_000;
}

async function readThrough<T>(
  key: string,
  load: () => Promise<T>,
  shown?: Cached<T>,
): Promise<Cached<T>> {
  try {
    const data = await load();
    let savedAt = Date.now();
    try {
      savedAt = await offlineStore.put(key, data);
    } catch {
      // A failed cache write must not turn a good response into an error.
    }
    return { data, savedAt, fromCache: false };
  } catch (error) {
    // A failed refresh must not replace a live copy with the stored one: that
    // would stamp the screen as offline while the newer data is still in
    // memory. The stored document only stands in when there is nothing else.
    if (shown && !shown.fromCache) return shown;

    let stored: { payload: T; savedAt: number } | null = null;
    try {
      stored = await offlineStore.get<T>(key);
    } catch {
      stored = null;
    }
    if (stored) {
      return { data: stored.payload, savedAt: stored.savedAt, fromCache: true };
    }
    throw error;
  }
}

function linesKey(network: MetroNetwork): string {
  return `lines:${network}`;
}

function notificationsKey(network: MetroNetwork): string {
  return `notifications:${network}`;
}

function notificationDetailKey(slug: string): string {
  return `notification:${slug}`;
}

function stationsByLineKey(network: MetroNetwork, lineCode: string): string {
  return `line-stations:${network}:${lineCode.trim().toUpperCase()}`;
}

function stationDetailKey(network: MetroNetwork, stationCode: string): string {
  return `station:${network}:${stationCode.trim().toUpperCase()}`;
}

function mapKey(network: MetroNetwork): string {
  return `map:network:${network}`;
}

export const catalogCache = {
  /** The copy already on disk, used to paint a screen before the network answers. */
  readLines: (network: MetroNetwork) => offlineStore.get<MetroLine[]>(linesKey(network)),

  readNotifications: (network: MetroNetwork) =>
    offlineStore.get<PassengerNotification[]>(notificationsKey(network)),

  readNotificationDetail: (slug: string) =>
    offlineStore.get<PassengerNotificationDetail>(notificationDetailKey(slug)),

  readStationsByLine: (network: MetroNetwork, lineCode: string) =>
    offlineStore.get<StationByLineItem[]>(stationsByLineKey(network, lineCode)),

  readStationDetail: (network: MetroNetwork, stationCode: string) =>
    offlineStore.get<StationDetail>(stationDetailKey(network, stationCode)),

  readMap: (network: MetroNetwork) =>
    offlineStore.get<MapAssetByFormatResponse>(mapKey(network)),

  lines: (network: MetroNetwork, load: () => Promise<MetroLine[]>, shown?: Cached<MetroLine[]>) =>
    readThrough(linesKey(network), load, shown),

  notifications: (
    network: MetroNetwork,
    load: () => Promise<PassengerNotification[]>,
    shown?: Cached<PassengerNotification[]>,
  ) => readThrough(notificationsKey(network), load, shown),

  notificationDetail: (
    slug: string,
    load: () => Promise<PassengerNotificationDetail>,
    shown?: Cached<PassengerNotificationDetail>,
  ) => readThrough(notificationDetailKey(slug), load, shown),

  stationsByLine: (
    network: MetroNetwork,
    lineCode: string,
    load: () => Promise<StationByLineItem[]>,
    shown?: Cached<StationByLineItem[]>,
  ) => readThrough(stationsByLineKey(network, lineCode), load, shown),

  stationDetail: (
    network: MetroNetwork,
    stationCode: string,
    load: () => Promise<StationDetail>,
    shown?: Cached<StationDetail>,
  ) => readThrough(stationDetailKey(network, stationCode), load, shown),

  map: (
    network: MetroNetwork,
    load: () => Promise<MapAssetByFormatResponse>,
    shown?: Cached<MapAssetByFormatResponse>,
  ) => readThrough(mapKey(network), load, shown),
};
