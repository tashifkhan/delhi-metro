import type { MapFamily, MapFormat, RouteStrategy } from '../types';

export const queryKeys = {
  lines: ['dmrc', 'lines'] as const,
  notifications: ['dmrc', 'notifications'] as const,
  stationsAll: ['dmrc', 'stations-all'] as const,
  stationsCache: ['dmrc', 'stations-cache'] as const,
  stationsSearch: (query: string) => ['dmrc', 'stations-search', query] as const,
  fareRoute: (fromStationCode: string, toStationCode: string, strategy: RouteStrategy) =>
    ['dmrc', 'fare-route', fromStationCode, toStationCode, strategy] as const,
  firstLastTrain: (fromStationCode: string, toStationCode: string, strategy: RouteStrategy) =>
    ['dmrc', 'first-last-train', fromStationCode, toStationCode, strategy] as const,
  journeyPlan: (fromStationCode: string, toStationCode: string, journeyTime?: string) =>
    ['dmrc', 'journey-plan', fromStationCode, toStationCode, journeyTime ?? 'now'] as const,
  journeyPlanCached: (fromStationCode: string, toStationCode: string, journeyTime?: string) =>
    [
      'dmrc',
      'journey-plan-cached',
      fromStationCode,
      toStationCode,
      journeyTime ?? 'now',
    ] as const,
  popularRoutes: (limit: number) => ['dmrc', 'popular-routes', limit] as const,
  mapAssets: ['dmrc', 'maps', 'assets'] as const,
  mapFamilyAssets: (family: MapFamily, format: MapFormat) =>
    ['dmrc', 'maps', 'family-assets', family, format] as const,
  mapFamilyPrimary: (family: MapFamily) => ['dmrc', 'maps', 'family-primary', family] as const,
  mapAssetById: (assetId: string) => ['dmrc', 'maps', 'asset-by-id', assetId] as const,
  stationsByLine: (lineCode: string) => ['dmrc', 'stations-by-line', lineCode] as const,
  stationDetail: (stationCode: string) => ['dmrc', 'station-detail', stationCode] as const,
};
