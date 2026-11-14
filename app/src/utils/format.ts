/**
 * Display formatting for upstream strings.
 *
 * DMRC returns station names in capitals and times with seconds. Both read as
 * machine output on screen, so they pass through here before display.
 */

// Station names that are initialisms and must stay in capitals.
const ACRONYMS = new Set([
  'AIIMS', 'DLF', 'GTB', 'IFFCO', 'IGI', 'IIT', 'INA', 'ISBT', 'ITO', 'JLN', 'MG', 'NIA', 'NSIC',
  'DDA', 'ESI', 'IGNOU', 'NHPC', 'NSEZ', 'KG',
]);

/** "HAUZ KHAS" to "Hauz Khas". Names already in mixed case are left alone. */
export function stationName(name: string): string {
  if (!name || name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\b[A-Za-z]+\b/g, (word) =>
      ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word,
    );
}

/** "23:32:06" to "23:32". Anything else passes through. */
export function clockTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : value;
}

/** "00:18:18" to "18 min", "01:05:00" to "1 h 5 min". Anything else passes through. */
export function durationLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return value.replace(/\bmins\b/, 'min');
  const hours = Number(match[1]);
  const minutes = Number(match[2]) + (Number(match[3]) >= 30 ? 1 : 0);
  if (hours === 0) return `${minutes} min`;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}
