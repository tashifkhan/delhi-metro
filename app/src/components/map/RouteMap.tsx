import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Touchable } from '../Touchable';
import { useAppTheme } from '../../theme/ThemeContext';
import { emphasis, radius, spacing } from '../../theme';
import type { PlannedLeg } from '../../types';
import { NetworkGeometryProvider } from './NetworkGeometryContext';
import { NetworkMapCanvas, type NetworkMapHandle } from './NetworkMapCanvas';
import { buildRouteOverlay } from './routeOverlay';
import { useLiveGeometry } from './useLiveGeometry';

interface Props {
  legs: PlannedLeg[];
  colorFor: (leg: PlannedLeg) => string;
  height?: number;
  onOpenMap?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * A journey drawn on the network map: every line faded, the ride legs in
 * their own colours along the real track, the walk between operators dotted,
 * a ring at the start, a diamond at the end and a ring at each change.
 *
 * Framed on the route, and still draggable and pinchable. On the web the
 * wheel zooms only with Ctrl or Cmd so the page keeps scrolling past it.
 */
export function RouteMap({ legs, colorFor, height = 280, onOpenMap, style }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const { geometry } = useLiveGeometry();
  const mapRef = useRef<NetworkMapHandle>(null);
  const [cardWidth, setCardWidth] = useState(0);
  // Keep names out from under the "Open in Map" chip in the bottom corner.
  const obstacles = useMemo(
    () =>
      onOpenMap && cardWidth > 0
        ? [{ x0: cardWidth - CHIP_WIDTH - spacing.md - 4, y0: height - CHIP_HEIGHT - spacing.md - 4, x1: cardWidth, y1: height }]
        : [],
    [onOpenMap, cardWidth, height],
  );

  const overlay = useMemo(
    () => buildRouteOverlay(legs, geometry, colorFor),
    // colorFor is rebuilt each render by the caller; legs and geometry decide the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [legs, geometry],
  );

  if (!overlay) return null;

  return (
    <NetworkGeometryProvider value={geometry}>
      <View
        style={[styles.card, { height, backgroundColor: fills.containerLow }, style]}
        onLayout={(e: LayoutChangeEvent) => setCardWidth(e.nativeEvent.layout.width)}
      >
        <NetworkMapCanvas
          ref={mapRef}
          selectedCode={null}
          onSelect={() => undefined}
          route={overlay}
          fit={overlay.bounds}
          wheelZoom="modifier"
          grid={false}
          labelObstacles={obstacles}
        />
        <View style={styles.actions} pointerEvents="box-none">
          {onOpenMap ? (
            <Touchable
              radius={radius.pill}
              onPress={onOpenMap}
              accessibilityLabel="Open this route on the network map"
              style={[styles.chip, { backgroundColor: fills.containerHigh }]}
            >
              <View style={styles.chipInner}>
                <Ionicons name="expand-outline" size={16} color={theme.colors.onSurface} />
                <Text variant="labelLarge" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                  Open in Map
                </Text>
              </View>
            </Touchable>
          ) : null}
        </View>
      </View>
    </NetworkGeometryProvider>
  );
}

const CHIP_WIDTH = 140;
const CHIP_HEIGHT = 36;

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
