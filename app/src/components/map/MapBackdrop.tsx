import { memo, useMemo } from 'react';
import { PixelRatio, Platform, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import type { MapLine, MapStation } from './networkData';
import type { NetworkGeometry } from './geometry';
import { viewportTransform, type MapSize, type Viewport } from './mapViewport';

/** Longest edge of the backdrop texture, in device pixels. */
const EDGE_PX = 2_048;

interface Props {
  live: SharedValue<Viewport>;
  size: MapSize;
  bounds: NetworkGeometry['bounds'];
  lines: MapLine[];
  stations: MapStation[];
  stationFill: string;
  /** Rivers and lakes from the terrain overview, drawn under the lines. */
  water?: { rivers: string; water: string; color: string } | null;
}

/**
 * The whole network, drawn once at low resolution behind the sharp drawing.
 *
 * The sharp drawing only covers a little more than the screen and never
 * redraws while a finger is down, so a long drag or a pinch out uncovers
 * its edges. This layer shows the lines there instead of empty space. It
 * follows the camera with a GPU transform and its props never change during
 * a gesture, so it costs nothing per frame. The sharp drawing has an opaque
 * background and hides it everywhere else.
 */
export const MapBackdrop = memo(function MapBackdrop({
  live,
  size,
  bounds,
  lines,
  stations,
  stationFill,
  water,
}: Props) {
  const box = useMemo(() => {
    // Pad so strokes on the outermost lines aren't cut off.
    const pad = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.04;
    const minX = bounds.minX - pad;
    const minY = bounds.minY - pad;
    const spanX = bounds.maxX - bounds.minX + 2 * pad;
    const spanY = bounds.maxY - bounds.minY + 2 * pad;
    const edge = EDGE_PX / PixelRatio.get();
    const k = edge / Math.max(spanX, spanY);
    return {
      minX,
      minY,
      spanX,
      spanY,
      width: spanX * k,
      height: spanY * k,
      drawing: { cx: minX + spanX / 2, cy: minY + spanY / 2, k } satisfies Viewport,
    };
  }, [bounds]);

  const paths = useMemo(
    () => lines.map((line) => ({
      code: line.code,
      color: line.color,
      points: line.points.map((p) => `${p.x},${p.y}`).join(' '),
    })),
    [lines],
  );

  const style = useAnimatedStyle(() => {
    const view = live.value;
    if (view.k <= 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    const { x, y, scale } = viewportTransform(view, box.drawing);
    return { opacity: 1, transform: [{ translateX: x }, { translateY: y }, { scale }] };
  });

  const lineColor = useMemo(() => new Map(lines.map((line) => [line.code, line.color])), [lines]);
  const px = (n: number) => n / box.drawing.k;
  return (
    <Animated.View
      pointerEvents="none"
      // Painted once into a GPU texture; gestures only move it.
      renderToHardwareTextureAndroid
      style={[
        styles.layer,
        {
          left: size.width / 2 - box.width / 2,
          top: size.height / 2 - box.height / 2,
          width: box.width,
          height: box.height,
        },
        style,
      ]}
    >
      <Svg width={box.width} height={box.height} viewBox={`${box.minX} ${box.minY} ${box.spanX} ${box.spanY}`}>
        {water ? (
          <>
            <Path d={water.water} fill={water.color} fillOpacity={0.28} />
            <Path
              d={water.rivers}
              fill="none"
              stroke={water.color}
              strokeOpacity={0.35}
              strokeWidth={px(1)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {paths.map((line) => (
          <Polyline
            key={line.code}
            points={line.points}
            fill="none"
            stroke={line.color}
            strokeWidth={px(line.code === 'RRTS' ? 3 : 2)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {stations.map((station) => (
          <Circle
            key={station.code}
            cx={station.x}
            cy={station.y}
            r={px(station.interchange ? 2 : 1.4)}
            fill={stationFill}
            stroke={lineColor.get(station.lines[0]) ?? stationFill}
            strokeWidth={px(1)}
          />
        ))}
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    // Without this the browser re-rasterises the vectors at every scale.
    ...(Platform.OS === 'web' ? { willChange: 'transform' } : {}),
  },
});
