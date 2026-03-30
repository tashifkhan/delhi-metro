import type { MapFamily, MapFormat, RouteStrategy } from '../types';

export const queryKeys = {
  lines: ['dmrc', 'lines'] as const,
  notifications: ['dmrc', 'notifications'] as const,
  stationsSearch: (query: string) => ['dmrc', 'stations-search', query] as const,
  fareRoute: (fromStationCode: string, toStationCode: string, strategy: RouteStrategy) =>
    ['dmrc', 'fare-route', fromStationCode, toStationCode, strategy] as const,
  firstLastTrain: (fromStationCode: string, toStationCode: string, strategy: RouteStrategy) =>
    ['dmrc', 'first-last-train', fromStationCode, toStationCode, strategy] as const,
  journeyPlan: (fromStationCode: string, toStationCode: string) =>
    ['dmrc', 'journey-plan', fromStationCode, toStationCode] as const,
  mapAssets: ['dmrc', 'maps', 'assets'] as const,
  mapFamilyAssets: (family: MapFamily, format: MapFormat) =>
    ['dmrc', 'maps', 'family-assets', family, format] as const,
  mapFamilyPrimary: (family: MapFamily) => ['dmrc', 'maps', 'family-primary', family] as const,
  mapAssetById: (assetId: string) => ['dmrc', 'maps', 'asset-by-id', assetId] as const,
};
