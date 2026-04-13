import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDI } from '../di/DIContext';
import type { RouteStrategy, StationSearchResult } from '../types';
import { queryKeys } from './queryKeys';

const NON_ALPHANUMERIC_REGEX = /[^A-Z0-9]/g;

function normalizeForFuzzyMatch(value: string): string {
  return value.toUpperCase().replace(NON_ALPHANUMERIC_REGEX, '');
}

function levenshteinDistanceWithinLimit(
  source: string,
  target: string,
  maxDistance: number,
): number | null {
  if (Math.abs(source.length - target.length) > maxDistance) {
    return null;
  }

  const previous = Array.from({ length: target.length + 1 }, (_, index) => index);
  const current = new Array<number>(target.length + 1).fill(0);

  for (let row = 1; row <= source.length; row += 1) {
    current[0] = row;
    let rowMinimum = current[0];

    for (let col = 1; col <= target.length; col += 1) {
      const substitutionCost = source[row - 1] === target[col - 1] ? 0 : 1;
      const insertion = current[col - 1] + 1;
      const deletion = previous[col] + 1;
      const substitution = previous[col - 1] + substitutionCost;

      const value = Math.min(insertion, deletion, substitution);
      current[col] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > maxDistance) {
      return null;
    }

    for (let col = 0; col <= target.length; col += 1) {
      previous[col] = current[col];
    }
  }

  return previous[target.length] <= maxDistance ? previous[target.length] : null;
}

function computeSubsequenceScore(query: string, target: string): number | null {
  let searchStart = 0;
  let firstMatchIndex = -1;
  let previousMatchIndex = -1;
  let totalGaps = 0;
  let currentRun = 0;
  let bestRun = 0;

  for (const character of query) {
    const matchIndex = target.indexOf(character, searchStart);
    if (matchIndex < 0) {
      return null;
    }

    if (firstMatchIndex < 0) {
      firstMatchIndex = matchIndex;
    }

    if (previousMatchIndex >= 0) {
      const gap = matchIndex - previousMatchIndex - 1;
      totalGaps += gap;
      currentRun = gap === 0 ? currentRun + 1 : 0;
      bestRun = Math.max(bestRun, currentRun);
    }

    previousMatchIndex = matchIndex;
    searchStart = matchIndex + 1;
  }

  const score = 72 - firstMatchIndex * 0.35 - totalGaps * 0.5 + bestRun * 2;
  return score >= 45 ? score : null;
}

function computeTypoScore(query: string, value: string): number | null {
  if (query.length < 4) {
    return null;
  }

  const maxDistance = Math.max(1, Math.floor(query.length / 4));
  const tokens = value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((token) => normalizeForFuzzyMatch(token))
    .filter((token) => token.length > 0);

  let bestDistance: number | null = null;

  for (const token of tokens) {
    const distance = levenshteinDistanceWithinLimit(query, token, maxDistance);
    if (distance === null) {
      continue;
    }

    if (bestDistance === null || distance < bestDistance) {
      bestDistance = distance;
      if (bestDistance === 0) {
        break;
      }
    }
  }

  if (bestDistance === null) {
    return null;
  }

  return 58 - bestDistance * 12;
}

function scoreFuzzyCandidate(query: string, candidate: string): number | null {
  const uppercaseCandidate = candidate.toUpperCase();
  const uppercaseQuery = query.toUpperCase();

  if (uppercaseCandidate === uppercaseQuery) {
    return 140;
  }

  if (uppercaseCandidate.startsWith(uppercaseQuery)) {
    return 120 - Math.min(20, uppercaseCandidate.length - uppercaseQuery.length);
  }

  const includesIndex = uppercaseCandidate.indexOf(uppercaseQuery);
  if (includesIndex >= 0) {
    return 95 - Math.min(30, includesIndex);
  }

  const normalizedCandidate = normalizeForFuzzyMatch(uppercaseCandidate);
  const normalizedQuery = normalizeForFuzzyMatch(uppercaseQuery);

  if (!normalizedCandidate || !normalizedQuery) {
    return null;
  }

  if (normalizedCandidate === normalizedQuery) {
    return 130;
  }

  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 112;
  }

  const normalizedIncludesIndex = normalizedCandidate.indexOf(normalizedQuery);
  if (normalizedIncludesIndex >= 0) {
    return 88 - Math.min(28, normalizedIncludesIndex);
  }

  const subsequenceScore = computeSubsequenceScore(normalizedQuery, normalizedCandidate);
  if (subsequenceScore !== null) {
    return subsequenceScore;
  }

  return computeTypoScore(normalizedQuery, candidate);
}

function scoreStation(station: StationSearchResult, query: string): number | null {
  const nameScore = scoreFuzzyCandidate(query, station.station_name);
  const codeScore = scoreFuzzyCandidate(query, station.station_code);

  if (nameScore === null && codeScore === null) {
    return null;
  }

  return Math.max(nameScore ?? Number.NEGATIVE_INFINITY, codeScore ?? Number.NEGATIVE_INFINITY);
}

function filterStations(
  stations: StationSearchResult[] | undefined,
  query: string,
): StationSearchResult[] {
  if (!stations) {
    return [];
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return stations;
  }

  return stations
    .map((station) => ({
      station,
      score: scoreStation(station, normalizedQuery),
    }))
    .filter((entry): entry is { station: StationSearchResult; score: number } => entry.score !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.station.station_name.localeCompare(right.station.station_name);
    })
    .map((entry) => entry.station);
}

function useAllStationsQuery() {
  const { dmrcService } = useDI();

  const cachedStationsQuery = useQuery({
    queryKey: queryKeys.stationsCache,
    queryFn: () => dmrcService.getCachedStations(),
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: queryKeys.stationsAll,
    queryFn: () => dmrcService.getAllStationsAndRefreshCache(),
    enabled: !cachedStationsQuery.isPending,
    initialData: () => cachedStationsQuery.data ?? undefined,
    staleTime: 5 * 60_000,
  });
}

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
  const normalizedQuery = query.trim();
  const allStationsQuery = useAllStationsQuery();

  const filteredResults = useMemo(
    () => filterStations(allStationsQuery.data, normalizedQuery),
    [allStationsQuery.data, normalizedQuery],
  );

  return {
    ...allStationsQuery,
    data: filteredResults,
  };
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

export function useJourneyPlanQuery(
  fromStationCode: string,
  toStationCode: string,
  journeyTime?: string,
) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.journeyPlan(fromStationCode, toStationCode, journeyTime),
    queryFn: () => dmrcService.getJourneyPlan(fromStationCode, toStationCode, journeyTime),
    enabled: fromStationCode.length > 1 && toStationCode.length > 1,
  });
}

export function useJourneyPlanCachedQuery(
  fromStationCode: string,
  toStationCode: string,
  journeyTime?: string,
) {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.journeyPlanCached(fromStationCode, toStationCode, journeyTime),
    queryFn: () =>
      dmrcService.getJourneyPlanWithLocalCache(fromStationCode, toStationCode, journeyTime),
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
