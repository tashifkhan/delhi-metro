import { readJson, writeJson } from './webStore';
import type { StationSearchResult } from '../types';
import type { MetroNetwork } from '../network';

function stationsCacheKey(network: MetroNetwork): string {
  return `dmrc:stations-all-v2-${network}`;
}

export const stationSearchCacheRepository = {
  async saveStations(
    stations: StationSearchResult[],
    network: MetroNetwork = 'dmrc',
  ): Promise<void> {
    writeJson(stationsCacheKey(network), stations);
  },

  async getStations(network: MetroNetwork = 'dmrc'): Promise<StationSearchResult[] | null> {
    return readJson<StationSearchResult[]>(stationsCacheKey(network));
  },
};
