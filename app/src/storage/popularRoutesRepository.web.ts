import { readJson, writeJson } from './webStore';
import type {
  JourneyScope,
  PlannedJourney,
  PopularRouteEntry,
  RouteStrategy,
} from '../types';

const STORAGE_KEY = 'dmrc:popularRoutes';

interface StoredRoute {
  routeKey: string;
  fromStationCode: string;
  toStationCode: string;
  plan: PlannedJourney;
  hitCount: number;
  lastFetchedAt: number;
}

function buildRouteKey(
  fromStationCode: string,
  toStationCode: string,
  strategy: RouteStrategy,
  scope: JourneyScope = 'dmrc',
): string {
  return `${scope}:${fromStationCode.trim().toUpperCase()}_${toStationCode.trim().toUpperCase()}_${strategy}`;
}

function isPlannedJourney(value: unknown): value is PlannedJourney {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<PlannedJourney>;
  return (
    typeof candidate.source === 'string' &&
    typeof candidate.strategy === 'string' &&
    typeof candidate.station_count === 'number' &&
    typeof candidate.total_time === 'string' &&
    Array.isArray(candidate.legs) &&
    typeof candidate.fare === 'object' &&
    candidate.fare !== null
  );
}

function readAll(): Record<string, StoredRoute> {
  return readJson<Record<string, StoredRoute>>(STORAGE_KEY) ?? {};
}

export const popularRoutesRepository = {
  buildRouteKey,

  async savePlannedJourney(
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
    plan: PlannedJourney,
    scope: JourneyScope = 'dmrc',
  ): Promise<void> {
    const routes = readAll();
    const routeKey = buildRouteKey(fromStationCode, toStationCode, strategy, scope);
    const existing = routes[routeKey];

    routes[routeKey] = {
      routeKey,
      fromStationCode: fromStationCode.trim().toUpperCase(),
      toStationCode: toStationCode.trim().toUpperCase(),
      plan,
      hitCount: (existing?.hitCount ?? 0) + 1,
      lastFetchedAt: Date.now(),
    };

    writeJson(STORAGE_KEY, routes);
  },

  async getPlannedJourney(
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
    scope: JourneyScope = 'dmrc',
  ): Promise<PlannedJourney | null> {
    const stored = readAll()[buildRouteKey(fromStationCode, toStationCode, strategy, scope)];
    if (!stored || !isPlannedJourney(stored.plan)) {
      return null;
    }
    return stored.plan;
  },

  /**
   * Most-planned routes across every network, mirroring the native query:
   * strategy variants of one origin/destination pair collapse into a single
   * entry whose hit count is their total.
   */
  async getPopularRoutes(limit = 5): Promise<PopularRouteEntry[]> {
    const byPair = new Map<string, PopularRouteEntry>();

    for (const route of Object.values(readAll())) {
      const pairKey = `${route.fromStationCode}_${route.toStationCode}`;
      const existing = byPair.get(pairKey);
      if (existing) {
        existing.hitCount += route.hitCount;
        existing.lastFetchedAt = Math.max(existing.lastFetchedAt, route.lastFetchedAt);
        existing.routeKey =
          route.routeKey < existing.routeKey ? route.routeKey : existing.routeKey;
      } else {
        byPair.set(pairKey, {
          routeKey: route.routeKey,
          fromStationCode: route.fromStationCode,
          toStationCode: route.toStationCode,
          hitCount: route.hitCount,
          lastFetchedAt: route.lastFetchedAt,
        });
      }
    }

    return [...byPair.values()]
      .sort((a, b) => b.hitCount - a.hitCount || b.lastFetchedAt - a.lastFetchedAt)
      .slice(0, limit);
  },
};
