/**
 * Turning a device position into "your nearest station".
 *
 * Browsers answer a location request with whatever they have first. On a
 * laptop that is often a Wi-Fi or IP estimate that can be kilometres off,
 * and the first fix on a phone is usually coarse before GPS settles. So the
 * caller keeps watching for a few seconds and keeps the most accurate fix,
 * and a station is only picked when the fix is good enough to trust.
 *
 * Kept free of React so it can be tested on its own.
 */

import type { MapStation } from './networkData';

/** A fix worse than this (metres) doesn't pick a station for you. */
export const TRUSTED_ACCURACY_M = 1_000;
/** Stop watching once a fix is this good (metres). */
export const GOOD_ACCURACY_M = 100;
/** Further than this from every station (metres), you're off the network. */
export const MAX_STATION_DISTANCE_M = 5_000;

export interface Fix {
  x: number;
  y: number;
  /** Radius of 95% confidence in metres, as the browser reports it. */
  accuracy: number;
}

export function nearestStation(
  stations: MapStation[],
  point: { x: number; y: number },
): { station: MapStation; distance: number } | null {
  let best: MapStation | null = null;
  let bestDistance = Infinity;
  for (const station of stations) {
    const d = Math.hypot(station.x - point.x, station.y - point.y);
    if (d < bestDistance) {
      best = station;
      bestDistance = d;
    }
  }
  return best ? { station: best, distance: bestDistance } : null;
}

export type LocateOutcome =
  | { kind: 'station'; station: MapStation; distance: number }
  | { kind: 'imprecise'; accuracy: number }
  | { kind: 'far'; distance: number };

export function decide(stations: MapStation[], fix: Fix): LocateOutcome {
  if (!(fix.accuracy <= TRUSTED_ACCURACY_M)) return { kind: 'imprecise', accuracy: fix.accuracy };
  const nearest = nearestStation(stations, fix);
  if (!nearest || nearest.distance > MAX_STATION_DISTANCE_M) {
    return { kind: 'far', distance: nearest?.distance ?? Infinity };
  }
  return { kind: 'station', ...nearest };
}

/** "1.2 km" or "300 m", rounded the way a person would say it. */
export function roughDistance(metres: number): string {
  if (!Number.isFinite(metres)) return 'an unknown distance';
  if (metres >= 1_000) return `${(metres / 1_000).toFixed(metres >= 10_000 ? 0 : 1)} km`;
  return `${Math.max(50, Math.round(metres / 50) * 50)} m`;
}
