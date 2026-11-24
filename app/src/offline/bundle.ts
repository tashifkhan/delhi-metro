import type {
  MetroLine,
  MetroNetwork,
  PassengerNotification,
  PassengerNotificationDetail,
  StationByLineItem,
  StationDetail,
  StationSearchResult,
} from '../types';

/**
 * The parts of the offline export (schema v1, `docs/offline-export.md`) the
 * app reads. Unknown fields are ignored, so the server can add more.
 */
export interface PackStation {
  network: MetroNetwork;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  detail: StationDetail;
}

export interface PackLine extends MetroLine {
  network: MetroNetwork;
  /** Bare station codes in catalog order. */
  stations: string[];
}

export interface PackNotice {
  network: MetroNetwork;
  notice: PassengerNotification;
  detail: PassengerNotificationDetail | null;
}

export interface PackHop {
  minutes: number;
  reverse_minutes: number | null;
  km: number;
}

export interface PackPattern {
  id: string;
  network: MetroNetwork;
  line_code: string;
  name: string;
  color: string;
  stops: string[];
  loop: boolean;
  loop_start: number | null;
  hops: PackHop[];
}

export interface PackOverrideLeg {
  kind: 'metro' | 'transfer';
  pattern: string | null;
  origin: string;
  destination: string;
  stops: string[];
}

export interface PackOverride {
  from: string;
  to: string;
  strategy: 'least-distance' | 'minimum-interchange';
  legs: PackOverrideLeg[];
}

export interface PackFares {
  dmrc_distance_slabs: { max_km: number | null; normal: number; special: number }[];
  nmrc_station_count_slabs: { max_stations: number; normal: number; special: number }[];
  ncrtc_fare_matrix: { from: string; to: string; class: 'standard' | 'premium'; amount: number }[];
}

export interface PackBundle {
  schema_version: number;
  sections: {
    lines?: PackLine[];
    stations?: PackStation[];
    notices?: PackNotice[];
    fares?: PackFares;
    routing_graph?: {
      patterns: PackPattern[];
      changes: { station: string; minutes: number }[];
      walks: { from: string; to: string; minutes: number; metres: number | null; note: string }[];
    };
    overrides?: PackOverride[];
    official_map?: Record<
      string,
      { content_type: string; data_base64: string; sha256: string; width: number; height: number }
    >;
    terrain_detail?: unknown;
  };
}

/** The schema this app understands. A newer pack is ignored until the app updates. */
export const SUPPORTED_SCHEMA = 1;

export function parseBundle(text: string): PackBundle | null {
  try {
    const value = JSON.parse(text) as PackBundle;
    if (!value || typeof value !== 'object' || value.schema_version !== SUPPORTED_SCHEMA) return null;
    if (!value.sections || typeof value.sections !== 'object') return null;
    return value;
  } catch {
    return null;
  }
}

export const stationKey = (network: MetroNetwork, code: string) => `${network}:${code.trim().toUpperCase()}`;

const same = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/** Read-only lookups over a parsed pack, shaped like the API's own responses. */
export function selectors(bundle: PackBundle) {
  const stations = bundle.sections.stations ?? [];
  const byKey = new Map(stations.map((s) => [stationKey(s.network, s.code), s]));

  return {
    lines(network: MetroNetwork): MetroLine[] {
      return (bundle.sections.lines ?? [])
        .filter((line) => line.network === network)
        .map(({ stations: _stops, ...line }) => line);
    },

    stations(network: MetroNetwork): StationSearchResult[] {
      return stations
        .filter((s) => s.network === network)
        .map((s) => ({
          id: s.detail.id,
          station_name: s.detail.station_name ?? s.name,
          station_code: s.code,
          station_facility: [],
          metro_lines: (s.detail.metro_lines ?? []).map((line) => ({
            line_id: line.id,
            line_code: line.line_code,
            line_name: line.name,
            line_color: line.line_color,
            primary_color_code: line.primary_color_code,
          })),
        }));
    },

    stationDetail(network: MetroNetwork, code: string): StationDetail | null {
      return byKey.get(stationKey(network, code))?.detail ?? null;
    },

    stationsByLine(network: MetroNetwork, lineCode: string): StationByLineItem[] | null {
      const line = (bundle.sections.lines ?? []).find((l) => l.network === network && same(l.line_code, lineCode));
      if (!line) return null;
      return line.stations.flatMap((code) => {
        const station = byKey.get(stationKey(network, code));
        if (!station) return [];
        const detail = station.detail;
        return [
          {
            id: detail.id,
            station_name: detail.station_name ?? station.name,
            station_code: station.code,
            station_facility: [],
            interchange: Boolean(detail.interchange) || (detail.metro_lines?.length ?? 0) > 1,
            status: '',
          },
        ];
      });
    },

    notifications(network: MetroNetwork): PassengerNotification[] {
      return (bundle.sections.notices ?? []).filter((n) => n.network === network).map((n) => n.notice);
    },

    notificationDetail(slug: string): PassengerNotificationDetail | null {
      return (bundle.sections.notices ?? []).find((n) => n.detail && n.detail.page_slug === slug)?.detail ?? null;
    },
  };
}

export type PackSelectors = ReturnType<typeof selectors>;
