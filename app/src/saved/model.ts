/**
 * Saved trips and places.
 *
 * A trip is a from/to pair, not a stored plan: opening it plans again, so it
 * always reflects today's lines, fares and timings. A place is a labelled
 * station ("Home", "Work") that starts a trip from there.
 *
 * Everything is keyed by station code, never by name, so a station rename
 * upstream doesn't orphan anything. Names are kept only to draw the list
 * before the station catalog has loaded.
 *
 * Pure functions over plain data; storage lives in `repository.ts`.
 */

export interface SavedStation {
  code: string;
  name: string;
}

export interface SavedTrip {
  from: SavedStation;
  to: SavedStation;
  savedAt: number;
}

export interface SavedPlace {
  label: string;
  station: SavedStation;
}

export interface SavedState {
  trips: SavedTrip[];
  places: SavedPlace[];
}

export const EMPTY_SAVED: SavedState = { trips: [], places: [] };

/** Labels offered when adding a place; any other label also works. */
export const SUGGESTED_PLACES = ['Home', 'Work', 'College', 'Gym'] as const;

const MAX_LABEL = 24;

function sameCode(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export function tripKey(fromCode: string, toCode: string): string {
  return `${fromCode.trim().toUpperCase()}>${toCode.trim().toUpperCase()}`;
}

export function isTripSaved(state: SavedState, fromCode: string, toCode: string): boolean {
  return state.trips.some((t) => sameCode(t.from.code, fromCode) && sameCode(t.to.code, toCode));
}

/** Save, or remove when already saved. Newest first. */
export function toggleTrip(
  state: SavedState,
  from: SavedStation,
  to: SavedStation,
  now: number,
): SavedState {
  if (sameCode(from.code, to.code)) return state;
  if (isTripSaved(state, from.code, to.code)) {
    return {
      ...state,
      trips: state.trips.filter((t) => !(sameCode(t.from.code, from.code) && sameCode(t.to.code, to.code))),
    };
  }
  return { ...state, trips: [{ from, to, savedAt: now }, ...state.trips] };
}

/** Collapse whitespace and trim; empty means no label. */
export function cleanLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
}

/**
 * Add a place, or point an existing label at a new station. Labels match
 * case-insensitively, and a relabelled place keeps its position.
 */
export function setPlace(state: SavedState, rawLabel: string, station: SavedStation): SavedState {
  const label = cleanLabel(rawLabel);
  if (!label) return state;
  const index = state.places.findIndex((p) => p.label.toLowerCase() === label.toLowerCase());
  if (index >= 0) {
    const places = [...state.places];
    places[index] = { label: places[index].label, station };
    return { ...state, places };
  }
  return { ...state, places: [...state.places, { label, station }] };
}

export function removePlace(state: SavedState, label: string): SavedState {
  return { ...state, places: state.places.filter((p) => p.label.toLowerCase() !== label.toLowerCase()) };
}

export function removeTrip(state: SavedState, fromCode: string, toCode: string): SavedState {
  return {
    ...state,
    trips: state.trips.filter((t) => !(sameCode(t.from.code, fromCode) && sameCode(t.to.code, toCode))),
  };
}

function isStation(value: unknown): value is SavedStation {
  const s = value as SavedStation;
  return typeof s === 'object' && s !== null && typeof s.code === 'string' && s.code.length > 0 && typeof s.name === 'string';
}

/** Read stored JSON defensively: anything malformed is dropped, not thrown. */
export function decodeSaved(raw: unknown): SavedState {
  const value = raw as Partial<SavedState> | null;
  if (!value || typeof value !== 'object') return EMPTY_SAVED;
  const trips = Array.isArray(value.trips)
    ? value.trips.filter(
        (t): t is SavedTrip =>
          isStation(t?.from) && isStation(t?.to) && typeof t.savedAt === 'number',
      )
    : [];
  const places = Array.isArray(value.places)
    ? value.places.filter(
        (p): p is SavedPlace => typeof p?.label === 'string' && cleanLabel(p.label) !== '' && isStation(p.station),
      )
    : [];
  return { trips, places };
}
