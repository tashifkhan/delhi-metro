import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  Home: undefined;
  JourneyResults: {
    fromCode: string;
    toCode: string;
    fromName: string;
    toName: string;
    journeyTime?: string;
  };
  StationDetail: { stationCode: string; stationName: string };
};

export type ExploreStackParamList = {
  StationSearch: undefined;
  StationDetail: { stationCode: string; stationName: string };
};

export type LinesStackParamList = {
  MetroLines: undefined;
  LineStations: { lineCode: string; lineName: string; lineColor: string };
  StationDetail: { stationCode: string; stationName: string };
};

export type MapStackParamList = {
  MetroMap: undefined;
};

export type AlertsStackParamList = {
  Notifications: undefined;
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  SearchTab: NavigatorScreenParams<ExploreStackParamList>;
  LinesTab: NavigatorScreenParams<LinesStackParamList>;
  MapTab: NavigatorScreenParams<MapStackParamList>;
  AlertsTab: NavigatorScreenParams<AlertsStackParamList>;
};
