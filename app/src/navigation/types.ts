import type { RouteStrategy } from '../types';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  /** `presetFrom` fills the From field, e.g. from "Route from here" on a station. */
  Home: { presetFrom?: { code: string; name: string } } | undefined;
  JourneyResults: {
    fromCode: string;
    toCode: string;
    fromName: string;
    toName: string;
    journeyTime?: string;
    strategy?: RouteStrategy;
  };
  StationDetail: { stationCode: string; stationName: string };
  Appearance: undefined;
  About: undefined;
};

export type ExploreStackParamList = {
  StationSearch: { q?: string } | undefined;
  StationDetail: { stationCode: string; stationName: string };
};

export type LinesStackParamList = {
  MetroLines: undefined;
  LineStations: { lineCode: string; lineName: string; lineColor: string };
  StationDetail: { stationCode: string; stationName: string };
};

export type MapStackParamList = {
  /** `focusCode` opens the map on that station, e.g. from a route's "Open in Map". */
  MetroMap: { focusCode?: string } | undefined;
  StationDetail: { stationCode: string; stationName: string };
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
