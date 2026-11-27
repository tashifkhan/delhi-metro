import { useEffect, useMemo, type RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import type { MapMotion } from './mapViewport';

interface GestureCallbacks {
  move: (motion: MapMotion) => void;
  /** A finger went down, before any gesture is recognised. */
  touch?: () => void;
  start?: () => void;
  settle?: () => void;
  /** The last finger lifted after a drag, with its speed in px/s. */
  release?: (vx: number, vy: number) => void;
  tap?: (x: number, y: number) => void;
  doubleTap: (x: number, y: number) => void;
}

export function useMapGestures({ move, touch, start, settle, release, tap, doubleTap }: GestureCallbacks) {
  const panning = useSharedValue(false);
  const pinch = useSharedValue<{ x: number; y: number; scale: number } | null>(null);
  const multiTouch = useSharedValue(false);
  /** A second finger joined this drag, so lifting off shouldn't fling. */
  const pinched = useSharedValue(false);
  const lastTap = useSharedValue<{ at: number; x: number; y: number } | null>(null);
  const slop = 8;

  return useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(slop)
      .averageTouches(true)
      .onTouchesDown(({ numberOfTouches }) => {
        if (numberOfTouches > 1) pinched.value = true;
        else if (!panning.value && !pinch.value) pinched.value = false;
        touch?.();
      })
      .onStart(() => {
        panning.value = true;
        lastTap.value = null;
        start?.();
      })
      .onChange((event) => {
        if (pinch.value) return;
        move({ x: event.x, y: event.y, dx: event.changeX, dy: event.changeY, scale: 1 });
      })
      .onFinalize(({ velocityX, velocityY }) => {
        if (!panning.value) return;
        panning.value = false;
        if (pinch.value) return;
        if (pinched.value || !release) settle?.();
        else release(velocityX, velocityY);
      });

    const zoom = Gesture.Pinch()
      .onStart(({ focalX, focalY, scale }) => {
        pinch.value = { x: focalX, y: focalY, scale };
        pinched.value = true;
        lastTap.value = null;
        start?.();
      })
      .onUpdate(({ focalX: x, focalY: y, scale }) => {
        const previous = pinch.value;
        if (!previous || scale <= 0 || previous.scale <= 0) return;
        pinch.value = { x, y, scale };
        move({ x, y, dx: x - previous.x, dy: y - previous.y, scale: scale / previous.scale });
      })
      .onFinalize(() => {
        if (!pinch.value) return;
        pinch.value = null;
        if (!panning.value) settle?.();
      });

    const select = Gesture.Tap()
      .maxDistance(slop)
      .cancelsTouchesInView(false)
      .onTouchesDown(({ numberOfTouches }) => {
        multiTouch.value = numberOfTouches > 1;
        if (multiTouch.value) lastTap.value = null;
      })
      .onEnd(({ x, y }, success) => {
        if (!success || multiTouch.value) return;
        const at = Date.now();
        const previous = lastTap.value;
        if (previous && at - previous.at < 280 && Math.hypot(x - previous.x, y - previous.y) <= 24) {
          lastTap.value = null;
          doubleTap(x, y);
          return;
        }
        lastTap.value = { at, x, y };
        tap?.(x, y);
      });
    return Gesture.Race(Gesture.Simultaneous(pan, zoom), select);
  }, [move, touch, start, settle, release, tap, doubleTap, panning, pinch, pinched, lastTap, multiTouch]);
}

type WebPinchEvent = Event & { scale: number; clientX?: number; clientY?: number };

export function useWebMapZoom(
  ref: RefObject<View | null>,
  mode: 'always' | 'modifier',
  { move, start, settle }: Pick<GestureCallbacks, 'move' | 'start' | 'settle'>,
  enabled = true,
) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return;

    let frame: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let clientX: number | undefined;
    let clientY: number | undefined;
    let logScale = 0;
    let safariScale: number | null = null;
    let touches = 0;
    const update = (change: number, x?: number, y?: number) => {
      logScale += change;
      clientX = x;
      clientY = y;
      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          const rect = node.getBoundingClientRect();
          const scale = Math.exp(Math.max(-0.9, Math.min(0.9, logScale)));
          logScale = 0;
          move({
            x: clientX === undefined ? rect.width / 2 : clientX - rect.left,
            y: clientY === undefined ? rect.height / 2 : clientY - rect.top,
            dx: 0,
            dy: 0,
            scale,
          });
        });
      }
      if (timer === null) start?.();
      else clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        settle?.();
      }, 140);
    };
    const onWheel = (event: WheelEvent) => {
      if (mode === 'modifier' && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (safariScale !== null) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
      update(-event.deltaY * unit * 0.0018, event.clientX, event.clientY);
    };
    const trackTouches = (event: TouchEvent) => {
      touches = event.touches.length;
    };
    // Safari trackpads can emit GestureEvents instead of Ctrl+wheel. Cancel
    // page zoom for both trackpads and touch screens. RNGH handles touch motion.
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      safariScale = 1;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const { scale, clientX, clientY } = event as WebPinchEvent;
      if (!Number.isFinite(scale) || scale <= 0) return;
      if (touches < 2) update(Math.log(scale / (safariScale ?? 1)), clientX, clientY);
      safariScale = scale;
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      safariScale = null;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('gesturestart', onGestureStart, { passive: false });
    node.addEventListener('gesturechange', onGestureChange, { passive: false });
    node.addEventListener('gestureend', onGestureEnd, { passive: false });
    node.addEventListener('touchstart', trackTouches, { passive: true });
    node.addEventListener('touchend', trackTouches, { passive: true });
    node.addEventListener('touchcancel', trackTouches, { passive: true });
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('gesturestart', onGestureStart);
      node.removeEventListener('gesturechange', onGestureChange);
      node.removeEventListener('gestureend', onGestureEnd);
      node.removeEventListener('touchstart', trackTouches);
      node.removeEventListener('touchend', trackTouches);
      node.removeEventListener('touchcancel', trackTouches);
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
    };
  }, [ref, mode, move, start, settle, enabled]);
}
