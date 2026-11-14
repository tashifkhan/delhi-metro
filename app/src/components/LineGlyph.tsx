import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { onColor } from '../theme';
import { stationName } from '../utils/format';
import type { MetroLine } from '../types';

/**
 * Display names for metro lines.
 *
 * The API's `line_color` is the name riders use ("Yellow Line"), `name` is the
 * operator's number ("Line 2"). A few lines carry an internal code in
 * `line_color` instead (RMGL, FOB), so those fall back to `name`.
 */
export function lineTitle(line: Pick<MetroLine, 'name' | 'line_color'>): string {
  const color = line.line_color?.trim() ?? '';
  if (!color || /^[A-Z]{2,5}$/.test(color)) return line.name;
  return color.replace(/\(Ext\.\)/i, 'extension').replace(/\s+/g, ' ').trim();
}

/** "Line 2" stays as the secondary label, but not when it repeats the title. */
export function lineSubtitle(line: Pick<MetroLine, 'name' | 'line_color'>): string | null {
  const title = lineTitle(line);
  return title === line.name ? null : line.name;
}

/** Short glyph for the badge: the line number, or the first letter. */
export function lineGlyph(line: Pick<MetroLine, 'name' | 'line_color' | 'line_code'>): string {
  const number = line.name.match(/^Line\s+(\d+)/i)?.[1];
  if (number) return number;
  return lineTitle(line).charAt(0).toUpperCase();
}

/**
 * Station names as shown on the Lines screens.
 *
 * `stationName` leaves mixed-case names alone, but DMRC mixes them: "NEW DELHI
 * (Yellow & Airport Line)". Casing each all-capital word fixes those too, and
 * `stationName` keeps initialisms such as AIIMS and INA in capitals.
 */
/** Kept as a name for line screens; the shared rule lives in `stationName`. */
export function lineStationName(name: string): string {
  return stationName(name);
}

/** Terminal names, also folding "Sector - 21" into "Sector 21". */
export function terminalName(name: string): string {
  return lineStationName(name.replace(/\s+-\s+/g, ' '));
}

interface Props {
  color: string;
  glyph: string;
  size?: number;
}

/** Rounded-square badge in the line colour carrying its number or letter. */
export function LineGlyph({ color, glyph, size = 40 }: Props) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: color },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: onColor(color), fontSize: Math.round(size * (glyph.length > 1 ? 0.36 : 0.44)) },
        ]}
      >
        {glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
  },
});
