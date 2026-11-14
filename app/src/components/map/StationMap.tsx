import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from '../Touchable';
import { useAppTheme } from '../../theme/ThemeContext';
import { emphasis, radius, spacing } from '../../theme';
import { NetworkGeometryProvider } from './NetworkGeometryContext';
import { NetworkMapCanvas } from './NetworkMapCanvas';
import { useLiveGeometry } from './useLiveGeometry';

interface Props {
  code: string;
  height?: number;
  /** Opens the full network map on this station. */
  onOpenMap?: () => void;
  /** A tap on a neighbouring station. */
  onSelectStation?: (code: string, name: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** Half the width and height of the area shown around the station, in metres. */
const SPAN_X = 1600;
const SPAN_Y = 1100;
const CHIP_WIDTH = 140;
const CHIP_HEIGHT = 36;

/**
 * The station on the network map, the way the map tab shows a selected
 * station: its own lines in full colour, the rest faded, neighbours named.
 * Renders nothing when the station isn't on the map.
 */
export function StationMap({ code, height = 240, onOpenMap, onSelectStation, style }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const { geometry } = useLiveGeometry();
  const [cardWidth, setCardWidth] = useState(0);

  const station = geometry.stationByCode.get(code.trim().toUpperCase());
  const fit = useMemo(
    () =>
      station
        ? {
            minX: station.x - SPAN_X,
            maxX: station.x + SPAN_X,
            minY: station.y - SPAN_Y,
            maxY: station.y + SPAN_Y,
          }
        : null,
    [station],
  );
  const obstacles = useMemo(
    () =>
      onOpenMap && cardWidth > 0
        ? [{ x0: cardWidth - CHIP_WIDTH - spacing.md - 4, y0: height - CHIP_HEIGHT - spacing.md - 4, x1: cardWidth, y1: height }]
        : [],
    [onOpenMap, cardWidth, height],
  );

  if (!station || !fit) return null;

  return (
    <NetworkGeometryProvider value={geometry}>
      <View
        style={[styles.card, { height, backgroundColor: fills.containerLow }, style]}
        onLayout={(e: LayoutChangeEvent) => setCardWidth(e.nativeEvent.layout.width)}
        accessibilityLabel={`${station.name} on the network map`}
      >
        <NetworkMapCanvas
          selectedCode={station.code}
          onSelect={(picked) => {
            if (!picked || picked === station.code || !onSelectStation) return;
            const other = geometry.stationByCode.get(picked);
            if (other) onSelectStation(other.code, other.name);
          }}
          fit={fit}
          wheelZoom="modifier"
          grid={false}
          labelObstacles={obstacles}
        />
        {onOpenMap ? (
          <View style={styles.actions} pointerEvents="box-none">
            <Touchable
              radius={radius.pill}
              onPress={onOpenMap}
              accessibilityLabel="Open this station on the network map"
              style={[styles.chip, { backgroundColor: fills.containerHigh }]}
            >
              <View style={styles.chipInner}>
                <Ionicons name="expand-outline" size={16} color={theme.colors.onSurface} />
                <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                  Open in Map
                </Text>
              </View>
            </Touchable>
          </View>
        ) : null}
      </View>
    </NetworkGeometryProvider>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  actions: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
  },
  chip: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: CHIP_HEIGHT,
    paddingLeft: spacing.md,
    paddingRight: spacing.base,
  },
});
