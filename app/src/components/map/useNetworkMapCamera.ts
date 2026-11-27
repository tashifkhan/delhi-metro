import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import type { NetworkGeometry, Point } from './geometry';
import {
  constrainViewport,
  moveViewport,
  viewportTransform,
  type CameraLimits,
  type MapMotion,
  type MapSize,
  type Viewport,
} from './mapViewport';

export const START_SPAN = 14_000;
const EMPTY_VIEW = { cx: 0, cy: 0, k: 0 };
const IS_WEB = Platform.OS === 'web';

/**
 * Redrawing the SVG costs a lot: React re-renders hundreds of elements, the
 * UI thread records them, and the GPU repaints the drawing's layer. At
 * 120 Hz a frame has 8 ms. So nothing redraws while a finger is down or a
 * fling runs: the camera moves the last drawing with a GPU transform, the
 * backdrop fills whatever it uncovers, and the redraw waits until the map
 * has been still for this long.
 */
const SETTLE_DELAY = 120;
/** Slower releases than this, in px/s, stop dead instead of gliding. */
const MIN_FLING = 250;
const DECELERATION = 0.996;

type Bounds = NetworkGeometry['bounds'];
type Insets = { top: number; bottom: number };
type Focus = { point: Point; span: number };

/**
 * What React last drew. `anchor` is the view the animated layer is placed
 * against; the drawing sits inside it with a transform from `view` to
 * `anchor`, committed with the drawing itself.
 */
export interface MapFrame {
  view: Viewport;
  anchor: Viewport;
}

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

const sameView = (a: Viewport, b: Viewport) => {
  'worklet';
  return a.cx === b.cx && a.cy === b.cy && a.k === b.k;
};

/**
 * Camera for the network map.
 *
 * `live` is where the map is right now and changes every frame on the UI
 * thread. The SVG is drawn for one view at a time and an animated transform
 * makes up the difference, so pans and pinches never wait on React.
 *
 * On native, the animated layer is placed against a fixed `anchor` and the
 * drawing carries its own transform from its view to that anchor. Both parts
 * of that transform change in the same React commit, so a redraw never
 * shows a frame with new content under an old offset. The web applies React
 * and Reanimated updates in the same frame, so there the anchor simply
 * follows each drawing and the inner transform stays at identity.
 */
