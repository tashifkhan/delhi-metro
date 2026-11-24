/**
 * Background relief for the network map: real contours, lakes and rivers.
 *
 * `api/scripts/build_terrain.py` builds both files from free tile services
 * (AWS Terrain Tiles for height, OpenFreeMap's OpenStreetMap tiles for
 * water) and writes them in map space, so nothing is projected here.
 *
 * - `terrain.json` is bundled and drawn when the city is in view: 10 m
 *   contours, the larger lakes, rivers and canals, and two shaded bands for
 *   the highest ground.
 * - The detail layer holds 5 m contours and every lake, pond and stream, cut
 *   into square chunks. It ships in the offline pack, not the app, and is read
 *   from there the first time the map zooms in; without a pack the map keeps
 *   the overview. The canvas draws only the chunks on screen.
 *
 * Kept free of React so it can be tested on its own.
 */

import overview from '../../data/terrain.json';
import { readPack } from '../../offline/reader';

export interface TerrainOverview {
  /** Contour interval, metres. */
  interval: number;
  minor: string;
  /** Index contours, every fifth. */
  major: string;
  water: string;
  rivers: string;
  /** Filled bands for the highest ground, lower band first. */
  high: string[];
}

export interface TerrainChunk {
  /** Top-left corner in map metres; each chunk is `chunkSize` square. */
  x: number;
  y: number;
  minor: string;
  major: string;
  water: string;
  rivers: string;
  streams: string;
}

export interface TerrainDetail {
  interval: number;
  chunkSize: number;
  bounds?: TerrainBounds;
  chunks: TerrainChunk[];
}

type TerrainBounds = [minX: number, minY: number, maxX: number, maxY: number];

export const TERRAIN_OVERVIEW = overview as TerrainOverview;

/**
 * Below this span (metres across the screen) the map switches to the
 * detailed layer, about where single lakes become wider than a fingertip.
 */
export const DETAIL_SPAN = 11_000;

let cachedDetail: { pack: ReturnType<typeof readPack>; detail: Promise<TerrainDetail | null> } | undefined;

function isDetail(value: unknown): value is TerrainDetail {
  const d = value as TerrainDetail;
  return typeof d === 'object' && d !== null && Array.isArray(d.chunks) && typeof d.chunkSize === 'number';
}

/**
 * Share the layer until the offline pack reader is invalidated by a sync or removal.
 */
export function loadTerrainDetail(): Promise<TerrainDetail | null> {
  const pack = readPack();
  if (cachedDetail?.pack !== pack) {
    const detail = pack.then((snapshot) => {
      const value = snapshot?.bundle.sections.terrain_detail;
      return isDetail(value) ? value : null;
    });
    cachedDetail = { pack, detail };
  }
  return cachedDetail.detail;
}

/** Chunks overlapping a map-space rectangle. */
export function chunksIn(
  data: TerrainDetail,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): TerrainChunk[] {
  const size = data.chunkSize;
  return data.chunks.filter((c) => c.x + size >= minX && c.x <= maxX && c.y + size >= minY && c.y <= maxY);
}

/** Use the overview if the visible area extends beyond the pack's detail. */
export function detailChunksForView(
  data: TerrainDetail,
  visible: TerrainBounds,
  draw: TerrainBounds,
): TerrainChunk[] | null {
  const [left, top, right, bottom] = visible;
  // Older packs lack bounds. Infer their extent from the chunks they contain.
  const [minX, minY, maxX, maxY] = data.bounds ?? data.chunks.reduce<TerrainBounds>(
    ([minX, minY, maxX, maxY], { x, y }) => [
      Math.min(minX, x), Math.min(minY, y),
      Math.max(maxX, x + data.chunkSize), Math.max(maxY, y + data.chunkSize),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  if (left < minX || top < minY || right > maxX || bottom > maxY) return null;
  if (!chunksIn(data, ...visible).length) return null;
  return chunksIn(data, ...draw);
}
