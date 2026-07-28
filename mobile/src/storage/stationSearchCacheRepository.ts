import { getDb } from './database';
import type { StationSearchResult } from '../types';
import type { MetroNetwork } from '../network';

function stationsCacheKey(network: MetroNetwork): string {
  return `stations-all-v2-${network}`;
}

interface StationSearchCacheRow {
  cache_key: string;
  payload_json: string;
  last_updated_at: number;
}

export const stationSearchCacheRepository = {
  async saveStations(
    stations: StationSearchResult[],
    network: MetroNetwork = 'dmrc',
  ): Promise<void> {
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
      [stationsCacheKey(network), payloadJson, timestamp],
    );
  },

  async getStations(network: MetroNetwork = 'dmrc'): Promise<StationSearchResult[] | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<StationSearchCacheRow>(
      'SELECT * FROM station_search_cache WHERE cache_key = ? LIMIT 1',
      [stationsCacheKey(network)],
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
