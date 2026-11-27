import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, G, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../../theme/ThemeContext';
import { useOfflinePack } from '../../offline/OfflinePackContext';
import type { MapStation } from './networkData';
import { placeLabels, type Box } from './labels';
import type { RouteOverlay } from './routeOverlay';
import { useNetworkGeometry } from './NetworkGeometryContext';
import { drawingBounds, OVERSCAN, type Viewport } from './mapViewport';
import { useMapGestures, useWebMapZoom } from './useMapGestures';
import { START_SPAN, useNetworkMapCamera } from './useNetworkMapCamera';
import {
  DETAIL_SPAN,
  detailChunksForView,
  loadTerrainDetail,
  overviewForView,
  type TerrainDetail,
} from './terrain';

export interface NetworkMapHandle {
  /** Centre on a station and zoom in far enough to read its neighbours. */
  focusStation: (code: string) => void;
  /** Centre on a projected point, e.g. the user's position. */
  focusPoint: (x: number, y: number) => void;
  /** Back to the starting view over central Delhi. */
  reset: () => void;
}

interface Props {
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
  /**
   * Projected position of the user, drawn as a dot when known. `accuracy`
   * (metres) draws the area the user could be anywhere in.
   */
  userPoint?: { x: number; y: number; accuracy?: number } | null;
  /** Space covered by floating UI at the top and bottom, kept clear when focusing. */
  insetTop?: number;
  insetBottom?: number;
  /** A journey to draw over the faded network. */
  route?: RouteOverlay | null;
  /** Start framed on these map bounds instead of central Delhi. */
  fit?: { minX: number; maxX: number; minY: number; maxY: number } | null;
  /**
   * On the web, `modifier` zooms with the wheel only while Ctrl or Cmd is held
   * (trackpad pinches send Ctrl), so a map inside a scrolling page doesn't
   * trap the scroll.
   */
  wheelZoom?: 'always' | 'modifier';
  /** Draw contour lines and the river behind the network. */
  terrain?: boolean;
  /** Screen boxes covered by floating controls, kept clear of station names. */
  labelObstacles?: Box[];
}

const HIT_RADIUS = 24;

