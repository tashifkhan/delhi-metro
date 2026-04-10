import { useQuery } from '@tanstack/react-query';

import { useDI } from '../di/DIContext';
import type { RouteStrategy } from '../types';
import { queryKeys } from './queryKeys';

export function useMetroLinesQuery() {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.lines,
    queryFn: () => dmrcService.getLines(),
  });
}

export function useNotificationsQuery() {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => dmrcService.getNotifications(),
  });
}

export function useStationSearchQuery(query: string) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.stationsSearch(query),
    queryFn: () => dmrcService.searchStations(query),
    enabled: query.trim().length > 1,
  });
}

export function useFareRouteQuery(
  fromStationCode: string,
  toStationCode: string,
  strategy: RouteStrategy,
) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.fareRoute(fromStationCode, toStationCode, strategy),
    queryFn: () =>
      dmrcService.getFareRoute({
        fromStationCode,
        toStationCode,
        strategy,
      }),
    enabled: fromStationCode.length > 1 && toStationCode.length > 1,
  });
}

export function useFirstLastTrainQuery(
  fromStationCode: string,
  toStationCode: string,
  strategy: RouteStrategy,
) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.firstLastTrain(fromStationCode, toStationCode, strategy),
    queryFn: () =>
      dmrcService.getFirstLastTrain({
        fromStationCode,
        toStationCode,
        strategy,
      }),
    enabled: fromStationCode.length > 1 && toStationCode.length > 1,
  });
}

export function useJourneyPlanQuery(fromStationCode: string, toStationCode: string) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.journeyPlan(fromStationCode, toStationCode),
    queryFn: () => dmrcService.getJourneyPlan(fromStationCode, toStationCode),
    enabled: fromStationCode.length > 1 && toStationCode.length > 1,
  });
}

export function useJourneyPlanCachedQuery(fromStationCode: string, toStationCode: string) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.journeyPlanCached(fromStationCode, toStationCode),
    queryFn: () => dmrcService.getJourneyPlanWithLocalCache(fromStationCode, toStationCode),
    enabled: fromStationCode.length > 1 && toStationCode.length > 1,
    staleTime: 2 * 60_000,
  });
}

export function usePopularRoutesQuery(limit = 5) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.popularRoutes(limit),
    queryFn: () => dmrcService.getPopularRoutes(limit),
  });
}

export function useStationsByLineQuery(lineCode: string) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.stationsByLine(lineCode),
    queryFn: () => dmrcService.getStationsByLine(lineCode),
    enabled: lineCode.trim().length > 0,
  });
}

export function useStationDetailQuery(stationCode: string) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.stationDetail(stationCode),
    queryFn: () => dmrcService.getStationDetail(stationCode),
    enabled: stationCode.trim().length > 0,
  });
}
