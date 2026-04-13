import { getDb } from './database';
import type { StationSearchResult } from '../types';

const STATIONS_CACHE_KEY = 'stations-all-v1';

interface StationSearchCacheRow {
  cache_key: string;
  payload_json: string;
  last_updated_at: number;
}

export const stationSearchCacheRepository = {
  async saveStations(stations: StationSearchResult[]): Promise<void> {
    const db = await getDb();
    const payloadJson = JSON.stringify(stations);
    const timestamp = Date.now();

    await db.runAsync(
      `
      INSERT INTO station_search_cache (cache_key, payload_json, last_updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(cache_key)
      DO UPDATE SET
        payload_json = excluded.payload_json,
        last_updated_at = excluded.last_updated_at
      `,
      [STATIONS_CACHE_KEY, payloadJson, timestamp],
    );
  },

  async getStations(): Promise<StationSearchResult[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<StationSearchCacheRow>(
      'SELECT * FROM station_search_cache WHERE cache_key = ? LIMIT 1',
      [STATIONS_CACHE_KEY],
    );

    if (!row) {
      return null;
    }

    try {
      return JSON.parse(row.payload_json) as StationSearchResult[];
    } catch {
      return null;
    }
  },
};
