import { useQuery } from '@tanstack/react-query';

import { dmrcService } from '../services/dmrcService';
import type { RouteStrategy } from '../types';
import { queryKeys } from './queryKeys';

export function useMetroLinesQuery() {
  return useQuery({
    queryKey: queryKeys.lines,
    queryFn: () => dmrcService.getLines(),
  });
}

export function useNotificationsQuery() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => dmrcService.getNotifications(),
  });
}

export function useStationSearchQuery(query: string) {
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
  return useQuery({
    queryKey: queryKeys.journeyPlan(fromStationCode, toStationCode),
    queryFn: () => dmrcService.getJourneyPlan(fromStationCode, toStationCode),
    enabled: fromStationCode.length > 1 && toStationCode.length > 1,
  });
}
