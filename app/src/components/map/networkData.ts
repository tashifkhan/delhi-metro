/**
 * The network as drawable geometry.
 *
 * `src/data/networkMap.json` is a checked-in snapshot built by
 * `api/scripts/build_network_map.py`: lines in travel order and stations with
 * coordinates. Stations marked `approx` were placed by interpolation because
 * no real coordinates exist for them (newer DMRC stations and the whole Aqua
 * Line), so the map is a schematic, not a survey.
 *
 * Coordinates are projected onto a flat plane: x east, y south, one unit per
 * metre at Delhi's latitude. That is close enough at city scale.
 */

import raw from '../../data/networkMap.json';

export interface MapStation {
  code: string;
  name: string;
  lines: string[];
  approx: boolean;
  x: number;
  y: number;
  interchange: boolean;
}

export interface MapLine {
  code: string;
  name: string;
  color: string;
  network: 'dmrc' | 'nmrc';
  stations: string[];
  points: { x: number; y: number }[];
}

interface RawStation {
  code: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[];
  approx?: boolean;
}

interface RawLine {
  code: string;
  name: string;
  color: string;
  network: string;
  stations: string[];
}

const ORIGIN = { lat: 28.6328, lng: 77.2197 }; // Rajiv Chowk
const METRES_PER_DEGREE = 111_320;
const COS_LAT = Math.cos((ORIGIN.lat * Math.PI) / 180);

export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng - ORIGIN.lng) * METRES_PER_DEGREE * COS_LAT,
    y: -(lat - ORIGIN.lat) * METRES_PER_DEGREE,
  };
}

const data = raw as { lines: RawLine[]; stations: RawStation[] };

export const MAP_STATIONS: MapStation[] = data.stations.map((s) => {
  const { x, y } = project(s.lat, s.lng);
  return {
    code: s.code,
    name: s.name,
    lines: s.lines,
    approx: Boolean(s.approx),
    x,
    y,
    // Blue Line's two branches share a colour; a station on both is still a
    // change of train, so membership count is the right test.
    interchange: s.lines.length > 1,
  };
});

export const STATION_BY_CODE = new Map(MAP_STATIONS.map((s) => [s.code, s]));

export const MAP_LINES: MapLine[] = data.lines.map((line) => ({
  code: line.code,
  name: line.name,
  color: line.color,
  network: line.network === 'nmrc' ? 'nmrc' : 'dmrc',
  stations: line.stations,
  points: line.stations
    .map((code) => STATION_BY_CODE.get(code))
    .filter((s): s is MapStation => Boolean(s))
    .map((s) => ({ x: s.x, y: s.y })),
}));

export const LINE_BY_CODE = new Map(MAP_LINES.map((l) => [l.code, l]));

export const MAP_BOUNDS = MAP_STATIONS.reduce(
  (b, s) => ({
    minX: Math.min(b.minX, s.x),
    maxX: Math.max(b.maxX, s.x),
    minY: Math.min(b.minY, s.y),
    maxY: Math.max(b.maxY, s.y),
  }),
  { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
);

/** "Red Line" to "Red", "Pink (Ext.)" to "Pink", "RMGL" stays. */
export function shortLineName(line: Pick<MapLine, 'name'>): string {
  return line.name.replace(/\s*\(Ext\.\)$/i, '').replace(/\s+Line$/i, '').trim();
}
