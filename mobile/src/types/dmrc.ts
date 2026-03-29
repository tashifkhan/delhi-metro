export type RouteStrategy = 'least-distance' | 'minimum-interchange';

export interface MetroLine {
  id: number;
  name: string;
  line_color: string;
  line_code: string;
  primary_color_code: string;
  secondary_color_code: string;
  class_primary: string;
  class_secondary: string | null;
  start_station: string;
  end_station: string;
  show_in_frontend: boolean;
  status: string;
}

export interface NotificationImage {
  title: string;
  file: string;
}

export interface NotificationType {
  name: string;
  image: NotificationImage;
}

export interface PassengerNotification {
  id: number;
  title: string;
  notification_type: NotificationType | null;
  image: NotificationImage | null;
  video_url: string | null;
  link_to: string | null;
  link_to_file: string | null;
  link_to_internal_page: string | null;
  link_to_outside_url: string | null;
  date: string;
}

export interface StationFacilityImage {
  title: string;
  file: string;
}

export interface StationFacility {
  name: string;
  class_name: string;
  image: StationFacilityImage;
}

export interface StationSearchResult {
  id: number;
  station_name: string;
  station_code: string;
  station_facility: StationFacility[];
}

export interface JourneyPathPoint {
  name: string;
  status: string | null;
}

export interface JourneyRouteSegment {
  line: string;
  line_no: number | null;
  path: JourneyPathPoint[];
  path_time: string | null;
  'map-path': string[];
  station_interchange_time: number;
  start: string;
  end: string;
}

export interface JourneyFareWithRoute {
  stations: number;
  from: string;
  to: string;
  total_time: string;
  weekday_fare: number;
  weekend_fare: number;
  route: JourneyRouteSegment[];
}

export interface FirstLastTrainSegment {
  start_st: string;
  start_time: string;
  end_st: string;
  end_time: string;
  interchange_time: string;
  start_station_name: string;
  end_station_name: string;
}

export interface FirstTrainInfo {
  endstation_from_first_train_estimated_time: string;
  first_train_route_detail: FirstLastTrainSegment[];
}

export interface LastTrainInfo {
  endstation_from_last_train_estimated_time: string;
  last_train_route_detail: FirstLastTrainSegment[];
}

export interface FirstLastTrainResponse {
  first_train: FirstTrainInfo;
  last_train: LastTrainInfo;
}

export interface JourneyPlan {
  least_distance_fare: JourneyFareWithRoute;
  minimum_interchange_fare: JourneyFareWithRoute;
  least_distance_train: FirstLastTrainResponse;
  minimum_interchange_train: FirstLastTrainResponse;
}
