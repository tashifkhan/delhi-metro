import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import type { NetworkGeometry, Point } from './geometry';
import {
  constrainViewport,
  moveViewport,
  needsRedraw,
  viewportTransform,
  type CameraLimits,
  type MapMotion,
  type MapSize,
  type Viewport,
} from './mapViewport';

export const START_SPAN = 14_000;
const REDRAW_INTERVAL = 120;
const EMPTY_VIEW = { cx: 0, cy: 0, k: 0 };

type Bounds = NetworkGeometry['bounds'];
type Insets = { top: number; bottom: number };
type Focus = { point: Point; span: number };

function startingView(limits: CameraLimits, fit: Bounds | null): Viewport {
  'worklet';
  const { width, height } = limits;
  if (!fit) return { cx: 0, cy: 0, k: width / START_SPAN };
  const spanX = Math.max(fit.maxX - fit.minX, 1_500);
  const spanY = Math.max(fit.maxY - fit.minY, 1_500);
  return {
    cx: (fit.minX + fit.maxX) / 2,
    cy: (fit.minY + fit.maxY) / 2,
    k: Math.min((width - 96) / spanX, (height - 72) / spanY),
  };
}

export function useNetworkMapCamera(size: MapSize, bounds: Bounds, fit: Bounds | null) {
  const [view, setView] = useState<Viewport>(EMPTY_VIEW);
  const live = useSharedValue<Viewport>(EMPTY_VIEW);
  const drawn = useSharedValue<Viewport>(EMPTY_VIEW);
  const requested = useSharedValue<Viewport>(EMPTY_VIEW);
  const cameraLimits = useSharedValue<CameraLimits | null>(null);
  const lastRedraw = useSharedValue(0);
  const pendingFocus = useSharedValue<{ focus: Focus; insets: Insets } | null>(null);
  const previousFit = useRef<string | undefined>(undefined);

  const redraw = useCallback(() => {
    'worklet';
    const next = live.value;
    const previous = requested.value;
    if (next.k <= 0 || (previous.cx === next.cx && previous.cy === next.cy && previous.k === next.k)) return;
    requested.value = next;
    lastRedraw.value = Date.now();
    scheduleOnRN(setView, next);
  }, [live, requested, lastRedraw]);

  const focusOnUI = useCallback((focus: Focus, insets: Insets, onlyIfCovered = false) => {
    'worklet';
    const limits = cameraLimits.value;
    if (!limits) {
      if (!onlyIfCovered) pendingFocus.value = { focus, insets };
      return;
    }
    const { point, span } = focus;
    const { width, height } = limits;
    const current = live.value;
    if (onlyIfCovered) {
      const sx = width / 2 + (point.x - current.cx) * current.k;
      const sy = height / 2 + (point.y - current.cy) * current.k;
      const margin = 48;
      if (sx >= margin && sx <= width - margin && sy >= insets.top + margin && sy <= height - insets.bottom - margin) {
        return;
      }
    }
    const k = span > 0 ? Math.min(limits.maxK, Math.max(current.k, width / span)) : current.k;
    live.value = constrainViewport({ cx: point.x, cy: point.y + (insets.bottom - insets.top) / 2 / k, k }, limits);
    redraw();
  }, [cameraLimits, live, pendingFocus, redraw]);

  const fitKey = fit ? `${fit.minX}|${fit.maxX}|${fit.minY}|${fit.maxY}` : '';
  useLayoutEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    const reframe = previousFit.current !== fitKey && Boolean(fit);
    previousFit.current = fitKey;
    const limits = {
      ...size,
      ...bounds,
      minK: Math.min(size.width / (bounds.maxX - bounds.minX), size.height / (bounds.maxY - bounds.minY)) / 1.15,
      maxK: size.width / 1_200,
    };
    scheduleOnUI(() => {
      'worklet';
      const previous = cameraLimits.value;
      cameraLimits.value = limits;
      const next = !previous || reframe
        ? startingView(limits, fit)
        : { ...live.value, k: live.value.k * limits.width / previous.width };
      live.value = constrainViewport(next, limits);
      const pending = pendingFocus.value;
      if (pending) {
        pendingFocus.value = null;
        focusOnUI(pending.focus, pending.insets);
      }
      redraw();
    });
  }, [size, bounds, fit, fitKey, cameraLimits, pendingFocus, live, redraw, focusOnUI]);

  useLayoutEffect(() => {
    drawn.value = view;
  }, [view, drawn]);

  const move = useCallback((motion: MapMotion) => {
    'worklet';
    const limits = cameraLimits.value;
    if (!limits) return;
    const next = moveViewport(live.value, limits, motion);
    live.value = next;
    if (Date.now() - lastRedraw.value >= REDRAW_INTERVAL && needsRedraw(next, drawn.value, limits)) redraw();
  }, [cameraLimits, live, drawn, lastRedraw, redraw]);

  const doubleTap = useCallback((x: number, y: number) => {
    'worklet';
    move({ x, y, dx: 0, dy: 0, scale: 2 });
    redraw();
  }, [move, redraw]);

  const layerStyle = useAnimatedStyle(() => {
    const { x, y, scale } = viewportTransform(live.value, drawn.value);
    return { transform: [{ translateX: x }, { translateY: y }, { scale }] };
  });

  const focus = useCallback((point: Point, insets: Insets, span: number, onlyIfCovered = false) => {
    scheduleOnUI(focusOnUI, { point: { x: point.x, y: point.y }, span }, insets, onlyIfCovered);
  }, [focusOnUI]);

  const reset = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      const limits = cameraLimits.value;
      if (!limits) return;
      live.value = constrainViewport(startingView(limits, fit), limits);
      redraw();
    });
  }, [cameraLimits, live, fit, redraw]);

  return { view, live, layerStyle, move, settle: redraw, doubleTap, focus, reset };
}
