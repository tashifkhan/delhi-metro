import type { JourneyScope, MapFamily, MapFormat, RouteStrategy } from '../types';
import type { MetroNetwork } from '../network';

export const queryKeys = {
  lines: (network: MetroNetwork) => [network, 'lines'] as const,
  /** Both operators' line catalogs merged. */
  linesUnified: () => ['lines-unified'] as const,
  notifications: (network: MetroNetwork) => [network, 'notifications'] as const,
  notificationDetail: (network: MetroNetwork, pageSlug: string) =>
    [network, 'notifications', 'detail', pageSlug] as const,
  stationsAll: (network: MetroNetwork) => [network, 'stations-all'] as const,
  /** Both operators' catalogs merged; independent of the selected network. */
  stationsUnified: () => ['stations-unified'] as const,
  stationsCache: (network: MetroNetwork) => [network, 'stations-cache'] as const,
  stationsSearch: (network: MetroNetwork, query: string) =>
    [network, 'stations-search', query] as const,
  fareRoute: (
    scope: JourneyScope,
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
  ) => [scope, 'fare-route', fromStationCode, toStationCode, strategy] as const,
  firstLastTrain: (
    scope: JourneyScope,
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
  ) => [scope, 'first-last-train', fromStationCode, toStationCode, strategy] as const,
  journeyPlan: (
    scope: JourneyScope,
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
    journeyTime?: string,
  ) =>
    [
      scope,
      'journey-plan',
      fromStationCode,
      toStationCode,
      strategy,
      journeyTime ?? 'now',
    ] as const,
  journeyPlanCached: (
    scope: JourneyScope,
    fromStationCode: string,
    toStationCode: string,
    strategy: RouteStrategy,
    journeyTime?: string,
  ) =>
    [
      scope,
      'journey-plan-cached',
      fromStationCode,
      toStationCode,
      strategy,
      journeyTime ?? 'now',
    ] as const,
  popularRoutes: (limit: number) => ['popular-routes', limit] as const,
  mapAssets: (network: MetroNetwork) => [network, 'maps', 'assets'] as const,
  mapFamilyAssets: (network: MetroNetwork, family: MapFamily, format: MapFormat) =>
    [network, 'maps', 'family-assets', family, format] as const,
  mapFamilyPrimary: (network: MetroNetwork, family: MapFamily) =>
    [network, 'maps', 'family-primary', family] as const,
  mapAssetById: (network: MetroNetwork, assetId: string) =>
    [network, 'maps', 'asset-by-id', assetId] as const,
  stationsByLine: (network: MetroNetwork, lineCode: string) =>
    [network, 'stations-by-line', lineCode] as const,
  stationDetail: (network: MetroNetwork, stationCode: string) =>
    [network, 'station-detail', stationCode] as const,
};
