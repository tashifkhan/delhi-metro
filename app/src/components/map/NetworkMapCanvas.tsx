import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../../theme/ThemeContext';
import type { MapStation } from './networkData';
import { placeLabels, type Box } from './labels';
import type { RouteOverlay } from './routeOverlay';
import { useNetworkGeometry } from './NetworkGeometryContext';

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
  /** Projected position of the user, drawn as a dot when known. */
  userPoint?: { x: number; y: number } | null;
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
  /** Draw the faint map-space grid. */
  grid?: boolean;
  /** Screen boxes covered by floating controls, kept clear of station names. */
  labelObstacles?: Box[];
}

interface Viewport {
  cx: number;
  cy: number;
  /** Screen pixels per metre. */
  k: number;
}

const TAP_SLOP = 8;
const HIT_RADIUS = 24;
const DOUBLE_TAP_MS = 280;
/** Starting view spans about this many metres across. */
const START_SPAN = 14_000;
const MIN_SPAN_FACTOR = 1.15;
const MAX_SPAN = 1_200;

type Touch = { pageX: number; pageY: number };

function distance(a: Touch, b: Touch) {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * The metro network drawn from station coordinates.
 *
 * Pan and zoom move an SVG viewBox rather than scaling a bitmap, so lines stay
 * sharp at every zoom. One finger pans, two fingers pinch, a double tap zooms
 * in; on the web the wheel zooms too. Taps pick the nearest station within a
 * finger's width. With a station selected, its lines stay at full strength and
 * the rest of the network fades back.
 */
export const NetworkMapCanvas = forwardRef<NetworkMapHandle, Props>(function NetworkMapCanvas(
  {
    selectedCode,
    onSelect,
    userPoint,
    insetTop = 0,
    insetBottom = 0,
    route = null,
    fit = null,
    wheelZoom = 'always',
    grid: showGrid = true,
    labelObstacles,
  },
  ref,
) {
  const theme = useTheme();
  const { fills, isDark } = useAppTheme();
  // Official-map layouts can move stations after the first render, so the
  // geometry comes from context; callbacks created once read it through a ref.
  const geometry = useNetworkGeometry();
  const geoRef = useRef(geometry);
  geoRef.current = geometry;
  const { lines: MAP_LINES, stations: MAP_STATIONS, stationByCode: STATION_BY_CODE } = geometry;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<Viewport>({ cx: 0, cy: 0, k: 0 });
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const containerRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);
  const insetsRef = useRef({ top: insetTop, bottom: insetBottom });
  insetsRef.current = { top: insetTop, bottom: insetBottom };

  const limits = useCallback(() => {
    const { width, height } = sizeRef.current;
    const MAP_BOUNDS = geoRef.current.bounds;
    const spanX = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
    const spanY = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
    const minK = Math.min(width / spanX, height / spanY) / MIN_SPAN_FACTOR;
    const maxK = width / MAX_SPAN;
    return { minK, maxK };
  }, []);

  const commit = useCallback(
    (next: Viewport) => {
      const { minK, maxK } = limits();
      const k = Math.min(maxK, Math.max(minK, next.k));
      const MAP_BOUNDS = geoRef.current.bounds;
      // Keep some of the network on screen however far it is dragged.
      const cx = Math.min(MAP_BOUNDS.maxX, Math.max(MAP_BOUNDS.minX, next.cx));
      const cy = Math.min(MAP_BOUNDS.maxY, Math.max(MAP_BOUNDS.minY, next.cy));
      viewRef.current = { cx, cy, k };
      if (frame.current === null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          setView(viewRef.current);
        });
      }
    },
    [limits],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const fitRef = useRef(fit);
  fitRef.current = fit;

  const startView = useCallback((width: number): Viewport => {
    const bounds = fitRef.current;
    const height = sizeRef.current.height || width;
    if (bounds) {
      // Frame the bounds with room for markers and labels around them.
      const spanX = Math.max(bounds.maxX - bounds.minX, 1_500);
      const spanY = Math.max(bounds.maxY - bounds.minY, 1_500);
      const k = Math.min((width - 96) / spanX, (height - 72) / spanY);
      return { cx: (bounds.minX + bounds.maxX) / 2, cy: (bounds.minY + bounds.maxY) / 2, k: Math.max(k, 1e-4) };
    }
    return { cx: 0, cy: 0, k: width / START_SPAN };
  }, []);

  // Re-frame when the bounds change, e.g. after reversing a journey.
  const fitKey = fit ? `${fit.minX}|${fit.maxX}|${fit.minY}|${fit.maxY}` : '';
  useEffect(() => {
    if (!fitKey || sizeRef.current.width === 0) return;
    commit(startView(sizeRef.current.width));
  }, [fitKey, commit, startView]);

  // Screen point to map point, using the canvas size and current viewport.
  const toMap = useCallback((sx: number, sy: number, v: Viewport = viewRef.current) => {
    const { width, height } = sizeRef.current;
    return { x: v.cx + (sx - width / 2) / v.k, y: v.cy + (sy - height / 2) / v.k };
  }, []);

  const zoomAt = useCallback(
    (sx: number, sy: number, factor: number) => {
      const v = viewRef.current;
      const { minK, maxK } = limits();
      const k = Math.min(maxK, Math.max(minK, v.k * factor));
      const anchor = toMap(sx, sy, v);
      const { width, height } = sizeRef.current;
      commit({ cx: anchor.x - (sx - width / 2) / k, cy: anchor.y - (sy - height / 2) / k, k });
    },
    [commit, limits, toMap],
  );

  /** Centre a map point in the area left visible between the floating UI. */
  const centreOn = useCallback(
    (x: number, y: number, k: number) => {
      const { top, bottom } = insetsRef.current;
      commit({ cx: x, cy: y + (bottom - top) / 2 / k, k });
    },
    [commit],
  );

  useImperativeHandle(
    ref,
    () => ({
      focusStation: (code) => {
        const station = geoRef.current.stationByCode.get(code);
        if (!station) return;
        const k = Math.max(viewRef.current.k, sizeRef.current.width / 6_000);
        centreOn(station.x, station.y, k);
      },
      focusPoint: (x, y) => {
        const k = Math.max(viewRef.current.k, sizeRef.current.width / 8_000);
        centreOn(x, y, k);
      },
      reset: () => commit(startView(sizeRef.current.width)),
    }),
    [centreOn, commit, startView],
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    const first = sizeRef.current.width === 0;
    sizeRef.current = { width, height };
    setSize({ width, height });
    containerRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
    if (first) {
      const v = startView(width);
      const { minK, maxK } = limits();
      viewRef.current = { ...v, k: Math.min(maxK, Math.max(minK, v.k)) };
      setView(viewRef.current);
    }
  };

  const nearestStation = useCallback(
    (sx: number, sy: number): MapStation | null => {
      const v = viewRef.current;
      const p = toMap(sx, sy, v);
      let best: MapStation | null = null;
      let bestDist = HIT_RADIUS / v.k;
      for (const station of geoRef.current.stations) {
        const d = Math.hypot(station.x - p.x, station.y - p.y);
        if (d < bestDist) {
          best = station;
          bestDist = d;
        }
      }
      return best;
    },
    [toMap],
  );

  // Gesture state lives in refs; the responder is created once.
  const gesture = useRef({
    lastPan: null as { x: number; y: number } | null,
    lastPinch: null as { dist: number; mx: number; my: number } | null,
    moved: false,
    lastTap: 0,
  });
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const local = (t: Touch) => ({ x: t.pageX - origin.current.x, y: t.pageY - origin.current.y });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          // The canvas can move with the page (web scroll, rotation); refresh
          // its window position before reading touch points against it.
          containerRef.current?.measureInWindow((x, y) => {
            origin.current = { x, y };
          });
          const touches = evt.nativeEvent.touches as unknown as Touch[];
          const g = gesture.current;
          g.moved = touches.length > 1;
          g.lastPinch = null;
          g.lastPan = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        },
        onPanResponderMove: (evt, state) => {
          const g = gesture.current;
          const touches = evt.nativeEvent.touches as unknown as Touch[];
          if (Math.abs(state.dx) > TAP_SLOP || Math.abs(state.dy) > TAP_SLOP) g.moved = true;

          if (touches.length >= 2) {
            g.moved = true;
            g.lastPan = null;
            const a = local(touches[0]);
            const b = local(touches[1]);
            const dist = distance(touches[0], touches[1]);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            if (g.lastPinch && g.lastPinch.dist > 0) {
              const v = viewRef.current;
              // Pan by the midpoint's movement, then zoom about it.
              commit({
                ...v,
                cx: v.cx - (mx - g.lastPinch.mx) / v.k,
                cy: v.cy - (my - g.lastPinch.my) / v.k,
              });
              zoomAt(mx, my, dist / g.lastPinch.dist);
            }
            g.lastPinch = { dist, mx, my };
            return;
          }

          g.lastPinch = null;
          const px = evt.nativeEvent.pageX;
          const py = evt.nativeEvent.pageY;
          if (g.lastPan) {
            const v = viewRef.current;
            commit({
              ...v,
              cx: v.cx - (px - g.lastPan.x) / v.k,
              cy: v.cy - (py - g.lastPan.y) / v.k,
            });
          }
          g.lastPan = { x: px, y: py };
        },
        onPanResponderRelease: (evt) => {
          const g = gesture.current;
          g.lastPan = null;
          g.lastPinch = null;
          if (g.moved) {
            g.lastTap = 0;
            return;
          }
          const p = local({ pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY });
          const now = Date.now();
          if (now - g.lastTap < DOUBLE_TAP_MS) {
            g.lastTap = 0;
            zoomAt(p.x, p.y, 2);
            return;
          }
          g.lastTap = now;
          const station = nearestStation(p.x, p.y);
          onSelectRef.current(station ? station.code : null);
        },
        onPanResponderTerminate: () => {
          gesture.current.lastPan = null;
          gesture.current.lastPinch = null;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Wheel and trackpad zoom on the web. React Native has no wheel event, so
  // listen on the DOM node directly; passive must be off to stop page scroll.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      if (wheelZoom === 'modifier' && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = node.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0018));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [zoomAt, wheelZoom]);

  const selected = selectedCode ? STATION_BY_CODE.get(selectedCode) ?? null : null;

  // Keep the selected station in view once the sheet opens over the map:
  // if it would sit under the sheet or the search bar, pan it into the clear
  // band between them. The zoom stays where the user left it.
  useEffect(() => {
    if (!selectedCode || sizeRef.current.height === 0) return;
    const station = geoRef.current.stationByCode.get(selectedCode);
    if (!station) return;
    const v = viewRef.current;
    const sy = sizeRef.current.height / 2 + (station.y - v.cy) * v.k;
    const sx = sizeRef.current.width / 2 + (station.x - v.cx) * v.k;
    const margin = 48;
    const covered =
      sy > sizeRef.current.height - insetBottom - margin ||
      sy < insetTop + margin ||
      sx < margin ||
      sx > sizeRef.current.width - margin;
    if (covered) centreOn(station.x, station.y, v.k);
  }, [selectedCode, insetTop, insetBottom, centreOn]);
  const activeLines = useMemo(
    () => new Set(route ? [] : selected?.lines ?? []),
    [selected, route],
  );

  const { width, height } = size;
  const { cx, cy, k } = view;
  const ready = width > 0 && k > 0;
  const px = (n: number) => n / (k || 1);
  const viewBox = ready
    ? `${cx - width / 2 / k} ${cy - height / 2 / k} ${width / k} ${height / k}`
    : '0 0 1 1';

  // Markers shrink as the view widens but never disappear, so the network
  // always reads as stations on lines. Spans are metres across the screen.
  const span = ready ? width / k : START_SPAN;
  const markerScale = Math.min(1, Math.max(0.6, 14_000 / span));
  const lineScale = Math.min(1, Math.max(0.7, 16_000 / span));

  // A light grid in map space so panning reads as moving over a surface.
  const grid = useMemo(() => {
    if (!ready || !showGrid) return { step: 0, xs: [] as number[], ys: [] as number[] };
    const target = 48 / k;
    const step = Math.pow(2, Math.round(Math.log2(target / 250))) * 250;
    const x0 = Math.floor((cx - width / 2 / k) / step) * step;
    const y0 = Math.floor((cy - height / 2 / k) / step) * step;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = x0; x <= cx + width / 2 / k; x += step) xs.push(x);
    for (let y = y0; y <= cy + height / 2 / k; y += step) ys.push(y);
    return { step, xs, ys };
  }, [ready, showGrid, k, cx, cy, width, height]);

  const linePoints = useMemo(
    () => MAP_LINES.map((line) => line.points.map((p) => `${p.x},${p.y}`).join(' ')),
    [MAP_LINES],
  );

  const dim = (lineCodes: string[]) =>
    activeLines.size > 0 && !lineCodes.some((code) => activeLines.has(code));

  const background = fills.containerLow;
  const ink = theme.colors.onSurface;
  const halo = background;
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

  const orderedLines = MAP_LINES.map((line, index) => ({ line, index })).sort(
    (a, b) => Number(activeLines.has(a.line.code)) - Number(activeLines.has(b.line.code)),
  );

  return (
    <View
      ref={containerRef}
      style={[styles.fill, { backgroundColor: background }]}
      onLayout={handleLayout}
      {...responder.panHandlers}
      accessible
      accessibilityLabel="Metro network map. Drag to move, pinch to zoom, tap a station to see its details."
    >
      {ready ? (
        <Svg width={width} height={height} viewBox={viewBox} pointerEvents="none">
          <G>
            {grid.xs.map((x) => (
              <Line
                key={`gx${x}`}
                x1={x}
                x2={x}
                y1={cy - height / 2 / k}
                y2={cy + height / 2 / k}
                stroke={theme.colors.outlineVariant}
                strokeOpacity={isDark ? 0.18 : 0.35}
                strokeWidth={px(0.6)}
              />
            ))}
            {grid.ys.map((y) => (
              <Line
                key={`gy${y}`}
                y1={y}
                y2={y}
                x1={cx - width / 2 / k}
                x2={cx + width / 2 / k}
                stroke={theme.colors.outlineVariant}
                strokeOpacity={isDark ? 0.18 : 0.35}
                strokeWidth={px(0.6)}
              />
            ))}
          </G>

          {orderedLines.map(({ line, index }) => {
            const active = activeLines.has(line.code);
            const faded = route ? true : activeLines.size > 0 && !active;
            return (
              <G key={line.code}>
                {active ? (
                  <Polyline
                    points={linePoints[index]}
                    fill="none"
                    stroke={line.color}
                    strokeOpacity={0.22}
                    strokeWidth={px(16)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                <Polyline
                  points={linePoints[index]}
                  fill="none"
                  stroke={line.color}
                  strokeOpacity={faded ? (route ? 0.2 : 0.28) : 1}
                  strokeWidth={px((active ? 7 : 5) * lineScale)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            );
          })}

          {route
            ? route.segments.map((segment, i) => {
                const pts = segment.points.map((p) => `${p.x},${p.y}`).join(' ');
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
            const onRoute = routeCodes?.has(station.code) ?? false;
            const faded = route ? !onRoute : dim(station.lines);
            const big = station.interchange || onRoute;
            const color = station.interchange
              ? ink
              : (route && onRoute ? route.colorFor(station.code) : null) ??
                MAP_LINES.find((l) => l.code === station.lines[0])?.color ??
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
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
