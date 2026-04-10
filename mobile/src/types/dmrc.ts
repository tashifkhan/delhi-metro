export type RouteStrategy = 'least-distance' | 'minimum-interchange';

export interface MetroLine {
  id: number;
  name: string;
  line_color: string;
  line_code: string;
  primary_color_code: string;
  secondary_color_code: string | null;
  class_primary: string;
  class_secondary: string | null;
  start_station: string;
  end_station: string;
  show_in_frontend: boolean | null;
  status: string;
}

export interface StationRef {
  id: number;
  station_name: string;
  station_code: string;
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

export interface StationLineBadge {
  line_id: number;
  line_code: string;
  line_name: string;
  line_color: string;
  primary_color_code: string;
}

export interface StationSearchResult {
  id: number;
  station_name: string;
  station_code: string;
  station_facility: StationFacility[];
  metro_lines: StationLineBadge[];
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
  interchange_time: string | number | null;
  start_station_name: string;
  end_station_name: string;
}

export interface FirstTrainInfo {
  endstation_from_first_train_estimated_time: string | null;
  first_train_route_detail: FirstLastTrainSegment[];
}

export interface LastTrainInfo {
  endstation_from_last_train_estimated_time: string | null;
  last_train_route_detail: FirstLastTrainSegment[];
}

export interface FirstLastTrainResponse {
  first_train: FirstTrainInfo | null;
  last_train: LastTrainInfo | null;
}

export interface JourneyPlan {
  least_distance_fare: JourneyFareWithRoute;
  minimum_interchange_fare: JourneyFareWithRoute;
  least_distance_train: FirstLastTrainResponse;
  minimum_interchange_train: FirstLastTrainResponse;
}

export interface StationByLineItem {
  id: number;
  station_name: string;
  station_code: string;
  station_facility: StationFacility[];
  interchange: boolean;
  status: string;
}

export interface Platform {
  platform_name: string;
  train_towards: string | StationRef | null;
  train_towards_second: string | StationRef | null;
  platform_code: string | null;
}

export interface Gate {
  gate_name: string;
  gate_code: string | null;
  location: string | null;
  gate_latitude: number | null;
  gate_longitude: number | null;
  divyang_friendly: boolean | null;
  status: string | null;
}

export interface Lift {
  lift_type: string | null;
  name: string | null;
  description_location: string | null;
  code: string | null;
  status: string | boolean | number | null;
}

export interface StationDetail {
  id: number;
  station_code: string;
  station_name: string;
  station_commercial_name: string | null;
  station_description: string | null;
  station_type: string | null;
  interchange: boolean | null;
  latitude: number | null;
  longitude: number | null;
  mobile: string | null;
  landline: string | null;
  station_status: Record<string, unknown>[];
  metro_lines: MetroLine[];
  prev_next_stations: Record<string, unknown>[];
  station_facility: StationFacility[];
  gates: Gate[];
  lifts: Lift[];
  platforms: Platform[];
  stations_facilities: Record<string, unknown>[];
  parkings: Record<string, unknown>[];
  nearby_places: Record<string, unknown>[];
  feeder: Record<string, unknown>[];
  first_last_train: Record<string, unknown>[] | Record<string, unknown> | null;
}
