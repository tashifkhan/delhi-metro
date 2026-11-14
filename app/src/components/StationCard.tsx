import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { OperatorMark } from './OperatorMark';
import { Touchable } from './Touchable';
import { shortLineName } from './StationLineChip';
import { useAppTheme } from '../theme/ThemeContext';
import { NETWORK_NAMES } from '../network';
import { spacing, shape, emphasis, tabular, onColor } from '../theme';
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
const INNER = shape.sm;

/**
 * One station in a segmented list: tiles with 3pt gaps where only the outer
 * corners of the group are fully rounded, so a result list reads as a block.
 *
 * The leading tile is the station's line colour. A station on several lines
 * splits the tile into stripes, one per line, so an interchange is visible
 * before reading the badges.
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
  const colors = Array.from(new Set(lines.map((l) => l.primary_color_code).filter(Boolean))).slice(0, 3);
  const isInterchange = Boolean(station.interchange) || colors.length > 1;
  const name = stationName(station.station_name);
  const glyphColor = colors.length === 1 ? onColor(colors[0]) : theme.colors.onPrimary;

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
          <View style={[styles.mark, { backgroundColor: colors.length === 0 ? theme.colors.primary : undefined }]}>
            {colors.length > 0 ? (
              <View style={styles.stripes}>
                {colors.map((color) => (
                  <View key={color} style={[styles.stripe, { backgroundColor: color }]} />
                ))}
              </View>
            ) : null}
            <Ionicons
              name={isInterchange ? 'swap-horizontal' : 'train'}
              size={18}
              color={colors.length === 0 ? theme.colors.onPrimary : glyphColor}
            />
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
              {lines.map((line) => (
                <View key={`${station.station_code}-${line.line_code}`} style={styles.lineTag}>
                  <View style={[styles.dot, { backgroundColor: line.primary_color_code }]} />
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {shortLineName(line.line_color || line.line_name)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Text
            variant="labelMedium"
            style={[emphasis.strong, tabular, { color: theme.colors.onSurfaceVariant }]}
          >
            {station.station_code}
          </Text>
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
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.base,
    gap: spacing.md,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripes: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  stripe: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: 2,
  },
  lineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
