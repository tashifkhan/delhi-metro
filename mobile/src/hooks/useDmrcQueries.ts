import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDI } from '../di/DIContext';
import type {
  JourneyScope,
  MetroNetwork,
  RouteStrategy,
  StationSearchResult,
} from '../types';
import { queryKeys } from './queryKeys';
import { useMetroNetwork } from '../network';

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

/**
 * Every station on both networks.
 *
 * Station search and journey planning are network-agnostic: a journey can run
 * from a Delhi Metro station to a Noida Metro one, and the API stitches those
 * together through the Sector 52/51 interchange. This query is therefore
 * deliberately independent of the selected network, which only scopes alerts
 * and the map.
 */
function useAllStationsQuery() {
  const { dmrcService } = useDI();

  // Seeded from the DMRC cache because it is the larger catalog and the one
  // most likely to be present offline; NMRC stations join when the fetch lands.
  const cachedStationsQuery = useQuery({
    queryKey: queryKeys.stationsCache('dmrc'),
    queryFn: () => dmrcService.getCachedStations('dmrc'),
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: queryKeys.stationsUnified(),
    queryFn: () => dmrcService.getAllStationsAcrossNetworks(),
    enabled: !cachedStationsQuery.isPending,
    initialData: () =>
      cachedStationsQuery.data?.map((station) => ({
        ...station,
        network: 'dmrc' as const,
      })) ?? undefined,
    // The seed is only the DMRC half, so it must count as stale from the
    // start. Without this, `staleTime` would treat the partial list as fresh
    // and the NMRC catalog would never be fetched.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * Resolve a station code to the network that publishes it.
 *
 * Journeys are keyed and cached by the networks they touch, and the API needs
 * a network hint for codes it cannot resolve, so both come from the catalog
 * rather than from pattern-matching the code.
 */
export function useStationNetworkLookup() {
  const { data: stations } = useAllStationsQuery();

  return useMemo(() => {
    const byCode = new Map<string, MetroNetwork>();
    for (const station of stations ?? []) {
      if (station.network) {
        byCode.set(station.station_code.trim().toUpperCase(), station.network);
      }
    }
    return (code: string): MetroNetwork | undefined =>
      byCode.get(code.trim().toUpperCase());
  }, [stations]);
}

/**
 * Which network(s) a journey runs on, used for cache keys and for the API's
 * network hint. Derived only from the stations themselves, so planning never
 * depends on a selected network.
 */
export function useJourneyNetworks(fromStationCode: string, toStationCode: string) {
  const networkOf = useStationNetworkLookup();

  return useMemo(() => {
    const from = networkOf(fromStationCode);
    const to = networkOf(toStationCode);
    const scope: JourneyScope =
      from && to && from !== to ? 'combined' : (from ?? to ?? 'dmrc');

    return {
      scope,
      // The API detects the network from resolvable codes; this only matters
      // when a code is absent from both catalogs.
      hint: from ?? to ?? 'dmrc',
      isCrossNetwork: scope === 'combined',
    };
  }, [fromStationCode, toStationCode, networkOf]);
}

/**
 * Every line on both networks.
 *
 * Browsing lines is network-agnostic for the same reason search is: the Aqua
 * Line is part of the network a rider actually uses, not a separate app mode.
 */
export function useMetroLinesQuery() {
  const { dmrcService } = useDI();
  return useQuery({
    queryKey: queryKeys.linesUnified(),
    queryFn: () => dmrcService.getAllLinesAcrossNetworks(),
  });
}

/** Lines for one operator, for the network-scoped alerts page. */
export function useNetworkLinesQuery() {
  const { dmrcService } = useDI();
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.lines(network),
    queryFn: () => dmrcService.getLines(network),
  });
}

/** Resolve a line code to the network that runs it. */
export function useLineNetworkLookup() {
  const { data: lines } = useMetroLinesQuery();

  return useMemo(() => {
    const byCode = new Map<string, MetroNetwork>();
    for (const line of lines ?? []) {
      if (line.network) {
        byCode.set(line.line_code.trim().toUpperCase(), line.network);
      }
    }
    return (code: string): MetroNetwork | undefined =>
      byCode.get(code.trim().toUpperCase());
  }, [lines]);
}

export function useNotificationsQuery() {
  const { dmrcService } = useDI();
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.notifications(network),
    queryFn: () => dmrcService.getNotifications(network),
  });
}

