import { getDb } from './database';
import type { JourneyPlan, PopularRouteEntry, PopularRouteRecord } from '../types';

function buildRouteKey(fromStationCode: string, toStationCode: string): string {
  return `${fromStationCode.trim().toUpperCase()}_${toStationCode.trim().toUpperCase()}`;
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

export const popularRoutesRepository = {
  buildRouteKey,

  async saveJourneyPlan(
    fromStationCode: string,
    toStationCode: string,
    plan: JourneyPlan,
  ): Promise<void> {
    const db = await getDb();
    const routeKey = buildRouteKey(fromStationCode, toStationCode);
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

  async getJourneyPlan(
    fromStationCode: string,
    toStationCode: string,
  ): Promise<JourneyPlan | null> {
    const db = await getDb();
    const routeKey = buildRouteKey(fromStationCode, toStationCode);

    const row = await db.getFirstAsync<PopularRouteRecord>(
      'SELECT * FROM popular_routes WHERE route_key = ? LIMIT 1',
      [routeKey],
    );

    if (!row) {
      return null;
    }

    return JSON.parse(row.payload_json) as JourneyPlan;
  },

  async getPopularRoutes(limit = 5): Promise<PopularRouteEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<PopularRouteRecord>(
      `
      SELECT *
      FROM popular_routes
      ORDER BY hit_count DESC, last_fetched_at DESC
      LIMIT ?
      `,
      [limit],
    );
    return rows.map(toEntry);
  },
};
