export interface PopularRouteRecord {
  route_key: string;
  from_station_code: string;
  to_station_code: string;
  payload_json: string;
  hit_count: number;
  last_fetched_at: number;
}

export interface PopularRouteEntry {
  routeKey: string;
  fromStationCode: string;
  toStationCode: string;
  hitCount: number;
  lastFetchedAt: number;
}
