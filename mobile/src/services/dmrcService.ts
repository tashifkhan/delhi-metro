import { apiClient } from '../api/client';
import { popularRoutesRepository } from '../storage/popularRoutesRepository';
import type {
  FirstLastTrainResponse,
  JourneyFareWithRoute,
  JourneyPlan,
  MetroLine,
  PassengerNotification,
  RouteStrategy,
  StationSearchResult,
} from '../types';

export interface JourneyRequest {
  fromStationCode: string;
  toStationCode: string;
  strategy: RouteStrategy;
}

export const dmrcService = {
  getLines(): Promise<MetroLine[]> {
    return apiClient.get<MetroLine[]>('/dmrc/lines');
  },

  getNotifications(): Promise<PassengerNotification[]> {
    return apiClient.get<PassengerNotification[]>('/dmrc/notifications');
  },

  searchStations(query: string): Promise<StationSearchResult[]> {
    return apiClient.get<StationSearchResult[]>('/dmrc/stations/search', {
      query: {
        query,
        filter: 'all',
      },
    });
  },

  getFareRoute(request: JourneyRequest): Promise<JourneyFareWithRoute> {
    return apiClient.get<JourneyFareWithRoute>('/dmrc/journeys/fare-route', {
      query: {
        from_station_code: request.fromStationCode,
        to_station_code: request.toStationCode,
        strategy: request.strategy,
      },
    });
  },

  getFirstLastTrain(request: JourneyRequest): Promise<FirstLastTrainResponse> {
    return apiClient.get<FirstLastTrainResponse>('/dmrc/journeys/first-last-train', {
      query: {
        from_station_code: request.fromStationCode,
        to_station_code: request.toStationCode,
        strategy: request.strategy,
      },
    });
  },

  getJourneyPlan(fromStationCode: string, toStationCode: string): Promise<JourneyPlan> {
    return apiClient.get<JourneyPlan>('/dmrc/journeys/complete', {
      query: {
        from_station_code: fromStationCode,
        to_station_code: toStationCode,
      },
    });
  },

  async getJourneyPlanWithLocalCache(
    fromStationCode: string,
    toStationCode: string,
  ): Promise<JourneyPlan> {
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
  },

  async getPopularRoutes(limit = 5) {
    return popularRoutesRepository.getPopularRoutes(limit);
  },
};
