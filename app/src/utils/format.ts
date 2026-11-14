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

function titleWord(word: string): string {
  const upper = word.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * "HAUZ KHAS" to "Hauz Khas". DMRC also mixes cases inside one name, as in
 * "NEW DELHI (Yellow & Airport Line)" or "SEVA TEERTH (earlier UDYOG
 * BHAWAN))", so every all-capital word is fixed on its own, stray brackets
 * are tidied, and "Sector - 52" becomes "Sector 52".
 */
export function stationName(name: string): string {
  if (!name) return name;
  return name
    .replace(/\b[A-Z][A-Z.']+\b/g, (word) =>
      word.replace(/[A-Za-z]+/g, (part) => titleWord(part)),
    )
    .replace(/\bSector\s*-\s*(\d)/gi, 'Sector $1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\){2,}/g, ')')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
