import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { onColor } from '../theme';

interface Props {
  /** "Yellow Line", "Line 2" or "Aqua". The trailing "Line" is dropped. */
  name: string;
  color: string;
  /** Adds a small train glyph before the name. */
  icon?: boolean;
  /** Free text after the line name, e.g. "via Sector 51". */
  suffix?: string;
}

/** "Yellow Line" to "Yellow". Every badge is a line, so the word adds nothing. */
export function shortLineName(name: string): string {
  return name.replace(/\s+line$/i, '').trim() || name;
}

/**
 * A line badge in the line's own colour, 22pt tall with 6pt corners, as on
 * the route timeline. Text colour flips to dark on light lines like Yellow.
 */
export function StationLineChip({ name, color, icon = false, suffix }: Props) {
  const fg = onColor(color);
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      {icon ? <Ionicons name="train" size={12} color={fg} /> : null}
      <Text variant="labelMedium" numberOfLines={1} style={[styles.text, { color: fg }]}>
        {shortLineName(name)}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexShrink: 1,
  },
  text: {
    fontWeight: '700',
  },
});
