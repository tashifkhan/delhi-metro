/**
 * A planned journey as map geometry: what the route map highlights.
 *
 * Each ride leg follows the drawn line between its two stations, so the
 * highlight sits exactly on the network rather than cutting corners between
 * the stops the planner listed. When a leg's line can't be found (a renamed
 * station, a line the snapshot doesn't have), it falls back to the planner's
 * own stop list matched by name. The walk between operators is a dotted hop.
 *
 * Kept free of React so it can be tested on its own.
 */

import type { PlannedLeg } from '../../types';
import type { NetworkGeometry, Point } from './geometry';
import type { MapLine, MapStation } from './networkData';

export interface RouteSegment {
  points: Point[];
  color: string;
  dashed?: boolean;
}

export interface RouteOverlay {
  segments: RouteSegment[];
  start: Point | null;
  end: Point | null;
  /** Where the traveller changes train or network. */
  changes: Point[];
  /** Every station the route passes, for markers and labels. */
  stationCodes: Set<string>;
  /** Start, end and change stations: always labelled. */
  keyCodes: string[];
  /** Line colour of the leg a station is on, for its marker. */
  colorFor: (code: string) => string | null;
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
}

const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '');

function findStation(geo: NetworkGeometry, code: string | null, name: string): MapStation | null {
  if (code) {
    const hit = geo.stationByCode.get(code.trim().toUpperCase());
    if (hit) return hit;
  }
  const wanted = normalize(name);
  if (!wanted) return null;
  return (
    geo.stations.find((s) => normalize(s.name) === wanted) ??
    // "Sector - 52 Noida" vs "Noida Sector 52": compare the letters and digits as a bag.
    geo.stations.find((s) => [...normalize(s.name)].sort().join('') === [...wanted].sort().join('')) ??
    null
  );
}

/** Stations from `a` to `b` along a line that contains both, in travel order. */
function alongLine(line: MapLine, a: string, b: string): string[] | null {
  const i = line.stations.indexOf(a);
  const j = line.stations.indexOf(b);
  if (i < 0 || j < 0) return null;
  const run = i <= j ? line.stations.slice(i, j + 1) : line.stations.slice(j, i + 1).reverse();
  return run;
}

export function buildRouteOverlay(
  legs: PlannedLeg[],
  geo: NetworkGeometry,
  colorFor: (leg: PlannedLeg) => string,
): RouteOverlay | null {
  const segments: RouteSegment[] = [];
  const stationCodes = new Set<string>();
  const stationColor = new Map<string, string>();
  const changes: Point[] = [];
  const keyCodes: string[] = [];
  let start: MapStation | null = null;
  let end: MapStation | null = null;

  const rides = legs.filter((leg) => leg.kind !== 'transfer');

  legs.forEach((leg) => {
    const from = findStation(geo, leg.from_station_code, leg.from_station);
    const to = findStation(geo, leg.to_station_code, leg.to_station);

    if (leg.kind === 'transfer') {
      if (from && to) {
        segments.push({ points: [from, to], color: '', dashed: true });
        changes.push(from, to);
        keyCodes.push(from.code, to.code);
        stationCodes.add(from.code).add(to.code);
      }
      return;
    }

    const color = colorFor(leg);
    let codes: string[] | null = null;
    if (from && to) {
      // Prefer a line drawn in the leg's colour; any line with both ends will do.
      const candidates = geo.lines.filter(
        (line) => line.stations.includes(from.code) && line.stations.includes(to.code),
      );
      const line =
        candidates.find((l) => l.color.toLowerCase() === color.toLowerCase()) ?? candidates[0];
      if (line) codes = alongLine(line, from.code, to.code);
    }
    if (!codes) {
      codes = (leg.stops.length > 0 ? leg.stops.map((s) => s.name) : [leg.from_station, leg.to_station])
        .map((name, i, all) =>
          findStation(geo, i === 0 ? leg.from_station_code : i === all.length - 1 ? leg.to_station_code : null, name)?.code ?? null,
        )
        .filter((code): code is string => code !== null);
    }

    const points = codes
      .map((code) => geo.stationByCode.get(code))
      .filter((s): s is MapStation => Boolean(s));
    if (points.length === 0) return;
    if (points.length >= 2) segments.push({ points: points.map(({ x, y }) => ({ x, y })), color });
    for (const s of points) {
      stationCodes.add(s.code);
      if (!stationColor.has(s.code)) stationColor.set(s.code, color);
    }

    if (!start) start = points[0];
    end = points[points.length - 1];
    if (leg !== rides[rides.length - 1]) {
      // Change of train at the end of every ride but the last.
      changes.push(points[points.length - 1]);
      keyCodes.push(points[points.length - 1].code);
    }
  });

  if (!start || !end) return null;
  const s = start as MapStation;
  const e = end as MapStation;
  keyCodes.unshift(s.code);
  keyCodes.push(e.code);

  let bounds: RouteOverlay['bounds'] = null;
  for (const code of stationCodes) {
    const p = geo.stationByCode.get(code);
    if (!p) continue;
    bounds = bounds
      ? {
          minX: Math.min(bounds.minX, p.x),
          maxX: Math.max(bounds.maxX, p.x),
          minY: Math.min(bounds.minY, p.y),
          maxY: Math.max(bounds.maxY, p.y),
        }
      : { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y };
  }

  // The end of one ride and the start of the next are the same change point;
  // keep each marker once.
  const seen = new Set<string>();
  const uniqueChanges = changes.filter((p) => {
    const key = `${Math.round(p.x)}|${Math.round(p.y)}`;
    if (seen.has(key) || (p.x === s.x && p.y === s.y) || (p.x === e.x && p.y === e.y)) return false;
    seen.add(key);
    return true;
  });

  return {
    segments,
    start: { x: s.x, y: s.y },
    end: { x: e.x, y: e.y },
    changes: uniqueChanges,
    stationCodes,
    keyCodes: [...new Set(keyCodes)],
    colorFor: (code) => stationColor.get(code) ?? null,
    bounds,
  };
}