export const NetworkMapCanvas = memo(forwardRef<NetworkMapHandle, Props>(function NetworkMapCanvas(
  {
    selectedCode,
    onSelect,
    userPoint,
    insetTop = 0,
    insetBottom = 0,
    route = null,
    fit = null,
    wheelZoom = 'always',
    terrain: showTerrain = true,
    labelObstacles,
  },
  ref,
) {
  const theme = useTheme();
  const { fills, isDark } = useAppTheme();
  const geometry = useNetworkGeometry();
  const { lines: MAP_LINES, stations: MAP_STATIONS, stationByCode: STATION_BY_CODE } = geometry;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<View>(null);
  const { width, height } = size;
  const { view, live, layerStyle, move, settle, doubleTap, focus, reset } =
    useNetworkMapCamera(size, geometry.bounds, fit);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectAt = useCallback((sx: number, sy: number, camera: Viewport) => {
    if (!camera.k) return;
    const x = camera.cx + (sx - width / 2) / camera.k;
    const y = camera.cy + (sy - height / 2) / camera.k;
    let best: MapStation | null = null;
    let bestDist = (HIT_RADIUS / camera.k) ** 2;
    for (const station of MAP_STATIONS) {
      const distance = (station.x - x) ** 2 + (station.y - y) ** 2;
      if (distance >= bestDist) continue;
      best = station;
      bestDist = distance;
    }
    onSelectRef.current(best?.code ?? null);
  }, [MAP_STATIONS, width, height]);
  const tap = useCallback((x: number, y: number) => {
    'worklet';
    scheduleOnRN(selectAt, x, y, live.value);
  }, [selectAt, live]);
  const gestures = useMapGestures({ move, settle, tap, doubleTap });
  useWebMapZoom(containerRef, wheelZoom, { move, settle });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setSize((size) => size.width === width && size.height === height ? size : { width, height });
  }, []);

  useImperativeHandle(ref, () => ({
    focusStation: (code) => {
      const station = STATION_BY_CODE.get(code);
      if (station) focus(station, { top: insetTop, bottom: insetBottom }, 6_000);
    },
    focusPoint: (x, y) => focus({ x, y }, { top: insetTop, bottom: insetBottom }, 8_000),
    reset,
  }), [STATION_BY_CODE, insetTop, insetBottom, focus, reset]);

  const selected = selectedCode ? STATION_BY_CODE.get(selectedCode) ?? null : null;
  // Move the selected station clear of the sheet or search bar when either covers it.
  useEffect(() => {
    if (selected && height > 0) focus(selected, { top: insetTop, bottom: insetBottom }, 0, true);
  }, [selected, height, insetTop, insetBottom, focus]);

  const activeLines = useMemo(
    () => new Set(route ? [] : selected?.lines ?? []),
    [selected, route],
  );

  const { cx, cy, k } = view;
  const ready = width > 0 && k > 0;
  const px = (n: number) => n / (k || 1);
  // The drawing reaches OVERSCAN screens past every edge.
  const drawW = width * (1 + 2 * OVERSCAN);
  const drawH = height * (1 + 2 * OVERSCAN);
  const bounds = useMemo(() => drawingBounds(view, size), [view, size]);
  const viewBox = ready ? `${bounds.x0} ${bounds.y0} ${drawW / k} ${drawH / k}` : '0 0 1 1';

  // Markers shrink as the view widens but never disappear, so the network
  // always reads as stations on lines. Spans are metres across the screen.
  const span = ready ? width / k : START_SPAN;
  const markerScale = Math.min(1, Math.max(0.6, 14_000 / span));
  const lineScale = Math.min(1, Math.max(0.7, 16_000 / span));

  // Zoomed in, the detailed relief replaces the overview. It loads on first
  // use; the overview stays up until it arrives.
  const { meta } = useOfflinePack();
  const packVersion = meta?.version;
  const [terrainPack, setTerrainPack] = useState<{ version: string; detail: TerrainDetail | null } | null>(null);
  const packLoaded = terrainPack?.version === packVersion;
  const detail = packLoaded ? terrainPack?.detail : null;
  const wantDetail = showTerrain && ready && span < DETAIL_SPAN;
  useEffect(() => {
    if (!wantDetail || !packVersion || packLoaded) return;
    let live = true;
    loadTerrainDetail()
      .then((detail) => {
        if (live) setTerrainPack({ version: packVersion, detail });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wantDetail, packVersion, packLoaded]);
  const chunks = useMemo(() => {
    if (!wantDetail || !detail) return null;
    const visible = drawingBounds(view, size, 0);
    return detailChunksForView(
      detail,
      [visible.x0, visible.y0, visible.x1, visible.y1],
      [bounds.x0, bounds.y0, bounds.x1, bounds.y1],
    );
  }, [wantDetail, detail, view, size, bounds]);
  const ground = useMemo(
    () => showTerrain && ready ? overviewForView(bounds, 4 / k, chunks !== null) : null,
    [showTerrain, ready, bounds, k, chunks],
  );

  const lines = useMemo(() => MAP_LINES.map((line) => {
    const xs = line.points.map((p) => p.x);
    const ys = line.points.map((p) => p.y);
    return {
      line,
      path: line.points.map((p) => `${p.x},${p.y}`).join(' '),
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    };
  }), [MAP_LINES]);
  const LINE_COLOR = useMemo(() => new Map(MAP_LINES.map((l) => [l.code, l.color])), [MAP_LINES]);
  const routePoints = useMemo(
    () => route?.segments.map((segment) => segment.points.map((p) => `${p.x},${p.y}`).join(' ')) ?? [],
    [route],
  );

  const dim = (lineCodes: string[]) =>
    activeLines.size > 0 && !lineCodes.some((code) => activeLines.has(code));

  const background = fills.containerLow;
  const ink = theme.colors.onSurface;
  const halo = background;
  const relief = theme.colors.outline;
  const water = isDark ? '#5b9bd5' : '#4a90c8';
  const labelFont = Platform.OS === 'web' ? '"Roboto Flex", Roboto, system-ui, sans-serif' : undefined;

  const routeCodes = route?.stationCodes;
  const labels = useMemo(() => {
    if (!ready) return [];
    const toScreen = (x: number, y: number) => ({
      x: width / 2 + (x - cx) * k,
      y: height / 2 + (y - cy) * k,
    });
    const muted = new Set<string>();
    for (const station of MAP_STATIONS) {
      const faded = routeCodes
        ? !routeCodes.has(station.code)
        : activeLines.size > 0 && !station.lines.some((c) => activeLines.has(c));
      if (faded) muted.add(station.code);
    }
    return placeLabels({
      stations: MAP_STATIONS,
      lines: MAP_LINES,
      toScreen,
      width,
      height,
      span,
      forced: [...(route?.keyCodes ?? []), ...(selectedCode ? [selectedCode] : [])],
      preferred: routeCodes ?? (activeLines.size > 0 ? new Set(MAP_STATIONS.filter((s) => !muted.has(s.code)).map((s) => s.code)) : undefined),
      muted,
      obstacles: labelObstacles,
    });
  }, [labelObstacles, ready, width, height, cx, cy, k, span, MAP_STATIONS, MAP_LINES, route, routeCodes, selectedCode, activeLines]);

  const orderedLines = useMemo(
    () => [...lines].sort((a, b) => Number(activeLines.has(a.line.code)) - Number(activeLines.has(b.line.code))),
    [lines, activeLines],
  );
  const markerPadding = px(10);
  const left = bounds.x0 - markerPadding;
  const top = bounds.y0 - markerPadding;
  const right = bounds.x1 + markerPadding;
  const bottom = bounds.y1 + markerPadding;

  return (
    <GestureDetector gesture={gestures} touchAction="none">
      <View
        ref={containerRef}
        style={[styles.fill, { backgroundColor: background }]}
        onLayout={handleLayout}
        accessible
        accessibilityLabel="Metro network map. Drag to move, pinch to zoom, tap a station to see its details."
      >
        {ready ? (
          <Animated.View style={[styles.layer, layerStyle]} pointerEvents="none">
            <Svg
              width={drawW}
              height={drawH}
              viewBox={viewBox}
              style={{ position: 'absolute', left: -width * OVERSCAN, top: -height * OVERSCAN }}
            >
              {ground ? (
                <G>
                  {ground.high.map((band, i) => (
                    band ? <Path key={`high${i}`} d={band} fill={relief} fillOpacity={isDark ? 0.05 : 0.06} /> : null
                  ))}
                  {chunks ? (
                    chunks.map((chunk) => (
                      <G key={`chunk${chunk.x},${chunk.y}`}>
                        <Path
                          d={chunk.minor}
                          fill="none"
                          stroke={relief}
                          strokeOpacity={isDark ? 0.14 : 0.2}
                          strokeWidth={px(0.7)}
                          strokeLinejoin="round"
                        />
                        <Path
                          d={chunk.major}
                          fill="none"
                          stroke={relief}
                          strokeOpacity={isDark ? 0.24 : 0.32}
                          strokeWidth={px(1.2)}
                          strokeLinejoin="round"
                        />
                        <Path d={chunk.water} fill={water} fillOpacity={isDark ? 0.26 : 0.32} />
                        <Path
                          d={chunk.rivers}
                          fill="none"
                          stroke={water}
                          strokeOpacity={isDark ? 0.4 : 0.5}
                          strokeWidth={px(1.6)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <Path
                          d={chunk.streams}
                          fill="none"
                          stroke={water}
                          strokeOpacity={isDark ? 0.3 : 0.4}
                          strokeWidth={px(1)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </G>
                    ))
                  ) : (
                    <G>
                      <Path
                        d={ground.minor}
                        fill="none"
                        stroke={relief}
                        strokeOpacity={isDark ? 0.14 : 0.2}
                        strokeWidth={px(0.7)}
                        strokeLinejoin="round"
                      />
                      <Path
                        d={ground.major}
                        fill="none"
                        stroke={relief}
                        strokeOpacity={isDark ? 0.24 : 0.32}
                        strokeWidth={px(1.2)}
                        strokeLinejoin="round"
                      />
                      <Path d={ground.water} fill={water} fillOpacity={isDark ? 0.26 : 0.32} />
                      <Path
                        d={ground.rivers}
                        fill="none"
                        stroke={water}
                        strokeOpacity={isDark ? 0.3 : 0.4}
                        strokeWidth={px(1.4)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </G>
                  )}
                </G>
              ) : null}

              {orderedLines.map(({ line, path, x0, x1, y0, y1 }) => {
                if (x0 > right || x1 < left || y0 > bottom || y1 < top) return null;
                const active = activeLines.has(line.code);
                const faded = route ? true : activeLines.size > 0 && !active;
                // Meerut Metro shares the Namo Bharat track. A narrower blue
                // stroke keeps the orange edges visible along the shared section.
                const baseWidth = line.code === 'RRTS' ? 9 : line.code === 'MRTS' ? 4 : 5;
                return (
                  <G key={line.code}>
                    {active ? (
                      <Polyline
                        points={path}
                        fill="none"
                        stroke={line.color}
                        strokeOpacity={0.22}
                        strokeWidth={px(16)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                    <Polyline
                      points={path}
                      fill="none"
                      stroke={line.color}
                      strokeOpacity={faded ? (route ? 0.2 : 0.28) : 1}
                      strokeWidth={px((baseWidth + (active ? 2 : 0)) * lineScale)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </G>
                );
              })}

              {route
                ? route.segments.map((segment, i) => {
                    const pts = routePoints[i];
                    return segment.dashed ? (
                      <Polyline
                        key={`rs${i}`}
                        points={pts}
                        fill="none"
                        stroke={ink}
                        strokeOpacity={0.75}
                        strokeWidth={px(3)}
                        strokeDasharray={`${px(2)} ${px(6)}`}
                        strokeLinecap="round"
                      />
                    ) : (
                      <G key={`rs${i}`}>
                        <Polyline
                          points={pts}
                          fill="none"
                          stroke={segment.color}
                          strokeOpacity={0.25}
                          strokeWidth={px(16)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <Polyline
                          points={pts}
                          fill="none"
                          stroke={segment.color}
                          strokeWidth={px(7)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </G>
                    );
                  })
                : null}

              {MAP_STATIONS.map((station) => {
                if (station.x < left || station.x > right || station.y < top || station.y > bottom) return null;
                const onRoute = routeCodes?.has(station.code) ?? false;
                const faded = route ? !onRoute : dim(station.lines);
                const big = station.interchange || onRoute;
                const color = station.interchange
                  ? ink
                  : (route && onRoute ? route.colorFor(station.code) : null) ??
                    LINE_COLOR.get(station.lines[0]) ??
                    ink;
                const r = (big ? 5.5 : 3.5) * markerScale;
                return (
                  <Circle
                    key={station.code}
                    cx={station.x}
                    cy={station.y}
                    r={px(Math.max(r, big ? 3.5 : 2.2))}
                    fill={fills.containerLowest}
                    fillOpacity={faded ? 0.6 : 1}
                    stroke={color}
                    strokeOpacity={faded ? 0.3 : 1}
                    strokeWidth={px(Math.max((big ? 2.5 : 2) * markerScale, 1.4))}
                  />
                );
              })}

              {route?.changes.map((p, i) => (
                <Circle
                  key={`chg${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={px(8)}
                  fill={fills.containerLowest}
                  stroke={ink}
                  strokeWidth={px(3)}
                />
              ))}
              {route?.start ? (
                <Circle
                  cx={route.start.x}
                  cy={route.start.y}
                  r={px(9)}
                  fill={fills.containerLowest}
                  stroke={theme.colors.primary}
                  strokeWidth={px(4)}
                />
              ) : null}
              {route?.end ? (
                <Rect
                  x={route.end.x - px(8)}
                  y={route.end.y - px(8)}
                  width={px(16)}
                  height={px(16)}
                  rx={px(3)}
                  fill={theme.colors.primary}
                  stroke={fills.containerLowest}
                  strokeWidth={px(2.5)}
                  transform={`rotate(45 ${route.end.x} ${route.end.y})`}
                />
              ) : null}

              {labels.map((label) => {
                const x = cx + (label.x - width / 2) / k;
                const y = cy + (label.y - height / 2) / k;
                const faded = label.priority > 1 && (route ? !routeCodes?.has(label.code) : activeLines.size > 0 && dim(STATION_BY_CODE.get(label.code)?.lines ?? []));
                const common = {
                  x,
                  y,
                  fontSize: px(label.size),
                  fontWeight: label.weight,
                  fontFamily: labelFont,
                  textAnchor: label.anchor,
                } as const;
                // react-native-svg has no paint-order, so the halo that keeps
                // labels readable over lines is a stroked copy drawn first.
                return (
                  <G key={`t${label.code}`}>
                    <SvgText
                      {...common}
                      fill={halo}
                      stroke={halo}
                      strokeWidth={px(4)}
                      strokeLinejoin="round"
                      opacity={faded ? 0.6 : 0.95}
                    >
                      {label.text}
                    </SvgText>
                    <SvgText {...common} fill={ink} fillOpacity={faded ? 0.5 : 0.95}>
                      {label.text}
                    </SvgText>
                  </G>
                );
              })}

              {userPoint ? (
                <G>
                  {userPoint.accuracy && userPoint.accuracy > px(16) ? (
                    <Circle
                      cx={userPoint.x}
                      cy={userPoint.y}
                      r={userPoint.accuracy}
                      fill="#1a73e8"
                      fillOpacity={0.08}
                      stroke="#1a73e8"
                      strokeOpacity={0.4}
                      strokeWidth={px(1)}
                    />
                  ) : null}
                  <Circle cx={userPoint.x} cy={userPoint.y} r={px(16)} fill="#1a73e8" fillOpacity={0.18} />
                  <Circle
                    cx={userPoint.x}
                    cy={userPoint.y}
                    r={px(6)}
                    fill="#1a73e8"
                    stroke="#ffffff"
                    strokeWidth={px(2)}
                  />
                </G>
              ) : null}

              {selected ? (
                <G>
                  <Circle cx={selected.x} cy={selected.y} r={px(24)} fill={theme.colors.primary} fillOpacity={0.16} />
                  <Rect
                    x={selected.x - px(15)}
                    y={selected.y - px(15)}
                    width={px(30)}
                    height={px(30)}
                    rx={px(10)}
                    fill={theme.colors.primary}
                  />
                  <Circle cx={selected.x} cy={selected.y} r={px(5)} fill={theme.colors.onPrimary} />
                </G>
              ) : null}
            </Svg>
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}));

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
    ...(Platform.OS === 'web' ? { willChange: 'transform' } : {}),
  },
});
