import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { OperatorMark } from './OperatorMark';
import { Touchable } from './Touchable';
import { shortLineName } from './StationLineChip';
import { useAppTheme } from '../theme/ThemeContext';
import { NETWORK_NAMES } from '../network';
import { spacing, shape, emphasis, tabular } from '../theme';
import { stationName } from '../utils/format';
import type { MetroNetwork, StationLineBadge } from '../types';

interface StationLike {
  station_name: string;
  station_code: string;
  interchange?: boolean;
  metro_lines?: StationLineBadge[];
}

interface Props {
  station: StationLike;
  onPress?: () => void;
  showChevron?: boolean;
  selected?: boolean;
  /**
   * Operator that runs this station. Shown as its roundel when a list mixes
   * networks, so a Noida Metro station is not mistaken for a Delhi Metro one.
   */
  network?: MetroNetwork;
  /** First and last rows of a group get the large outer corners. */
  first?: boolean;
  last?: boolean;
}

const OUTER = shape.xl;

/**
 * Riders' name for a line. A few lines carry an internal code in `line_color`
 * (RMGL for Rapid Metro), so those use the operator's name instead.
 */
function lineLabel(line: StationLineBadge): string {
  const color = line.line_color?.trim() ?? '';
  if (!color || /^[A-Z]{2,5}$/.test(color)) return shortLineName(line.line_name || color);
  return shortLineName(color);
}
const INNER = shape.sm;

/**
 * One station in a segmented list: tiles with 3pt gaps where only the outer
 * corners of the group are fully rounded, so a result list reads as a block.
 *
 * The station's lines lead the row as a slim colour bar, split into one
 * segment per line, so an interchange shows as a striped bar before reading
 * the names. The bar is quiet on purpose: the name is what people scan for.
 */
export const StationCard = memo(function StationCard({
  station,
  onPress,
  showChevron = true,
  selected,
  network,
  first = true,
  last = true,
}: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  const lines = station.metro_lines ?? [];
  const colors = Array.from(new Set(lines.map((l) => l.primary_color_code).filter(Boolean))).slice(0, 4);
  const isInterchange = Boolean(station.interchange) || colors.length > 1;
  const name = stationName(station.station_name);

  const corners = {
    borderTopLeftRadius: first ? OUTER : INNER,
    borderTopRightRadius: first ? OUTER : INNER,
    borderBottomLeftRadius: last ? OUTER : INNER,
    borderBottomRightRadius: last ? OUTER : INNER,
  };

  return (
    <View style={[styles.wrapper, !last && styles.gap]}>
      <Touchable
        radius={first || last ? OUTER : INNER}
        haptic={showChevron ? 'navigate' : 'select'}
        accessibilityState={{ selected }}
        onPress={onPress}
        accessibilityLabel={`${name}, code ${station.station_code}${
          network ? `, ${NETWORK_NAMES[network]}` : ''
        }${isInterchange ? ', interchange station' : ''}`}
        style={[
          corners,
          {
            backgroundColor: selected ? theme.colors.secondaryContainer : fills.containerLow,
          },
        ]}
      >
        <View style={styles.row}>
          <View style={styles.bar}>
            {colors.length > 0 ? (
              colors.map((color) => (
                <View key={color} style={[styles.segment, { backgroundColor: color }]} />
              ))
            ) : (
              <View style={[styles.segment, { backgroundColor: theme.colors.outlineVariant }]} />
            )}
          </View>

          <View style={styles.content}>
            <Text
              variant="titleMedium"
              style={[emphasis.strong, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <View style={styles.meta}>
              {network ? <OperatorMark network={network} size={14} /> : null}
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={[styles.lineNames, { color: theme.colors.onSurfaceVariant }]}
              >
                {lines.length > 0
                  ? lines.map(lineLabel).join(' · ')
                  : network
                    ? NETWORK_NAMES[network]
                    : ''}
                {isInterchange ? '  ·  Interchange' : ''}
              </Text>
            </View>
          </View>

          <View style={[styles.code, { backgroundColor: selected ? 'transparent' : fills.containerHigh }]}>
            <Text
              variant="labelMedium"
              style={[emphasis.strong, tabular, { color: theme.colors.onSurfaceVariant }]}
            >
              {station.station_code}
            </Text>
          </View>
          {selected ? (
            <Ionicons name="checkmark" size={20} color={theme.colors.onSecondaryContainer} />
          ) : showChevron && onPress ? (
            <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceVariant} />
          ) : null}
        </View>
      </Touchable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.base,
  },
  gap: {
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: spacing.base,
    paddingRight: spacing.md,
    gap: spacing.md,
  },
  bar: {
    width: 5,
    alignSelf: 'stretch',
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
  },
  segment: {
    flex: 1,
    borderRadius: 3,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineNames: {
    flexShrink: 1,
  },
  code: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
});
