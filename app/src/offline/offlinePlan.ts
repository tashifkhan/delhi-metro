import type {
  FareClass,
  MetroNetwork,
  NetworkFare,
  PlannedFare,
  PlannedJourney,
  PlannedLeg,
  RouteStrategy,
} from '../types';
import type { PackBundle, PackFares, PackStation } from './bundle';
import { stationKey } from './bundle';
import { OfflineRouter, type OfflineRoute } from './router';

/**
 * Plan a journey from the offline pack, in the same shape the API returns, so
 * the results screen needs no second layout. The plan says where it came from
 * (`source: 'offline'`) and the screen labels it as an estimate.
 */

const networkOf = (key: string) => key.split(':', 1)[0] as MetroNetwork;
const codeOf = (key: string) => key.split(':').slice(1).join(':');

function minutesLabel(minutes: number): string {
  return `${Math.max(1, Math.round(minutes))} mins`;
}

function slabFare<T extends { normal: number; special: number }>(slabs: T[], fits: (slab: T) => boolean): { normal: number; special: number } | null {
  const slab = slabs.find(fits) ?? slabs[slabs.length - 1];
  return slab ? { normal: slab.normal, special: slab.special } : null;
}

/**
 * Fare per operator: Delhi Metro by distance slab, Noida Metro by stations
 * travelled, NCRTC from its published fare table. Each operator is a separate
 * ticket, so a trip on two of them is priced as two parts.
 */
export function offlineFare(route: OfflineRoute, fares: PackFares | undefined): PlannedFare {
  const parts: (NetworkFare & { classes?: FareClass[] })[] = [];
  const metro = route.legs.filter((leg) => leg.kind === 'metro');
  const networks = [...new Set(metro.map((leg) => networkOf(leg.origin)))];

  for (const network of networks) {
    const legs = metro.filter((leg) => networkOf(leg.origin) === network);
    let price: { normal: number; special: number } | null = null;
    let classes: FareClass[] | undefined;
    if (network === 'dmrc' && fares) {
      const km = legs.reduce((sum, leg) => sum + leg.km, 0);
      price = slabFare(fares.dmrc_distance_slabs, (s) => s.max_km === null || km <= s.max_km);
    } else if (network === 'nmrc' && fares) {
      const hops = legs.reduce((sum, leg) => sum + leg.stops.length - 1, 0);
      price = slabFare(fares.nmrc_station_count_slabs, (s) => hops <= s.max_stations);
    } else if (network === 'ncrtc' && fares) {
      const from = legs[0].origin;
      const to = legs[legs.length - 1].destination;
      const rows = fares.ncrtc_fare_matrix.filter((r) => r.from === from && r.to === to);
      const standard = rows.find((r) => r.class === 'standard');
      if (standard) price = { normal: standard.amount, special: standard.amount };
      // Premium is sold only on Namo Bharat trains.
      const premium = rows.find((r) => r.class === 'premium');
      // Namo Bharat patterns are ncrtc:RRTS…; Meerut Metro is ncrtc:MRTS.
      const onNamoBharat = legs.some((leg) => (leg.pattern ?? '').startsWith('ncrtc:RRTS'));
      if (premium && standard && onNamoBharat) {
        classes = [
          { class: 'standard', amount: standard.amount },
          { class: 'premium', amount: premium.amount },
        ];
      }
    }
    if (price) parts.push({ network, normal: price.normal, special: price.special, applicable: null, classes });
  }

  const sum = (pick: (p: NetworkFare) => number) => parts.reduce((total, p) => total + pick(p), 0);
  return {
    normal: sum((p) => p.normal),
    special: parts.length ? sum((p) => p.special ?? p.normal) : null,
    applicable: null,
    smart_card: null,
    classes: parts.find((p) => p.classes)?.classes ?? [],
    breakdown: parts.length > 1 ? parts.map(({ classes: _c, ...part }) => part) : [],
  };
}

export function buildOfflinePlan(
  bundle: PackBundle,
  router: OfflineRouter,
  fromCode: string,
  toCode: string,
  strategy: RouteStrategy,
): PlannedJourney | null {
  const stations = bundle.sections.stations ?? [];
  const byKey = new Map<string, PackStation>(stations.map((s) => [stationKey(s.network, s.code), s]));
  const resolve = (code: string) => stations.find((s) => s.code.trim().toUpperCase() === code.trim().toUpperCase());
  const from = resolve(fromCode);
  const to = resolve(toCode);
  if (!from || !to) return null;
  const origin = stationKey(from.network, from.code);
  const destination = stationKey(to.network, to.code);
  if (!router.hasStation(origin) || !router.hasStation(destination)) return null;

  const route = router.route(origin, destination, strategy);
  if (!route || route.legs.length === 0) return null;

  const nameOf = (key: string) => byKey.get(key)?.detail.station_name ?? byKey.get(key)?.name ?? codeOf(key);
  const planned = (key: string) => ({
    name: nameOf(key),
    code: codeOf(key),
    slug: null,
    legacy_code: null,
    sarthi_code: null,
    status: null,
  });

  const legs: PlannedLeg[] = route.legs.map((leg) => {
    const pattern = leg.pattern ? router.pattern(leg.pattern) : undefined;
    return {
      kind: leg.kind,
      network: leg.kind === 'metro' ? networkOf(leg.origin) : null,
      source: 'offline',
      walk_metres: null,
      note: leg.kind === 'transfer' ? 'Walk between stations' : null,
      line_name: leg.kind === 'transfer' ? 'Walk' : pattern?.name ?? 'Metro',
      line_number: null,
      line_color: pattern?.color ?? null,
      from_station: nameOf(leg.origin),
      from_station_code: codeOf(leg.origin),
      to_station: nameOf(leg.destination),
      to_station_code: codeOf(leg.destination),
      station_count: leg.stops.length,
      stops: leg.stops.map((key) => ({ name: nameOf(key), status: null })),
      map_path: leg.stops.map(codeOf),
      duration: minutesLabel(leg.minutes),
      distance_km: Math.round(leg.km * 10) / 10,
      direction: null,
      platform_name: null,
      // The direction a train is heading is the last stop of its pattern.
      towards_station: pattern ? nameOf(pattern.stops[pattern.stops.length - 1]) : null,
      start_time: null,
      end_time: null,
      interchange_minutes: leg.kind === 'transfer' ? Math.round(leg.minutes) : null,
    };
  });

  const networks = [...new Set(legs.filter((l) => l.network).map((l) => l.network as MetroNetwork))];
  const rideStops = route.legs.reduce((n, leg) => n + (leg.kind === 'metro' ? leg.stops.length - 1 : 0), 0);

  return {
    source: 'offline',
    networks,
    separate_tickets: networks.length > 1,
    fallback_reason: route.fromOverride ? 'Planned offline from a saved Sarthi route' : 'Planned offline',
    strategy,
    exclude_airport_line: false,
    origin: planned(origin),
    destination: planned(destination),
    station_count: rideStops + 1,
    total_time: minutesLabel(route.minutes),
    total_distance_km: Math.round(route.km * 10) / 10,
    fare: offlineFare(route, bundle.sections.fares),
    legs,
    interchanges: [],
    metro_service: null,
    service_available: null,
    ticket_available: null,
    bookings: [],
  };
}
