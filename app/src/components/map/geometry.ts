/**
 * Drawable network geometry, and how official-map layouts reshape it.
 *
 * The snapshot in `networkData` is the base. A network listed in
 * `LAYOUT_REGISTRY` can have some of its lines re-drawn from the station
 * positions the API reads off that operator's official map
 * (`/maps/layout`). Today only Noida is on: the Aqua Line has no surveyed
 * coordinates, and NMRC's published map is a north-up street map, so the
 * shape and spacing it shows are better than our hand-set estimate.
 *
 * The official image has its own scale and framing, so its points can't be
 * used directly. A least-squares similarity transform (scale, rotation,
 * translation, no shear) is fitted from the image positions of a few anchor
 * stations to where the snapshot already puts them, and every station on the
 * line is placed through that transform. The anchors keep the line where it
 * was overall; the image supplies the curves and the gaps between stations.
 *
 * Kept free of React so it can be tested on its own.
 */

import type { MapLayout } from '../../services/mapLayout';
import type { MetroNetwork } from '../../types';
import {
  MAP_BOUNDS,
  MAP_LINES,
  MAP_STATIONS,
  type MapLine,
  type MapStation,
} from './networkData';

export interface Point {
  x: number;
  y: number;
}

export interface NetworkGeometry {
  stations: MapStation[];
  lines: MapLine[];
  stationByCode: Map<string, MapStation>;
  lineByCode: Map<string, MapLine>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export const BASE_GEOMETRY: NetworkGeometry = {
  stations: MAP_STATIONS,
  lines: MAP_LINES,
  stationByCode: new Map(MAP_STATIONS.map((s) => [s.code, s])),
  lineByCode: new Map(MAP_LINES.map((l) => [l.code, l])),
  bounds: MAP_BOUNDS,
};

/** How one line takes positions from its network's official-map layout. */
export interface LineLayoutRule {
  lineCode: string;
  /**
   * Positions in the line's station list whose snapshot placement is trusted
   * enough to pin the fitted transform. At least two must be present in the
   * layout for the line to move.
   */
  anchorIndices: number[];
  /**
   * Optional weight per anchor, same order. A heavier anchor is held closer
   * to its snapshot spot, for stations whose position is better known.
   */
  anchorWeights?: number[];
}

export interface NetworkLayoutRule {
  /** Whether the app asks for and applies this network's layout at all. */
  enabled: boolean;
  lines: LineLayoutRule[];
}

/**
 * Which networks use the official-map layout, and for which lines.
 *
 * Delhi is off: its stations already have Sarthi coordinates, and the server
 * reports the DMRC layout as disabled. Switching it on later means adding the
 * lines to re-draw here and enabling the flag on the server.
 */
export const LAYOUT_REGISTRY: Record<MetroNetwork, NetworkLayoutRule> = {
  nmrc: {
    enabled: true,
    // The same stations `api/scripts/build_network_map.py` pins by hand
    // (AQUA_ANCHORS): both ends and four points along the corridor.
    // Sector 51 is weighted hardest: it sits beside the Blue Line's Sector 52,
    // which has real coordinates, and the walk between them is drawn.
    lines: [
      {
        lineCode: 'AQUA',
        anchorIndices: [0, 4, 8, 13, 16, 20],
        anchorWeights: [12, 1, 1, 1, 1, 1],
      },
    ],
  },
  dmrc: { enabled: false, lines: [] },
};

export const LAYOUT_NETWORKS = (Object.keys(LAYOUT_REGISTRY) as MetroNetwork[]).filter(
  (network) => LAYOUT_REGISTRY[network].enabled,
);

export interface Similarity {
  /** Complex multiplier: x' = a*x - b*y + tx, y' = b*x + a*y + ty. */
  a: number;
  b: number;
  tx: number;
  ty: number;
}

/**
 * Least-squares similarity from `src` to `dst` (same length, at least two
 * distinct points). Closed form: treat points as complex numbers z, solve
 * w = m*z + t for complex m and t. Returns null when it is underdetermined.
 */
export function fitSimilarity(src: Point[], dst: Point[], weights?: number[]): Similarity | null {
  const n = Math.min(src.length, dst.length);
  if (n < 2) return null;
  const w = (i: number) => (weights && weights[i] > 0 ? weights[i] : 1);
  let sw = 0, sx = 0, sy = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const wi = w(i);
    sw += wi; sx += wi * src[i].x; sy += wi * src[i].y; dx += wi * dst[i].x; dy += wi * dst[i].y;
  }
  const scx = sx / sw, scy = sy / sw, dcx = dx / sw, dcy = dy / sw;
  let num_a = 0, num_b = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const wi = w(i);
    const px = src[i].x - scx, py = src[i].y - scy;
    const qx = dst[i].x - dcx, qy = dst[i].y - dcy;
    // m = sum(w * conj(p) * q) / sum(w * |p|^2)
    num_a += wi * (px * qx + py * qy);
    num_b += wi * (px * qy - py * qx);
    den += wi * (px * px + py * py);
  }
  if (den < 1e-12) return null;
  const a = num_a / den;
  const b = num_b / den;
  return { a, b, tx: dcx - (a * scx - b * scy), ty: dcy - (b * scx + a * scy) };
}

