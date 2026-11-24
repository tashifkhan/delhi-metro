import type { SavedPlace } from './model';

/** Launchers show four shortcuts at most; most show four. */
export const MAX_SHORTCUTS = 4;

export interface ShortcutItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string | null;
  params: { code: string; name: string };
}

const SF_SYMBOLS: Record<string, string> = {
  home: 'symbol:house',
  work: 'symbol:briefcase',
  office: 'symbol:briefcase',
  college: 'symbol:graduationcap',
  school: 'symbol:graduationcap',
  gym: 'symbol:dumbbell',
};

/**
 * Launcher shortcuts for saved places: "From Home", "From Work". Pure, so the
 * list can be tested without the native module. iOS gets a matching symbol;
 * Android shows the app icon.
 */
export function shortcutsFor(places: SavedPlace[], limit = MAX_SHORTCUTS): ShortcutItem[] {
  return places.slice(0, limit).map((place) => ({
    id: `place:${place.label.toLowerCase()}`,
    title: `From ${place.label}`,
    subtitle: place.station.name,
    icon: SF_SYMBOLS[place.label.trim().toLowerCase()] ?? 'symbol:mappin',
    params: { code: place.station.code, name: place.station.name },
  }));
}
