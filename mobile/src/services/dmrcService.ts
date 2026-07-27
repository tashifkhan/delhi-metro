import type { ApiClient } from '../api/client';
import { popularRoutesRepository } from '../storage/popularRoutesRepository';
import { stationSearchCacheRepository } from '../storage/stationSearchCacheRepository';
import type {
  FirstLastTrainResponse,
  JourneyFareWithRoute,
  MetroLine,
  PassengerNotification,
  PassengerNotificationDetail,
  PlannedJourney,
  RouteStrategy,
  StationByLineItem,
  StationDetail,
  StationSearchResult,
} from '../types';

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
  source?: 'sarthi' | 'dmrc';
}

export class DmrcService {
  constructor(private readonly apiClient: ApiClient) {}

  getLines(): Promise<MetroLine[]> {
    return this.apiClient.get<MetroLine[]>(`${API_V1}/dmrc/lines`);
  }

  getNotifications(): Promise<PassengerNotification[]> {
    return this.apiClient.get<PassengerNotification[]>(`${API_V1}/dmrc/notifications`);
  }

  getNotificationDetail(pageSlug: string): Promise<PassengerNotificationDetail> {
    return this.apiClient.get<PassengerNotificationDetail>(
      `${API_V1}/dmrc/notifications/${encodeURIComponent(pageSlug)}`,
    );
  }

  searchStations(query: string): Promise<StationSearchResult[]> {
    return this.apiClient.get<StationSearchResult[]>(`${API_V1}/dmrc/stations/search`, {
      query: {
        query,
        filter: 'all',
      },
    });
  }

  getCachedStations(): Promise<StationSearchResult[] | null> {
    return stationSearchCacheRepository.getStations();
  }

  async getAllStationsAndRefreshCache(): Promise<StationSearchResult[]> {
    const cachedStations = await stationSearchCacheRepository.getStations();

    try {
      const stations = await this.searchStations('');
      await stationSearchCacheRepository.saveStations(stations);
      return stations;
    } catch (error) {
      if (cachedStations) {
        return cachedStations;
      }
      throw error;
    }
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
      );
      return plan;
    } catch (error) {
      const cached = await popularRoutesRepository.getPlannedJourney(
        request.fromStationCode,
        request.toStationCode,
        request.strategy,
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

  getStationsByLine(lineCode: string): Promise<StationByLineItem[]> {
    return this.apiClient.get<StationByLineItem[]>(
      `${API_V1}/dmrc/lines/${lineCode}/stations`,
    );
  }

  getStationDetail(stationCode: string): Promise<StationDetail> {
    return this.apiClient.get<StationDetail>(`${API_V1}/dmrc/stations/${stationCode}`);
  }
}
