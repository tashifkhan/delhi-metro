/**
 * Offline journey planning over the export's routing graph.
 *
 * A port of the API's reference router (`api/services/offline_router.py`), so
 * the phone and the server pick the same routes from the same pack. States are
 * (pattern, station) pairs. Riding moves along a pattern; changing pattern at a
 * station, or walking between linked stations, counts as one change. Costs are
 * compared as tuples:
 *
 *   least-distance       (km, minutes, changes)
 *   minimum-interchange  (changes, minutes, km)
 *
 * Sampled Sarthi routes ship as overrides and win over the search when one
 * exists for the pair and strategy.
 *
 * Pure: no React, no storage.
 */

import type { RouteStrategy } from '../types';
import type { PackOverride, PackPattern } from './bundle';

export interface Graph {
  patterns: PackPattern[];
  changes: { station: string; minutes: number }[];
  walks: { from: string; to: string; minutes: number; metres: number | null }[];
}

type EdgeKind = 'ride' | 'change' | 'walk';

interface Edge {
  target: number;
  kind: EdgeKind;
  minutes: number;
  km: number;
}

export interface RouteLeg {
  kind: 'metro' | 'transfer';
  /** Pattern id for a metro leg, null for a walk. */
  pattern: string | null;
  origin: string;
  destination: string;
  /** Qualified station keys in travel order, both ends included. */
  stops: string[];
  minutes: number;
  km: number;
}

export interface OfflineRoute {
  legs: RouteLeg[];
  changes: number;
  minutes: number;
  km: number;
  /** True when the route came from a sampled Sarthi answer, not the search. */
  fromOverride: boolean;
}

type Cost = [number, number, number];

const AIRPORT_PATTERN = 'dmrc:LN10';
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function less(a: Cost, b: Cost): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** A binary heap of [cost, state] ordered by cost. */
class Heap {
  private items: [Cost, number][] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: [Cost, number]): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!less(a[i][0], a[parent][0])) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop(): [Cost, number] | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l][0], a[m][0])) m = l;
        if (r < a.length && less(a[r][0], a[m][0])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

function patternPairs(pattern: PackPattern): [string, string][] {
  const stops = pattern.loop ? [...pattern.stops, pattern.stops[pattern.loop_start ?? 0]] : pattern.stops;
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < stops.length; i += 1) pairs.push([stops[i], stops[i + 1]]);
  return pairs;
}

export class OfflineRouter {
  private readonly statePattern: string[] = [];
  private readonly stateStation: string[] = [];
  private readonly edges: Edge[][] = [];
  private readonly byStation = new Map<string, number[]>();
  private readonly patterns = new Map<string, PackPattern>();
  private readonly walkMinutes = new Map<string, { minutes: number; km: number }>();

  constructor(graph: Graph, private readonly overrides: PackOverride[] = []) {
    const index = new Map<string, number>();
    const stateOf = (patternId: string, station: string) => {
      const key = `${patternId}|${station}`;
      let id = index.get(key);
      if (id === undefined) {
        id = this.statePattern.length;
        index.set(key, id);
        this.statePattern.push(patternId);
        this.stateStation.push(station);
        this.edges.push([]);
        const list = this.byStation.get(station) ?? [];
        list.push(id);
        this.byStation.set(station, list);
      }
      return id;
    };

    for (const pattern of graph.patterns) {
      this.patterns.set(pattern.id, pattern);
      for (const stop of pattern.stops) stateOf(pattern.id, stop);
      patternPairs(pattern).forEach(([from, to], i) => {
        const hop = pattern.hops[i];
        if (!hop) return;
        const a = stateOf(pattern.id, from);
        const b = stateOf(pattern.id, to);
        this.edges[a].push({ target: b, kind: 'ride', minutes: hop.minutes, km: hop.km });
        if (hop.reverse_minutes !== null) {
          this.edges[b].push({ target: a, kind: 'ride', minutes: hop.reverse_minutes, km: hop.km });
        }
      });
    }

    const changeMinutes = new Map(graph.changes.map((c) => [c.station, c.minutes]));
    for (const [station, states] of this.byStation) {
      const minutes = changeMinutes.get(station) ?? 5;
      for (const a of states) {
        for (const b of states) {
          if (a !== b) this.edges[a].push({ target: b, kind: 'change', minutes, km: 0 });
        }
      }
    }

    for (const walk of graph.walks) {
      const km = (walk.metres ?? 0) / 1000;
      this.walkMinutes.set(`${walk.from}|${walk.to}`, { minutes: walk.minutes, km });
      this.walkMinutes.set(`${walk.to}|${walk.from}`, { minutes: walk.minutes, km });
      for (const a of this.byStation.get(walk.from) ?? []) {
        for (const b of this.byStation.get(walk.to) ?? []) {
          this.edges[a].push({ target: b, kind: 'walk', minutes: walk.minutes, km });
          this.edges[b].push({ target: a, kind: 'walk', minutes: walk.minutes, km });
        }
      }
    }
  }

  hasStation(key: string): boolean {
    return this.byStation.has(key);
  }

  pattern(id: string): PackPattern | undefined {
    return this.patterns.get(id);
  }

  route(
    origin: string,
    destination: string,
    strategy: RouteStrategy,
    { excludeAirport = false }: { excludeAirport?: boolean } = {},
  ): OfflineRoute | null {
    if (origin === destination) return null;
    const fromOverride = this.fromOverride(origin, destination, strategy, excludeAirport);
    if (fromOverride) return fromOverride;
    return this.search(origin, destination, strategy, excludeAirport);
  }