export function useNetworkMapCamera(size: MapSize, bounds: Bounds, fit: Bounds | null) {
  const [frame, setFrame] = useState<MapFrame>({ view: EMPTY_VIEW, anchor: EMPTY_VIEW });
  const live = useSharedValue<Viewport>(EMPTY_VIEW);
  const anchor = useSharedValue<Viewport>(EMPTY_VIEW);
  const requested = useSharedValue<Viewport>(EMPTY_VIEW);
  const cameraLimits = useSharedValue<CameraLimits | null>(null);
  /** A finger is down or a fling is running. */
  const busy = useSharedValue(false);
  const pendingFocus = useSharedValue<{ focus: Focus; insets: Insets } | null>(null);
  const fling = useSharedValue(0);
  const flingState = useSharedValue({ token: 0, active: false, last: 0, dx: 0, dy: 0 });
  const previousFit = useRef<string | undefined>(undefined);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const redraw = useCallback(() => {
    'worklet';
    const next = live.value;
    if (next.k <= 0 || sameView(next, requested.value)) return;
    requested.value = next;
    scheduleOnRN(setFrame, { view: next, anchor: IS_WEB ? next : anchor.value });
  }, [live, requested, anchor]);

  const redrawIfIdle = useCallback(() => {
    'worklet';
    if (!busy.value) redraw();
  }, [busy, redraw]);

  const redrawSoon = useCallback(() => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      scheduleOnUI(redrawIfIdle);
    }, SETTLE_DELAY);
  }, [redrawIfIdle]);
  useEffect(() => () => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
  }, []);

  /** The map came to rest: redraw once it stays still. */
  const settle = useCallback(() => {
    'worklet';
    busy.value = false;
    scheduleOnRN(redrawSoon);
  }, [busy, redrawSoon]);

  /** Stops a running fling. Returns whether there was one. */
  const stopFling = useCallback(() => {
    'worklet';
    const state = flingState.value;
    if (!state.active) return false;
    flingState.value = { ...state, token: state.token + 1, active: false };
    cancelAnimation(fling);
    return true;
  }, [flingState, fling]);

  /** A finger went down. Catching a fling holds the map where it is. */
  const touch = useCallback(() => {
    'worklet';
    if (stopFling()) settle();
  }, [stopFling, settle]);

  const start = useCallback(() => {
    'worklet';
    stopFling();
    busy.value = true;
  }, [stopFling, busy]);

  const move = useCallback((motion: MapMotion) => {
    'worklet';
    const limits = cameraLimits.value;
    if (!limits) return;
    live.value = moveViewport(live.value, limits, motion);
  }, [cameraLimits, live]);

  /** The last finger lifted. A quick drag keeps gliding and slows down. */
  const release = useCallback((vx: number, vy: number) => {
    'worklet';
    const speed = Math.hypot(vx, vy);
    if (!cameraLimits.value || !Number.isFinite(speed) || speed < MIN_FLING) {
      settle();
      return;
    }
    const token = flingState.value.token + 1;
    flingState.value = { token, active: true, last: 0, dx: vx / speed, dy: vy / speed };
    fling.value = 0;
    fling.value = withDecay({ velocity: speed, deceleration: DECELERATION }, (finished) => {
      if (!finished || flingState.value.token !== token) return;
      flingState.value = { ...flingState.value, active: false };
      settle();
    });
  }, [cameraLimits, flingState, fling, settle]);

  useAnimatedReaction(
    () => fling.value,
    (travelled) => {
      const state = flingState.value;
      const limits = cameraLimits.value;
      if (!state.active || !limits) return;
      const step = travelled - state.last;
      flingState.value = { ...state, last: travelled };
      if (step === 0) return;
      const before = live.value;
      move({ x: limits.width / 2, y: limits.height / 2, dx: state.dx * step, dy: state.dy * step, scale: 1 });
      // Pinned against the edge of the network: nothing left to glide.
      if (sameView(before, live.value) && stopFling()) settle();
    },
  );

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
    stopFling();
    const k = span > 0 ? Math.min(limits.maxK, Math.max(current.k, width / span)) : current.k;
    live.value = constrainViewport({ cx: point.x, cy: point.y + (insets.bottom - insets.top) / 2 / k, k }, limits);
    redraw();
  }, [cameraLimits, live, pendingFocus, stopFling, redraw]);

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
      // A new size moves the layer's centre, so start a new anchor too. The
      // drawing has to follow even if the view itself didn't change.
      anchor.value = live.value;
      requested.value = EMPTY_VIEW;
      const pending = pendingFocus.value;
      if (pending) {
        pendingFocus.value = null;
        focusOnUI(pending.focus, pending.insets);
      }
      redraw();
    });
  }, [size, bounds, fit, fitKey, cameraLimits, pendingFocus, live, anchor, requested, redraw, focusOnUI]);

  useLayoutEffect(() => {
    if (IS_WEB) anchor.value = frame.view;
  }, [frame, anchor]);

  const doubleTap = useCallback((x: number, y: number) => {
    'worklet';
    stopFling();
    move({ x, y, dx: 0, dy: 0, scale: 2 });
    if (!busy.value) redraw();
  }, [stopFling, move, busy, redraw]);

  const layerStyle = useAnimatedStyle(() => {
    const { x, y, scale } = viewportTransform(live.value, anchor.value);
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
      stopFling();
      live.value = constrainViewport(startingView(limits, fit), limits);
      redraw();
    });
  }, [cameraLimits, live, fit, stopFling, redraw]);

  return { frame, live, layerStyle, touch, start, move, release, settle, doubleTap, focus, reset };
}
