import type { RouteStrategy } from '../types';
import type { NavigatorScreenParams } from '@react-navigation/native';

/** Params shared by every stack that can open a station. */
export type StationDetailParams = {
  stationCode: string;
  stationName: string;
  /** Open with the full details showing, e.g. from the map sheet's Details button. */
  expanded?: boolean;
};

/** Params shared by every stack that can show a planned journey. */
export type JourneyResultsParams = {
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  journeyTime?: string;
  strategy?: RouteStrategy;
};

export type HomeStackParamList = {
  /** `presetFrom` fills the From field, e.g. from "Route from here" on a station or a saved place. */
  Home: { presetFrom?: { code: string; name: string }; openTo?: boolean } | undefined;
  JourneyResults: JourneyResultsParams;
  StationDetail: StationDetailParams;
  Settings: undefined;
  Appearance: undefined;
  About: undefined;
};

export type NetworkStackParamList = {
  /** Lines and stations. `q` is the station search, kept in the URL on the web. */
  Network: { q?: string } | undefined;
  LineStations: { lineCode: string; lineName: string; lineColor: string };
  StationDetail: StationDetailParams;
};

export type MapStackParamList = {
  /** `focusCode` opens the map on that station, e.g. from a route's "Open in Map". */
  MetroMap: { focusCode?: string } | undefined;
  StationDetail: StationDetailParams;
};

export type SavedStackParamList = {
  Saved: undefined;
  JourneyResults: JourneyResultsParams;
  StationDetail: StationDetailParams;
};

export type AlertsStackParamList = {
  Notifications: undefined;
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  MapTab: NavigatorScreenParams<MapStackParamList>;
  NetworkTab: NavigatorScreenParams<NetworkStackParamList>;
  SavedTab: NavigatorScreenParams<SavedStackParamList>;
  AlertsTab: NavigatorScreenParams<AlertsStackParamList>;
};