export function useNotificationDetailQuery(
  pageSlug: string | null,
  enabled: boolean,
) {
  const { dmrcService } = useDI();
  const { network } = useMetroNetwork();

  return useQuery({
    queryKey: queryKeys.notificationDetail(network, pageSlug ?? ''),
    queryFn: () => {
      if (pageSlug === null) {
        throw new Error('Notification detail slug is unavailable');
      }
      return dmrcService.getNotificationDetail(pageSlug);
    },
    enabled: enabled && pageSlug !== null,
    staleTime: 30 * 60_000,
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
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.fareRoute(network, fromStationCode, toStationCode, strategy),
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
  const { network } = useMetroNetwork();
  return useQuery({
    queryKey: queryKeys.firstLastTrain(network, fromStationCode, toStationCode, strategy),
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
  strategy: RouteStrategy,
  journeyTime?: string,
) {
  const { dmrcService } = useDI();
  const { scope, hint } = useJourneyNetworks(fromStationCode, toStationCode);
  return useQuery({
    queryKey: queryKeys.journeyPlan(
      scope,
      fromStationCode,
      toStationCode,
      strategy,
      journeyTime,
    ),
    queryFn: () =>
      dmrcService.planJourney({
        fromStationCode,
        toStationCode,
        strategy,
        journeyTime,
        network: hint,
      }),
    enabled: fromStationCode.length > 1 && toStationCode.length > 1,
  });
}

export function useJourneyPlanCachedQuery(
  fromStationCode: string,
  toStationCode: string,
  strategy: RouteStrategy,
  journeyTime?: string,
) {
  const { dmrcService } = useDI();
  const { scope, hint } = useJourneyNetworks(fromStationCode, toStationCode);
  return useQuery({
    queryKey: queryKeys.journeyPlanCached(
      scope,
      fromStationCode,
      toStationCode,
      strategy,
      journeyTime,
    ),
    queryFn: () =>
      dmrcService.planJourneyWithLocalCache({
        fromStationCode,
        toStationCode,
        strategy,
        journeyTime,
        network: hint,
        scope,
      }),
    enabled: fromStationCode.length > 1 && toStationCode.length > 1,
    staleTime: 2 * 60_000,
    // Keep the last strategy's plan on screen while the other strategy loads.
    placeholderData: keepPreviousData,
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
  const { network: selectedNetwork } = useMetroNetwork();
  const networkOf = useLineNetworkLookup();

  // The line list spans operators, so the line itself decides where its
  // stations are fetched from.
  const network = networkOf(lineCode) ?? selectedNetwork;

  return useQuery({
    queryKey: queryKeys.stationsByLine(network, lineCode),
    queryFn: () => dmrcService.getStationsByLine(lineCode, network),
    enabled: lineCode.trim().length > 0,
  });
}

export function useStationDetailQuery(stationCode: string) {
  const { dmrcService } = useDI();
  const { network: selectedNetwork } = useMetroNetwork();
  const networkOf = useStationNetworkLookup();

  // Search spans both operators, so the station's own network decides where
  // its detail is fetched from — not whichever network happens to be selected.
  const network = networkOf(stationCode) ?? selectedNetwork;

  return useQuery({
    queryKey: queryKeys.stationDetail(network, stationCode),
    queryFn: () => dmrcService.getStationDetail(stationCode, network),
    enabled: stationCode.trim().length > 0,
  });
}