export function applySimilarity(t: Similarity, p: Point): Point {
  return { x: t.a * p.x - t.b * p.y + t.tx, y: t.b * p.x + t.a * p.y + t.ty };
}

const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Find a layout station by name when codes don't line up. Exact match first,
 * then a unique containment match, which covers the operators' longer or
 * shorter forms ("Knowledge Park" and "Knowledge Park II").
 */
function matchByName<T extends { name: string }>(candidates: T[], name: string): T | undefined {
  const wanted = normalizeName(name);
  if (!wanted) return undefined;
  const exact = candidates.find((c) => normalizeName(c.name) === wanted);
  if (exact) return exact;
  const loose = candidates.filter((c) => {
    const n = normalizeName(c.name);
    return n.length > 3 && (n.includes(wanted) || wanted.includes(n));
  });
  return loose.length === 1 ? loose[0] : undefined;
}

/**
 * Image-pixel position of every layout station, keyed by snapshot code.
 * Matches on code first, then on a loose name match, since the layout's codes
 * come from the operator's catalogue and the snapshot's from ours.
 */
function layoutPoints(layout: MapLayout, line: MapLine, geo: NetworkGeometry): Map<string, Point> {
  const width = layout.image?.width || 1;
  const height = layout.image?.height || 1;
  const byCode = new Map(layout.stations.map((s) => [s.code.trim().toUpperCase(), s]));
  const out = new Map<string, Point>();
  for (const code of line.stations) {
    const station = geo.stationByCode.get(code);
    const hit = byCode.get(code.toUpperCase()) ?? (station ? matchByName(layout.stations, station.name) : undefined);
    if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y)) continue;
    // Pixels, not fractions, so a non-square image keeps its aspect ratio.
    out.set(code, { x: hit.x * width, y: hit.y * height });
  }
  return out;
}

/**
 * Snapshot geometry with every enabled network's layout applied. Networks
 * without a ready layout, or lines with fewer than two matched anchors, are
 * left exactly as they were.
 */
export function applyLayouts(
  base: NetworkGeometry,
  layouts: Partial<Record<MetroNetwork, MapLayout | null | undefined>>,
): NetworkGeometry {
  const moved = new Map<string, Point>();

  for (const network of LAYOUT_NETWORKS) {
    const layout = layouts[network];
    if (!layout || layout.status !== 'ready' || layout.stations.length === 0) continue;
    for (const rule of LAYOUT_REGISTRY[network].lines) {
      const line = base.lineByCode.get(rule.lineCode);
      if (!line) continue;
      const image = layoutPoints(layout, line, base);
      const src: Point[] = [];
      const dst: Point[] = [];
      const weights: number[] = [];
      rule.anchorIndices.forEach((index, i) => {
        const code = line.stations[index];
        const station = code ? base.stationByCode.get(code) : undefined;
        const p = code ? image.get(code) : undefined;
        if (station && p) {
          src.push(p);
          dst.push({ x: station.x, y: station.y });
          weights.push(rule.anchorWeights?.[i] ?? 1);
        }
      });
      const transform = fitSimilarity(src, dst, weights);
      if (!transform) continue;
      for (const [code, p] of image) moved.set(code, applySimilarity(transform, p));
    }
  }

  if (moved.size === 0) return base;

  const stations = base.stations.map((s) => {
    const p = moved.get(s.code);
    // Still estimated: placed from a published picture, not a survey.
    return p ? { ...s, x: p.x, y: p.y, approx: true } : s;
  });
  const stationByCode = new Map(stations.map((s) => [s.code, s]));
  const lines = base.lines.map((line) =>
    line.stations.some((code) => moved.has(code))
      ? {
          ...line,
          points: line.stations
            .map((code) => stationByCode.get(code))
            .filter((s): s is MapStation => Boolean(s))
            .map((s) => ({ x: s.x, y: s.y })),
        }
      : line,
  );
  const bounds = stations.reduce(
    (b, s) => ({
      minX: Math.min(b.minX, s.x),
      maxX: Math.max(b.maxX, s.x),
      minY: Math.min(b.minY, s.y),
      maxY: Math.max(b.maxY, s.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  return {
    stations,
    lines,
    stationByCode,
    lineByCode: new Map(lines.map((l) => [l.code, l])),
    bounds,
  };
}
