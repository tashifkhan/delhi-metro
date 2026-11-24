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
 * - `terrainDetail.json` holds 5 m contours and every lake, pond and stream,
 *   cut into square chunks. It is loaded the first time the map zooms in,
 *   so the app doesn't parse it until it is needed, and the canvas draws only
 *   the chunks on screen.
 *
 * Kept free of React so it can be tested on its own.
 */

import overview from '../../data/terrain.json';

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
  chunks: TerrainChunk[];
}

export const TERRAIN_OVERVIEW = overview as TerrainOverview;

/**
 * Below this span (metres across the screen) the map switches to the
 * detailed layer, about where single lakes become wider than a fingertip.
 */
export const DETAIL_SPAN = 11_000;

let detail: Promise<TerrainDetail> | null = null;

/** The detailed layer, loaded once and shared. */
export function loadTerrainDetail(): Promise<TerrainDetail> {
  if (!detail) {
    const loading = import('../../data/terrainDetail.json').then(
      (module) => ((module as { default?: unknown }).default ?? module) as TerrainDetail,
    );
    // A failed load can be tried again on the next zoom.
    loading.catch(() => {
      if (detail === loading) detail = null;
    });
    detail = loading;
  }
  return detail;
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