  private search(origin: string, destination: string, strategy: RouteStrategy, excludeAirport: boolean) {
    const network = (key: string) => key.split(':', 1)[0];
    // A trip within one operator stays on that operator's lines.
    const onlyNetwork = network(origin) === network(destination) ? network(origin) : null;
    const allowed = (state: number) =>
      !(excludeAirport && this.statePattern[state] === AIRPORT_PATTERN) &&
      (onlyNetwork === null || network(this.stateStation[state]) === onlyNetwork);

    const fewestChanges = strategy === 'minimum-interchange';
    const costs = new Map<number, Cost>();
    const previous = new Map<number, { from: number; edge: Edge }>();
    const heap = new Heap();
    for (const state of this.byStation.get(origin) ?? []) {
      if (!allowed(state)) continue;
      costs.set(state, [0, 0, 0]);
      heap.push([[0, 0, 0], state]);
    }

    while (heap.size > 0) {
      const [cost, state] = heap.pop()!;
      const known = costs.get(state);
      if (!known || less(known, cost) || less(cost, known)) continue;
      for (const edge of this.edges[state]) {
        if (!allowed(edge.target)) continue;
        const change = edge.kind === 'ride' ? 0 : 1;
        const candidate: Cost = fewestChanges
          ? [cost[0] + change, cost[1] + edge.minutes, round6(cost[2] + edge.km)]
          : [round6(cost[0] + edge.km), cost[1] + edge.minutes, cost[2] + change];
        const current = costs.get(edge.target);
        if (!current || less(candidate, current)) {
          costs.set(edge.target, candidate);
          previous.set(edge.target, { from: state, edge });
          heap.push([candidate, edge.target]);
        }
      }
    }

    let best: number | null = null;
    for (const state of this.byStation.get(destination) ?? []) {
      const cost = costs.get(state);
      if (cost && (best === null || less(cost, costs.get(best)!))) best = state;
    }
    if (best === null) return null;
    const [first, minutes, third] = costs.get(best)!;

    const steps: { from: number; edge: Edge }[] = [];
    for (let state = best; previous.has(state); state = previous.get(state)!.from) {
      steps.push(previous.get(state)!);
    }
    steps.reverse();

    const legs: RouteLeg[] = [];
    for (const { from, edge } of steps) {
      if (edge.kind === 'change') continue;
      const origin = this.stateStation[from];
      const target = this.stateStation[edge.target];
      const pattern = this.statePattern[from];
      const last = legs[legs.length - 1];
      if (edge.kind === 'walk') {
        legs.push({ kind: 'transfer', pattern: null, origin, destination: target, stops: [origin, target], minutes: edge.minutes, km: edge.km });
      } else if (last && last.kind === 'metro' && last.pattern === pattern) {
        last.destination = target;
        last.stops.push(target);
        last.minutes += edge.minutes;
        last.km = round6(last.km + edge.km);
      } else {
        legs.push({ kind: 'metro', pattern, origin, destination: target, stops: [origin, target], minutes: edge.minutes, km: edge.km });
      }
    }

    return {
      legs,
      changes: fewestChanges ? first : third,
      minutes,
      km: fewestChanges ? third : first,
      fromOverride: false,
    };
  }

  /** Time and distance along a pattern through the given stops, either direction. */
  private ride(patternId: string, stops: string[]): { minutes: number; km: number } | null {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return null;
    const pairs = patternPairs(pattern);
    let minutes = 0;
    let km = 0;
    for (let i = 0; i + 1 < stops.length; i += 1) {
      const forward = pairs.findIndex(([a, b]) => a === stops[i] && b === stops[i + 1]);
      if (forward >= 0) {
        minutes += pattern.hops[forward].minutes;
        km += pattern.hops[forward].km;
        continue;
      }
      const back = pairs.findIndex(([a, b]) => b === stops[i] && a === stops[i + 1]);
      const hop = back >= 0 ? pattern.hops[back] : null;
      if (!hop || hop.reverse_minutes === null) return null;
      minutes += hop.reverse_minutes;
      km += hop.km;
    }
    return { minutes, km: round6(km) };
  }

  private fromOverride(origin: string, destination: string, strategy: RouteStrategy, excludeAirport: boolean): OfflineRoute | null {
    const match = this.overrides.find((o) => o.from === origin && o.to === destination && o.strategy === strategy);
    if (!match) return null;
    if (excludeAirport && match.legs.some((leg) => leg.pattern === AIRPORT_PATTERN)) return null;

    const legs: RouteLeg[] = [];
    for (const leg of match.legs) {
      if (leg.kind === 'transfer') {
        const walk = this.walkMinutes.get(`${leg.origin}|${leg.destination}`);
        if (!walk) return null;
        legs.push({ kind: 'transfer', pattern: null, origin: leg.origin, destination: leg.destination, stops: [...leg.stops], ...walk });
      } else {
        const ride = leg.pattern ? this.ride(leg.pattern, leg.stops) : null;
        // An override that no longer fits the graph is ignored, not trusted.
        if (!ride) return null;
        legs.push({ kind: 'metro', pattern: leg.pattern, origin: leg.origin, destination: leg.destination, stops: [...leg.stops], ...ride });
      }
    }
    const changeMinutes = (station: string) => {
      const states = this.byStation.get(station) ?? [];
      const edge = states.length ? this.edges[states[0]].find((e) => e.kind === 'change') : undefined;
      return edge?.minutes ?? 5;
    };
    let minutes = 0;
    legs.forEach((leg, i) => {
      minutes += leg.minutes;
      if (i > 0 && leg.kind === 'metro' && legs[i - 1].kind === 'metro') minutes += changeMinutes(leg.origin);
    });
    return {
      legs,
      changes: Math.max(0, legs.length - 1),
      minutes,
      km: round6(legs.reduce((sum, leg) => sum + leg.km, 0)),
      fromOverride: true,
    };
  }
}
