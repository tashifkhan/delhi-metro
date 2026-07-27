import { getDb } from './database';
import type { PlannedJourney, PopularRouteEntry, PopularRouteRecord, RouteStrategy } from '../types';

function buildRouteKey(
  fromStationCode: string,
  toStationCode: string,
  strategy: RouteStrategy,
): string {
  return `${fromStationCode.trim().toUpperCase()}_${toStationCode.trim().toUpperCase()}_${strategy}`;
}

function toEntry(record: PopularRouteRecord): PopularRouteEntry {
  return {
    routeKey: record.route_key,
    fromStationCode: record.from_station_code,
    toStationCode: record.to_station_code,
    hitCount: record.hit_count,
    lastFetchedAt: record.last_fetched_at,
  };
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

export const popularRoutesRepository = {
  buildRouteKey,

  async savePlannedJourney(
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
    plan: PlannedJourney,
  ): Promise<void> {
    const db = await getDb();
    const routeKey = buildRouteKey(fromStationCode, toStationCode, strategy);
    const fromCode = fromStationCode.trim().toUpperCase();
    const toCode = toStationCode.trim().toUpperCase();
    const payloadJson = JSON.stringify(plan);
    const timestamp = Date.now();

    await db.runAsync(
      `
      INSERT INTO popular_routes (
        route_key,
        from_station_code,
        to_station_code,
        payload_json,
        hit_count,
        last_fetched_at
      )
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(route_key)
      DO UPDATE SET
        payload_json = excluded.payload_json,
        hit_count = popular_routes.hit_count + 1,
        last_fetched_at = excluded.last_fetched_at
      `,
      [routeKey, fromCode, toCode, payloadJson, timestamp],
    );
  },

  async getPlannedJourney(
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
  ): Promise<PlannedJourney | null> {
    const db = await getDb();
    const routeKey = buildRouteKey(fromStationCode, toStationCode, strategy);

    const row = await db.getFirstAsync<PopularRouteRecord>(
      'SELECT * FROM popular_routes WHERE route_key = ? LIMIT 1',
      [routeKey],
    );

    if (!row) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(row.payload_json);
      return isPlannedJourney(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async getPopularRoutes(limit = 5): Promise<PopularRouteEntry[]> {
    const db = await getDb();
    // Collapse strategy variants of the same OD pair so the home list shows
    // unique routes, ordered by total hits across strategies.
    const rows = await db.getAllAsync<PopularRouteRecord>(
      `
      SELECT
        MIN(route_key) AS route_key,
        from_station_code,
        to_station_code,
        '' AS payload_json,
        SUM(hit_count) AS hit_count,
        MAX(last_fetched_at) AS last_fetched_at
      FROM popular_routes
      GROUP BY from_station_code, to_station_code
      ORDER BY hit_count DESC, last_fetched_at DESC
      LIMIT ?
      `,
      [limit],
    );
    return rows.map(toEntry);
  },
};
