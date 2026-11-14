/**
 * Which station names to draw, and where, at the current zoom.
 *
 * Names are placed in priority order (the selected station and route stops,
 * then line ends, then interchanges, then everything else) in screen space.
 * Each tries four spots around its marker and is skipped if every spot
 * overlaps a name already placed or another station's marker. Dense centres
 * keep their important names; quiet suburbs show every stop.
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

export function placeLabels(input: LabelInput): PlacedLabel[] {
  const { stations, lines, toScreen, width, height, span, forced = [], preferred, muted, obstacles = [] } = input;
  const ends = terminalCodes(lines);
  const forcedSet = new Set(forced);

  // Ordinary stops only once there's room for them.
  const showStops = span < 11_000;
  const showInterchanges = true;

  const ranked = stations
    .map((station) => {
      let priority: number;
      if (forcedSet.has(station.code)) priority = 0;
      else if (preferred?.has(station.code)) priority = 1;
      else if (ends.has(station.code)) priority = 2;
      else if (station.interchange) priority = 3;
      else priority = 4;
      return { station, priority };
    })
    .filter(({ station, priority }) => {
      if (priority <= 1) return true;
      if (muted?.has(station.code)) return false;
      if (priority === 2 || priority === 3) return showInterchanges;
      return showStops;
    })
    .sort((a, b) => a.priority - b.priority || forced.indexOf(a.station.code) - forced.indexOf(b.station.code));

  // Every marker on screen is an obstacle, so names don't sit on top of stops.
  const markers: Box[] = [];
  const screen = new Map<string, { x: number; y: number }>();
  for (const station of stations) {
    const p = toScreen(station.x, station.y);
    screen.set(station.code, p);
    if (p.x < -40 || p.y < -40 || p.x > width + 40 || p.y > height + 40) continue;
    const r = station.interchange ? 6 : 4;
    markers.push({ x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r });
  }

  const placed: PlacedLabel[] = [];
  const boxes: Box[] = [...obstacles];
  for (const { station, priority } of ranked) {
    if (placed.length >= MAX_LABELS) break;
    const p = screen.get(station.code)!;
    if (p.x < -20 || p.y < -20 || p.x > width + 20 || p.y > height + 20) continue;

    const text = mapLabel(station.name);
    if (!text) continue;
    const size = priority <= 1 ? 13 : priority <= 3 ? 12 : 11;
    const weight: PlacedLabel['weight'] = priority === 0 ? '700' : priority <= 3 ? '600' : '500';
    const w = textWidth(text, size, weight);
    const h = size + 2;
    // Forced names sit beside bigger markers: the selected tile, route ends.
    const gap = priority === 0 ? 17 : station.interchange || priority === 1 ? 10 : 7;

    // Right, left, below, above, then the four diagonals.
    const d = gap * 0.75;
    const sideY = p.y + size * 0.35;
    const candidates: Array<{ box: Box; x: number; y: number; anchor: PlacedLabel['anchor'] }> = [
      { box: { x0: p.x + gap, y0: p.y - h / 2, x1: p.x + gap + w, y1: p.y + h / 2 }, x: p.x + gap, y: sideY, anchor: 'start' },
      { box: { x0: p.x - gap - w, y0: p.y - h / 2, x1: p.x - gap, y1: p.y + h / 2 }, x: p.x - gap, y: sideY, anchor: 'end' },
      { box: { x0: p.x - w / 2, y0: p.y + gap - 2, x1: p.x + w / 2, y1: p.y + gap - 2 + h }, x: p.x, y: p.y + gap - 2 + size * 0.85, anchor: 'middle' },
      { box: { x0: p.x - w / 2, y0: p.y - gap + 2 - h, x1: p.x + w / 2, y1: p.y - gap + 2 }, x: p.x, y: p.y - gap + 2 - size * 0.2, anchor: 'middle' },
      { box: { x0: p.x + d, y0: p.y - d - h, x1: p.x + d + w, y1: p.y - d }, x: p.x + d, y: p.y - d - size * 0.2, anchor: 'start' },
      { box: { x0: p.x + d, y0: p.y + d, x1: p.x + d + w, y1: p.y + d + h }, x: p.x + d, y: p.y + d + size * 0.85, anchor: 'start' },
      { box: { x0: p.x - d - w, y0: p.y - d - h, x1: p.x - d, y1: p.y - d }, x: p.x - d, y: p.y - d - size * 0.2, anchor: 'end' },
      { box: { x0: p.x - d - w, y0: p.y + d, x1: p.x - d, y1: p.y + d + h }, x: p.x - d, y: p.y + d + size * 0.85, anchor: 'end' },
    ];
    // Names must fit on screen, or they read as cut-off fragments.
    const onScreen = (box: Box) => box.x0 >= 2 && box.x1 <= width - 2 && box.y0 >= 2 && box.y1 <= height - 2;

    const own = { x0: p.x - 7, y0: p.y - 7, x1: p.x + 7, y1: p.y + 7 };
    const fit = candidates.find(
      ({ box }) =>
        onScreen(box) &&
        !boxes.some((b) => overlaps(b, box)) &&
        // Forced names may cover a stop marker; others must not.
        (priority === 0 || !markers.some((m) => !overlaps(m, own) && overlaps(m, box))),
    );
    if (!fit) continue;
    boxes.push({ x0: fit.box.x0 - 2, y0: fit.box.y0 - 1, x1: fit.box.x1 + 2, y1: fit.box.y1 + 1 });
    placed.push({ code: station.code, text, x: fit.x, y: fit.y, anchor: fit.anchor, size, weight, priority });
  }
  return placed;
}
