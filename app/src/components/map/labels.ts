/**
 * Which station names to draw, and where, at the current zoom.
 *
 * Names are placed in priority order (the selected station and route stops,
 * then line ends, then interchanges, then everything else) in screen space.
 * Each name tries eight spots around its marker and takes the cheapest one
 * that doesn't hit a name already placed, a floating control or another
 * station's marker. A spot costs more when its box crosses a line, and when
 * it points along one of the station's own lines, so names sit beside the
 * track the way printed metro maps set them, not on it.
 *
 * Ordinary stops get a name once the view is close, or earlier when they
 * stand far enough from their neighbours and a spot clear of every line is
 * free. Quiet suburbs read in full while the dense centre keeps only its
 * important names.
 *
 * Kept free of React so it can be tested on its own.
 */

import { stationName } from '../../utils/format';
import type { MapLine, MapStation } from './networkData';

export interface PlacedLabel {
  code: string;
  text: string;
  /** Screen position of the text baseline start. */
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  size: number;
  weight: '500' | '600' | '700';
  priority: number;
}

export interface LabelInput {
  stations: MapStation[];
  lines: MapLine[];
  /** Map point to screen point. */
  toScreen: (x: number, y: number) => { x: number; y: number };
  width: number;
  height: number;
  /** Metres across the screen. */
  span: number;
  /** Always labelled first, e.g. the selected station or a route's ends. */
  forced?: string[];
  /** Labelled before ordinary stops, e.g. every stop on a route. */
  preferred?: Set<string>;
  /** Stations whose names should be left out, e.g. faded lines. */
  muted?: Set<string>;
  /** Screen areas covered by floating UI; names never go under them. */
  obstacles?: Box[];
}

/** "NEW DELHI (Yellow & Airport Line)" to "New Delhi": maps have no room for notes. */
export function mapLabel(name: string): string {
  return stationName(name)
    .replace(/\s*\([^)]*\)?\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Line ends: the first and last station of every line. */
export function terminalCodes(lines: MapLine[]): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    if (line.stations.length === 0) continue;
    out.add(line.stations[0]);
    out.add(line.stations[line.stations.length - 1]);
  }
  return out;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Rough text width; exact metrics aren't available before render. */
const textWidth = (text: string, size: number, weight: string) =>
  text.length * size * (weight === '500' ? 0.54 : 0.57);

const MAX_LABELS = 140;
const stationLabels = new WeakMap<MapStation, string>();

/** Liang-Barsky clip: does segment a-b pass through the box? */
function segmentHitsBox(ax: number, ay: number, bx: number, by: number, box: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const edges: Array<[number, number]> = [
    [-dx, ax - box.x0],
    [dx, box.x1 - ax],
    [-dy, ay - box.y0],
    [dy, box.y1 - ay],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return true;
}

type Segment = [number, number, number, number];

/** Screen-space line segments bucketed into a coarse grid for quick lookups. */
class SegmentGrid {
  private cells = new Map<number, Segment[]>();
  constructor(private cell: number) {}

  private key(cx: number, cy: number) {
    return (cx + 2048) * 4096 + (cy + 2048);
  }

  add(seg: Segment) {
    const [ax, ay, bx, by] = seg;
    const c = this.cell;
    const x0 = Math.floor(Math.min(ax, bx) / c);
    const x1 = Math.floor(Math.max(ax, bx) / c);
    const y0 = Math.floor(Math.min(ay, by) / c);
    const y1 = Math.floor(Math.max(ay, by) / c);
    // A segment far longer than the screen is clipped by the caller first.
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const k = this.key(x, y);
        const list = this.cells.get(k);
        if (list) list.push(seg);
        else this.cells.set(k, [seg]);
      }
    }
  }

  /** How many distinct segments cross the box. */
  crossings(box: Box): number {
    const c = this.cell;
    const seen = new Set<Segment>();
    let n = 0;
    for (let x = Math.floor(box.x0 / c); x <= Math.floor(box.x1 / c); x++) {
      for (let y = Math.floor(box.y0 / c); y <= Math.floor(box.y1 / c); y++) {
        const list = this.cells.get(this.key(x, y));
        if (!list) continue;
        for (const seg of list) {
          if (seen.has(seg)) continue;
          seen.add(seg);
          if (segmentHitsBox(seg[0], seg[1], seg[2], seg[3], box)) n++;
        }
      }
    }
    return n;
  }
}

