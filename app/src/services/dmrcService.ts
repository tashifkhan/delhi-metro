import type { ApiClient } from '../api/client';
import { catalogCache, type Cached } from '../storage/catalogCache';
import { asSearchResult, toStoredStation } from '../storage/stationCatalog';
import { popularRoutesRepository } from '../storage/popularRoutesRepository';
import { stationSearchCacheRepository } from '../storage/stationSearchCacheRepository';
import type {
  FirstLastTrainResponse,
  JourneyFareWithRoute,
  JourneyScope,
  MetroLine,
  PassengerNotification,
  PassengerNotificationDetail,
  PlannedJourney,
  RouteStrategy,
  WhatsAppBooking,
  StationByLineItem,
  StationDetail,
  StationSearchResult,
} from '../types';
import type { MetroNetwork } from '../network';

const API_V1 = '/api/v1';
const API_V2 = '/api/v2';

export interface JourneyRequest {
  fromStationCode: string;
  toStationCode: string;
  strategy: RouteStrategy;
  journeyTime?: string;
}

export interface PlanJourneyRequest {
  fromStationCode: string;
  toStationCode: string;
  strategy: RouteStrategy;
  journeyTime?: string;
  excludeAirportLine?: boolean;
  /** Pin to one upstream instead of the Sarthi → DMRC fallback chain. */
  source?: 'sarthi' | 'dmrc' | 'nmrc';
  /**
   * Network hint. The API resolves the network from the station codes, so
   * this only decides journeys whose codes it cannot resolve.
   */
  network?: MetroNetwork;
  /** Local-cache scope, which is `combined` for a cross-network journey. */
  scope?: JourneyScope;
}

/** A stored document, marked as an offline copy. `null` when nothing is stored. */
function asCached<T>(
  document: { payload: T; savedAt: number } | null,
): Cached<T> | null {
  if (!document) return null;
  return { data: document.payload, savedAt: document.savedAt, fromCache: true };
}

export class DmrcService {
  constructor(private readonly apiClient: ApiClient) {}

  private networkPath(network: MetroNetwork): string {
    return `${API_V1}/${network}`;
  }

  getCachedLinesFor(network: MetroNetwork): Promise<Cached<MetroLine[]> | null> {
    return catalogCache.readLines(network).then(asCached);
  }

  /** Both networks' stored line lists, merged the same way a live fetch merges them. */
  async getCachedLines(): Promise<Cached<MetroLine[]> | null> {
    const order: MetroNetwork[] = ['dmrc', 'nmrc'];
    const stored = await Promise.all(
      order.map((network) => catalogCache.readLines(network)),
    );

    const lines: MetroLine[] = [];
    let savedAt = 0;
    for (const [index, document] of stored.entries()) {
      if (!document) continue;
      lines.push(...document.payload.map((line) => ({ ...line, network: order[index] })));
      savedAt = Math.max(savedAt, document.savedAt);
    }
    if (lines.length === 0) return null;
    return { data: lines, savedAt, fromCache: true };
  }

  getLines(
    network: MetroNetwork = 'dmrc',
    shown?: Cached<MetroLine[]>,
  ): Promise<Cached<MetroLine[]>> {
    return catalogCache.lines(
      network,
      () => this.apiClient.get<MetroLine[]>(`${this.networkPath(network)}/lines`),
      shown,
    );
  }

