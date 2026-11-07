import type { StationLineBadge, StationSearchResult } from '../types';

/**
 * What search and the journey planner read from a station.
 *
 * The search endpoint also returns every facility at the station, with an
 * image URL each. Nothing in search, the picker, or the route list renders
 * that, and the station page fetches its own copy. Keeping it meant writing
 * and parsing a few hundred kilobytes on every launch for data no screen uses.
 */
export interface StoredStation {
  id: number;
  station_name: string;
  station_code: string;
  metro_lines: StationLineBadge[];
  network?: StationSearchResult['network'];
}

export function toStoredStation(station: StationSearchResult): StoredStation {
  return {
    id: station.id,
    station_name: station.station_name,
    station_code: station.station_code,
    metro_lines: station.metro_lines,
    network: station.network,
  };
}

/** Search results and stored rows share the fields the list renders. */
export function asSearchResult(station: StoredStation): StationSearchResult {
  return { ...station, station_facility: [] };
}
