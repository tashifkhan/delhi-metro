import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { rgba } from '../theme/colorMath';
import { emphasis, spacing, tabular } from '../theme';

export interface PassColumn {
  label: string;
  value: string;
  note?: string;
  /** Line colour dot beside the note. */
  color?: string;
}

interface Props {
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  date: string;
  duration: string;
  columns: [PassColumn, PassColumn];
}

const NOTCH = 24;

/**
 * Journey summary drawn as a ticket stub: station codes on top, a perforated
 * tear line, then the fare columns. It sits on the page background, so the
 * notches are cut with that colour.
 */
export function TicketPass({ fromCode, toCode, fromName, toName, date, duration, columns }: Props) {
  const theme = useTheme();
  const fg = theme.colors.onPrimary;
  const soft = rgba(fg, 0.16);

  return (
    <View
      style={[styles.pass, { backgroundColor: theme.colors.primary }]}
      accessible
      accessibilityLabel={`${fromName} to ${toName}, ${duration}. ${columns
        .map((c) => `${c.label} ${c.value}`)
        .join(', ')}`}
    >
      <View style={styles.top}>
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: soft }]}>
            <Ionicons name="calendar-outline" size={14} color={fg} />
            <Text variant="labelMedium" style={[emphasis.strong, { color: fg }]}>
              {date}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: soft }]}>
            <Ionicons name="time-outline" size={14} color={fg} />
            <Text variant="labelMedium" style={[emphasis.strong, { color: fg }]}>
              {duration}
            </Text>
          </View>
        </View>

        <View style={styles.ends}>
          <View style={styles.end}>
            <Text variant="headlineMedium" numberOfLines={1} adjustsFontSizeToFit style={[styles.code, { color: fg }]}>
              {fromCode}
            </Text>
            <Text variant="bodySmall" numberOfLines={1} style={[styles.endName, { color: fg }]}>
              {fromName}
            </Text>
          </View>
          <View style={styles.mid}>
            <View style={[styles.dash, { borderColor: rgba(fg, 0.6) }]} />
            <View style={[styles.trainTile, { backgroundColor: fg }]}>
              <Ionicons name="train" size={18} color={theme.colors.primary} />
            </View>
            <View style={[styles.dash, { borderColor: rgba(fg, 0.6) }]} />
          </View>
          <View style={[styles.end, styles.endRight]}>
            <Text variant="headlineMedium" numberOfLines={1} adjustsFontSizeToFit style={[styles.code, { color: fg }]}>
              {toCode}
            </Text>
            <Text variant="bodySmall" numberOfLines={1} style={[styles.endName, styles.right, { color: fg }]}>
              {toName}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.perfRow}>
        <View style={[styles.notch, styles.notchLeft, { backgroundColor: theme.colors.background }]} />
        <View style={[styles.perf, { borderColor: rgba(fg, 0.35) }]} />
        <View style={[styles.notch, styles.notchRight, { backgroundColor: theme.colors.background }]} />
      </View>

      <View style={styles.columns}>
        {columns.map((column, index) => (
          <View key={column.label} style={[styles.column, index === 1 && styles.endRight]}>
            <Text variant="labelSmall" style={[styles.colLabel, { color: fg }]}>
              {column.label}
            </Text>
            <Text variant="headlineSmall" style={[emphasis.strong, tabular, { color: fg }]}>
              {column.value}
            </Text>
            {column.note ? (
              <View style={[styles.noteRow, index === 1 && styles.noteRight]}>
                {column.color ? <View style={[styles.dot, { backgroundColor: column.color }]} /> : null}
                <Text variant="bodySmall" numberOfLines={1} style={[styles.noteText, { color: fg }]}>
                  {column.note}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pass: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  top: {
    paddingHorizontal: spacing.lg,
    paddingTop: 18,
    paddingBottom: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 9,
  },
  ends: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    gap: spacing.sm,
  },
  end: {
    flex: 1,
    minWidth: 0,
  },
  endRight: {
    alignItems: 'flex-end',
  },
  code: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  endName: {
    opacity: 0.8,
    marginTop: 4,
  },
  right: {
    textAlign: 'right',
  },
  mid: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 92,
  },
  dash: {
    flex: 1,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  trainTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perfRow: {
    height: NOTCH,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
  },
  notchLeft: {
    marginLeft: -NOTCH / 2,
  },
  notchRight: {
    marginRight: -NOTCH / 2,
  },
  perf: {
    flex: 1,
    marginHorizontal: 6,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  columns: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 18,
    gap: 10,
  },
  column: {
    flex: 1,
    gap: 2,
  },
  colLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.75,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  noteRight: {
    justifyContent: 'flex-end',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noteText: {
    opacity: 0.85,
    flexShrink: 1,
  },
});