  /**
   * Every line on both networks, tagged with its operator.
   *
   * Fetched independently so one operator being down still lists the other's
   * lines, matching how station search behaves. A stored copy stands in for
   * whichever operator cannot be reached.
   */
  async getAllLinesAcrossNetworks(
    shown?: Cached<MetroLine[]>,
  ): Promise<Cached<MetroLine[]>> {
    const order: MetroNetwork[] = ['dmrc', 'nmrc'];
    const results = await Promise.allSettled(
      order.map((network) => {
        const half = shown?.data.filter((line) => line.network === network);
        const current =
          shown && !shown.fromCache && half && half.length > 0
            ? { data: half, savedAt: shown.savedAt, fromCache: false }
            : undefined;
        return this.getLines(network, current);
      }),
    );

    const lines: MetroLine[] = [];
    let fromCache = false;
    let savedAt = 0;
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        lines.push(
          ...result.value.data.map((line) => ({ ...line, network: order[index] })),
        );
        fromCache = fromCache || result.value.fromCache;
        savedAt = Math.max(savedAt, result.value.savedAt);
      }
    }

    if (lines.length === 0 && results[0].status === 'rejected') {
      throw results[0].reason;
    }
    return { data: lines, savedAt, fromCache };
  }

  getCachedNotifications(
    network: MetroNetwork = 'dmrc',
  ): Promise<Cached<PassengerNotification[]> | null> {
    return catalogCache.readNotifications(network).then(asCached);
  }

  getNotifications(
    network: MetroNetwork = 'dmrc',
    shown?: Cached<PassengerNotification[]>,
  ): Promise<Cached<PassengerNotification[]>> {
    return catalogCache.notifications(
      network,
      () =>
        this.apiClient.get<PassengerNotification[]>(
          `${this.networkPath(network)}/notifications`,
        ),
      shown,
    );
  }

  getCachedNotificationDetail(
    pageSlug: string,
  ): Promise<Cached<PassengerNotificationDetail> | null> {
    return catalogCache.readNotificationDetail(pageSlug).then(asCached);
  }

  getNotificationDetail(
    pageSlug: string,
    shown?: Cached<PassengerNotificationDetail>,
  ): Promise<Cached<PassengerNotificationDetail>> {
    return catalogCache.notificationDetail(
      pageSlug,
      () =>
        this.apiClient.get<PassengerNotificationDetail>(
          `${API_V1}/dmrc/notifications/${encodeURIComponent(pageSlug)}`,
        ),
      shown,
    );
  }

  searchStations(
    query: string,
    network: MetroNetwork = 'dmrc',
  ): Promise<StationSearchResult[]> {
    return this.apiClient.get<StationSearchResult[]>(
      `${this.networkPath(network)}/stations/search`,
      {
      query: {
        query,
        filter: 'all',
      },
      },
    );
  }

  getCachedStations(network: MetroNetwork = 'dmrc'): Promise<StationSearchResult[] | null> {
    return stationSearchCacheRepository.getStations(network);
  }

  async getAllStationsAndRefreshCache(
    network: MetroNetwork = 'dmrc',
  ): Promise<StationSearchResult[]> {
    const cachedStations = await stationSearchCacheRepository.getStations(network);

    try {
      const stations = await this.searchStations('', network);
      const stored = stations.map(toStoredStation);
      await stationSearchCacheRepository.saveStations(stations, network);
      // The stored copy drops the facility lists, which no search screen
      // renders. Returning that shape keeps memory in line with the disk.
      return stored.map(asSearchResult);
    } catch (error) {
      if (cachedStations) {
        return cachedStations;
      }
      throw error;
    }
  }

  /**
   * Every station on both networks, tagged with the operator that publishes it.
   *
   * Search is network-agnostic, so the order is fixed rather than following a
   * selected network. The two catalogs are fetched independently, so one
   * operator being down still leaves the other searchable.
   */
  async getAllStationsAcrossNetworks(): Promise<StationSearchResult[]> {
    const order: MetroNetwork[] = ['dmrc', 'nmrc'];

    const results = await Promise.allSettled(
      order.map((network) => this.getAllStationsAndRefreshCache(network)),
    );

    const stations: StationSearchResult[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        stations.push(
          ...result.value.map((station) => ({ ...station, network: order[index] })),
        );
      }
    }

    if (stations.length === 0 && results[0].status === 'rejected') {
      throw results[0].reason;
    }
    return stations;
  }

  getFareRoute(request: JourneyRequest): Promise<JourneyFareWithRoute> {
    return this.apiClient.get<JourneyFareWithRoute>(`${API_V1}/dmrc/journeys/fare-route`, {
      query: {
        from_station_code: request.fromStationCode,
        to_station_code: request.toStationCode,
        strategy: request.strategy,
        journey_time: request.journeyTime,
      },
    });
  }

  getFirstLastTrain(request: JourneyRequest): Promise<FirstLastTrainResponse> {
    return this.apiClient.get<FirstLastTrainResponse>(
      `${API_V1}/dmrc/journeys/first-last-train`,
      {
        query: {
          from_station_code: request.fromStationCode,
          to_station_code: request.toStationCode,
          strategy: request.strategy,
        },
      },
    );
  }

  /**
   * Plan one journey via the v2 planner (Sarthi first, DMRC fallback).
   * Station codes may be in either upstream's vocabulary.
   */
  /** The operator's WhatsApp ticket link. Stations are not included. */
  getBooking(network: MetroNetwork): Promise<WhatsAppBooking> {
    return this.apiClient.get<WhatsAppBooking>(`${API_V1}/${network}/booking`);
  }

  planJourney(request: PlanJourneyRequest): Promise<PlannedJourney> {
    return this.apiClient.get<PlannedJourney>(`${API_V2}/journeys/plan`, {
      query: {
        from_station_code: request.fromStationCode,
        to_station_code: request.toStationCode,
        strategy: request.strategy,
        journey_time: request.journeyTime,
        exclude_airport_line: request.excludeAirportLine ?? false,
        source: request.source,
        network: request.network ?? 'dmrc',
      },
    });
  }

  /**
   * Plan a journey, keeping the last successful plan for this route.
   *
   * A journey time is a "what if I leave later" question, and a stored answer
   * to it would be about a moment that has passed, so those stay live. Every
   * other plan is stored and returned again when the network fails.
   */
  async planJourneyWithLocalCache(
    request: PlanJourneyRequest,
    shown?: Cached<PlannedJourney>,
  ): Promise<Cached<PlannedJourney>> {
    if (request.journeyTime) {
      const plan = await this.planJourney(request);
      return { data: plan, savedAt: Date.now(), fromCache: false };
    }

    const scope = request.scope ?? request.network ?? 'dmrc';
    try {
      const plan = await this.planJourney(request);
      const savedAt = Date.now();
      await popularRoutesRepository.savePlannedJourney(
        request.fromStationCode,
        request.toStationCode,
        request.strategy,
        plan,
        scope,
      );
      return { data: plan, savedAt, fromCache: false };
    } catch (error) {
      // Keep the plan already on screen rather than swapping in an older
      // stored one and calling it offline.
      if (shown && !shown.fromCache) return shown;

      const cached = await popularRoutesRepository.getPlannedJourney(
        request.fromStationCode,
        request.toStationCode,
        request.strategy,
        scope,
      );
      if (cached) {
        return { data: cached.plan, savedAt: cached.savedAt ?? 0, fromCache: true };
      }
      throw error;
    }
  }

  async getPopularRoutes(limit = 5) {
    return popularRoutesRepository.getPopularRoutes(limit);
  }

  getCachedStationsByLine(
    lineCode: string,
    network: MetroNetwork = 'dmrc',
  ): Promise<Cached<StationByLineItem[]> | null> {
    return catalogCache.readStationsByLine(network, lineCode).then(asCached);
  }

  getStationsByLine(
    lineCode: string,
    network: MetroNetwork = 'dmrc',
    shown?: Cached<StationByLineItem[]>,
  ): Promise<Cached<StationByLineItem[]>> {
    return catalogCache.stationsByLine(
      network,
      lineCode,
      () =>
        this.apiClient.get<StationByLineItem[]>(
          `${this.networkPath(network)}/lines/${lineCode}/stations`,
        ),
      shown,
    );
  }

  getCachedStationDetail(
    stationCode: string,
    network: MetroNetwork = 'dmrc',
  ): Promise<Cached<StationDetail> | null> {
    return catalogCache.readStationDetail(network, stationCode).then(asCached);
  }

  getStationDetail(
    stationCode: string,
    network: MetroNetwork = 'dmrc',
    shown?: Cached<StationDetail>,
  ): Promise<Cached<StationDetail>> {
    return catalogCache.stationDetail(
      network,
      stationCode,
      () =>
        this.apiClient.get<StationDetail>(
          `${this.networkPath(network)}/stations/${stationCode}`,
        ),
      shown,
    );
  }
}
