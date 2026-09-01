import type { ApiClient } from '../api/client';
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

export class DmrcService {
  constructor(private readonly apiClient: ApiClient) {}

  private networkPath(network: MetroNetwork): string {
    return `${API_V1}/${network}`;
  }

  getLines(network: MetroNetwork = 'dmrc'): Promise<MetroLine[]> {
    return this.apiClient.get<MetroLine[]>(`${this.networkPath(network)}/lines`);
  }

  /**
   * Every line on both networks, tagged with its operator.
   *
   * Fetched independently so one operator being down still lists the other's
   * lines, matching how station search behaves.
   */
  async getAllLinesAcrossNetworks(): Promise<MetroLine[]> {
    const order: MetroNetwork[] = ['dmrc', 'nmrc'];
    const results = await Promise.allSettled(
      order.map((network) => this.getLines(network)),
    );

    const lines: MetroLine[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        lines.push(...result.value.map((line) => ({ ...line, network: order[index] })));
      }
    }

    if (lines.length === 0 && results[0].status === 'rejected') {
      throw results[0].reason;
    }
    return lines;
  }

  getNotifications(network: MetroNetwork = 'dmrc'): Promise<PassengerNotification[]> {
    return this.apiClient.get<PassengerNotification[]>(
      `${this.networkPath(network)}/notifications`,
    );
  }

  getNotificationDetail(pageSlug: string): Promise<PassengerNotificationDetail> {
    return this.apiClient.get<PassengerNotificationDetail>(
      `${API_V1}/dmrc/notifications/${encodeURIComponent(pageSlug)}`,
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
      await stationSearchCacheRepository.saveStations(stations, network);
      return stations;
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

  async planJourneyWithLocalCache(request: PlanJourneyRequest): Promise<PlannedJourney> {
    if (request.journeyTime) {
      return this.planJourney(request);
    }

    try {
      const plan = await this.planJourney(request);
      await popularRoutesRepository.savePlannedJourney(
        request.fromStationCode,
        request.toStationCode,
        request.strategy,
        plan,
        request.scope ?? request.network ?? 'dmrc',
      );
      return plan;
    } catch (error) {
      const cached = await popularRoutesRepository.getPlannedJourney(
        request.fromStationCode,
        request.toStationCode,
        request.strategy,
        request.scope ?? request.network ?? 'dmrc',
      );
      if (cached) {
        return cached;
      }
      throw error;
    }
  }

  async getPopularRoutes(limit = 5) {
    return popularRoutesRepository.getPopularRoutes(limit);
  }

  getStationsByLine(
    lineCode: string,
    network: MetroNetwork = 'dmrc',
  ): Promise<StationByLineItem[]> {
    return this.apiClient.get<StationByLineItem[]>(
      `${this.networkPath(network)}/lines/${lineCode}/stations`,
    );
  }

  getStationDetail(
    stationCode: string,
    network: MetroNetwork = 'dmrc',
  ): Promise<StationDetail> {
    return this.apiClient.get<StationDetail>(
      `${this.networkPath(network)}/stations/${stationCode}`,
    );
  }
}
