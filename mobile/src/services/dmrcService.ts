import type { ApiClient } from '../api/client';
import { popularRoutesRepository } from '../storage/popularRoutesRepository';
import { stationSearchCacheRepository } from '../storage/stationSearchCacheRepository';
import type {
  FirstLastTrainResponse,
  JourneyFareWithRoute,
  JourneyPlan,
  MetroLine,
  PassengerNotification,
  RouteStrategy,
  StationByLineItem,
  StationDetail,
  StationSearchResult,
} from '../types';

export interface JourneyRequest {
  fromStationCode: string;
  toStationCode: string;
  strategy: RouteStrategy;
  journeyTime?: string;
}

export class DmrcService {
  constructor(private readonly apiClient: ApiClient) {}

  getLines(): Promise<MetroLine[]> {
    return this.apiClient.get<MetroLine[]>('/dmrc/lines');
  }

  getNotifications(): Promise<PassengerNotification[]> {
    return this.apiClient.get<PassengerNotification[]>('/dmrc/notifications');
  }

  searchStations(query: string): Promise<StationSearchResult[]> {
    return this.apiClient.get<StationSearchResult[]>('/dmrc/stations/search', {
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
    return this.apiClient.get<JourneyFareWithRoute>('/dmrc/journeys/fare-route', {
      query: {
        from_station_code: request.fromStationCode,
        to_station_code: request.toStationCode,
        strategy: request.strategy,
        journey_time: request.journeyTime,
      },
    });
  }

  getFirstLastTrain(request: JourneyRequest): Promise<FirstLastTrainResponse> {
    return this.apiClient.get<FirstLastTrainResponse>('/dmrc/journeys/first-last-train', {
      query: {
        from_station_code: request.fromStationCode,
        to_station_code: request.toStationCode,
        strategy: request.strategy,
      },
    });
  }

  getJourneyPlan(
    fromStationCode: string,
    toStationCode: string,
    journeyTime?: string,
  ): Promise<JourneyPlan> {
    return this.apiClient.get<JourneyPlan>('/dmrc/journeys/complete', {
      query: {
        from_station_code: fromStationCode,
        to_station_code: toStationCode,
        journey_time: journeyTime,
      },
    });
  }

  async getJourneyPlanWithLocalCache(
    fromStationCode: string,
    toStationCode: string,
    journeyTime?: string,
  ): Promise<JourneyPlan> {
    if (journeyTime) {
      return this.getJourneyPlan(fromStationCode, toStationCode, journeyTime);
    }

    try {
      const plan = await this.getJourneyPlan(fromStationCode, toStationCode);
      await popularRoutesRepository.saveJourneyPlan(fromStationCode, toStationCode, plan);
      return plan;
    } catch (error) {
      const cached = await popularRoutesRepository.getJourneyPlan(fromStationCode, toStationCode);
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
    return this.apiClient.get<StationByLineItem[]>(`/dmrc/lines/${lineCode}/stations`);
  }

  getStationDetail(stationCode: string): Promise<StationDetail> {
    return this.apiClient.get<StationDetail>(`/dmrc/stations/${stationCode}`);
  }
}