/** Cohen-Sutherland style trim so huge off-screen segments don't flood the grid. */
function clipToView(seg: Segment, view: Box): Segment | null {
  const [ax, ay, bx, by] = seg;
  if (Math.max(ax, bx) < view.x0 || Math.min(ax, bx) > view.x1) return null;
  if (Math.max(ay, by) < view.y0 || Math.min(ay, by) > view.y1) return null;
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const edges: Array<[number, number]> = [
    [-dx, ax - view.x0],
    [dx, view.x1 - ax],
    [-dy, ay - view.y0],
    [dy, view.y1 - ay],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1];
}

/** Ordinary stops show at every zoom closer than this many metres across. */
const STOPS_SPAN = 11_000;
/** Further out, a stop shows only if its nearest neighbour is this far away on screen. */
const STOP_SPACING_PX = 52;

export function placeLabels(input: LabelInput): PlacedLabel[] {
  const { stations, lines, toScreen, width, height, span, forced = [], preferred, muted, obstacles = [] } = input;
  const ends = terminalCodes(lines);
  const forcedOrder = new Map([...new Set(forced)].map((code, index) => [code, index]));
  const closeUp = span < STOPS_SPAN;

  const screen = new Map<string, { x: number; y: number }>();
  for (const station of stations) screen.set(station.code, toScreen(station.x, station.y));

  // Each station's arms: unit vectors toward its neighbours along every line,
  // and the screen distance to the closest of them.
  const arms = new Map<string, Array<{ x: number; y: number }>>();
  const spacing = new Map<string, number>();
  const view: Box = { x0: -200, y0: -200, x1: width + 200, y1: height + 200 };
  const grid = new SegmentGrid(48);
  for (const line of lines) {
    for (let i = 1; i < line.stations.length; i++) {
      const a = screen.get(line.stations[i - 1]);
      const b = screen.get(line.stations[i]);
      if (!a || !b) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) continue;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const codeA = line.stations[i - 1];
      const codeB = line.stations[i];
      (arms.get(codeA) ?? arms.set(codeA, []).get(codeA)!).push({ x: ux, y: uy });
      (arms.get(codeB) ?? arms.set(codeB, []).get(codeB)!).push({ x: -ux, y: -uy });
      spacing.set(codeA, Math.min(spacing.get(codeA) ?? Infinity, len));
      spacing.set(codeB, Math.min(spacing.get(codeB) ?? Infinity, len));
      const clipped = clipToView([a.x, a.y, b.x, b.y], view);
      if (clipped) grid.add(clipped);
    }
  }

  const ranked = stations
    .filter(({ code }) => {
      const p = screen.get(code)!;
      return p.x >= -20 && p.y >= -20 && p.x <= width + 20 && p.y <= height + 20;
    })
    .map((station) => {
      let priority: number;
      if (forcedOrder.has(station.code)) priority = 0;
      else if (preferred?.has(station.code)) priority = 1;
      else if (ends.has(station.code)) priority = 2;
      else if (station.interchange) priority = 3;
      else priority = 4;
      return { station, priority };
    })
    .filter(({ station, priority }) => {
      if (priority <= 1) return true;
      if (muted?.has(station.code)) return false;
      if (priority <= 3) return true;
      return closeUp || (spacing.get(station.code) ?? 0) >= STOP_SPACING_PX;
    })
    .sort((a, b) => a.priority - b.priority || (forcedOrder.get(a.station.code) ?? 0) - (forcedOrder.get(b.station.code) ?? 0));

  // Every marker on screen is an obstacle, so names don't sit on top of stops.
  const markers: Box[] = [];
  for (const station of stations) {
    const p = screen.get(station.code)!;
    if (p.x < -40 || p.y < -40 || p.x > width + 40 || p.y > height + 40) continue;
    const r = station.interchange ? 6 : 4;
    markers.push({ x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r });
  }

  // Names must fit on screen, or they read as cut-off fragments.
  const onScreen = (box: Box) => box.x0 >= 2 && box.x1 <= width - 2 && box.y0 >= 2 && box.y1 <= height - 2;

  const placed: PlacedLabel[] = [];
  const boxes: Box[] = [...obstacles];
  for (const { station, priority } of ranked) {
    if (placed.length >= MAX_LABELS) break;
    const p = screen.get(station.code)!;

    let text = stationLabels.get(station);
    if (text === undefined) {
      text = mapLabel(station.name);
      stationLabels.set(station, text);
    }
    if (!text) continue;
    const size = priority <= 1 ? 13 : priority <= 3 ? 12 : 11;
    const weight: PlacedLabel['weight'] = priority === 0 ? '700' : priority <= 3 ? '600' : '500';
    const w = textWidth(text, size, weight);
    const h = size + 2;
    // Forced names sit beside bigger markers: the selected tile, route ends.
    const gap = priority === 0 ? 17 : station.interchange || priority === 1 ? 10 : 7;

    // Right, left, below, above, then the four diagonals. `dir` is the way
    // the name leans away from the marker, used to keep it off the station's
    // own lines.
    const d = gap * 0.75;
    const sideY = p.y + size * 0.35;
    const R = Math.SQRT1_2;
    const candidates: Array<{ box: Box; x: number; y: number; anchor: PlacedLabel['anchor']; dir: [number, number] }> = [
      { box: { x0: p.x + gap, y0: p.y - h / 2, x1: p.x + gap + w, y1: p.y + h / 2 }, x: p.x + gap, y: sideY, anchor: 'start', dir: [1, 0] },
      { box: { x0: p.x - gap - w, y0: p.y - h / 2, x1: p.x - gap, y1: p.y + h / 2 }, x: p.x - gap, y: sideY, anchor: 'end', dir: [-1, 0] },
      { box: { x0: p.x - w / 2, y0: p.y + gap - 2, x1: p.x + w / 2, y1: p.y + gap - 2 + h }, x: p.x, y: p.y + gap - 2 + size * 0.85, anchor: 'middle', dir: [0, 1] },
      { box: { x0: p.x - w / 2, y0: p.y - gap + 2 - h, x1: p.x + w / 2, y1: p.y - gap + 2 }, x: p.x, y: p.y - gap + 2 - size * 0.2, anchor: 'middle', dir: [0, -1] },
      { box: { x0: p.x + d, y0: p.y - d - h, x1: p.x + d + w, y1: p.y - d }, x: p.x + d, y: p.y - d - size * 0.2, anchor: 'start', dir: [R, -R] },
      { box: { x0: p.x + d, y0: p.y + d, x1: p.x + d + w, y1: p.y + d + h }, x: p.x + d, y: p.y + d + size * 0.85, anchor: 'start', dir: [R, R] },
      { box: { x0: p.x - d - w, y0: p.y - d - h, x1: p.x - d, y1: p.y - d }, x: p.x - d, y: p.y - d - size * 0.2, anchor: 'end', dir: [-R, -R] },
      { box: { x0: p.x - d - w, y0: p.y + d, x1: p.x - d, y1: p.y + d + h }, x: p.x - d, y: p.y + d + size * 0.85, anchor: 'end', dir: [-R, R] },
    ];

    const own = { x0: p.x - 7, y0: p.y - 7, x1: p.x + 7, y1: p.y + 7 };
    const stationArms = arms.get(station.code) ?? [];
    let best: (typeof candidates)[number] | null = null;
    let bestCost = Infinity;
    candidates.forEach((c, i) => {
      if (!onScreen(c.box)) return;
      if (boxes.some((b) => overlaps(b, c.box))) return;
      // Forced names may cover a stop marker; others must not.
      if (priority !== 0 && markers.some((m) => !overlaps(m, own) && overlaps(m, c.box))) return;
      // Text sits a pixel inside its box; don't count lines that only graze it.
      const inner = { x0: c.box.x0 + 1, y0: c.box.y0 + 2, x1: c.box.x1 - 1, y1: c.box.y1 - 2 };
      const crossings = grid.crossings(inner);
      // An ordinary stop that would sit on a line is better left unnamed.
      if (priority === 4 && crossings > 0) return;
      // Pointing down one of its own lines is the worst look short of a crossing.
      let along = 0;
      for (const a of stationArms) along = Math.max(along, a.x * c.dir[0] + a.y * c.dir[1]);
      const cost = crossings * 4 + Math.max(0, along) * 2 + i * 0.03;
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
      }
    });
    const fit = best as (typeof candidates)[number] | null;
    if (!fit) continue;
    boxes.push({ x0: fit.box.x0 - 2, y0: fit.box.y0 - 1, x1: fit.box.x1 + 2, y1: fit.box.y1 + 1 });
    placed.push({ code: station.code, text, x: fit.x, y: fit.y, anchor: fit.anchor, size, weight, priority });
  }
  return placed;
}
