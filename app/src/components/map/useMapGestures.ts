import { useEffect, useMemo, type RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { pinchStep, type MapMotion, type PinchState } from './mapViewport';

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

/**
 * Pan, pinch and tap for a map.
 *
 * `view` is the element the gesture detector wraps. On the web,
 * react-native-gesture-handler reports a pinch's focal point in window
 * coordinates, while native platforms report it in the view's own, so the
 * web needs the view's position to zoom around the right point.
 */
export function useMapGestures(
  { move, touch, start, settle, release, tap, doubleTap }: GestureCallbacks,
  view?: RefObject<View | null>,
) {
  const panning = useSharedValue(false);
  const pinch = useSharedValue<PinchState | null>(null);
  const multiTouch = useSharedValue(false);
  /** A second finger joined this drag, so lifting off shouldn't fling. */
  const pinched = useSharedValue(false);
  const lastTap = useSharedValue<{ at: number; x: number; y: number } | null>(null);
  const slop = 8;

  // Only the web needs it, and a native worklet mustn't capture the view.
  const origin = useMemo(() => {
    if (Platform.OS !== 'web' || !view) return null;
    return () => {
      const rect = (view.current as unknown as HTMLElement | null)?.getBoundingClientRect();
      return { x: rect?.left ?? 0, y: rect?.top ?? 0 };
    };
  }, [view]);

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
        // Two fingers are the pinch's. One left after a pinch drags the map.
        const zooming = pinch.value;
        if (zooming && zooming.pointers >= 2) return;
        move({ x: event.x, y: event.y, dx: event.changeX, dy: event.changeY, scale: 1 });
      })
      .onFinalize(({ velocityX, velocityY }) => {
        if (!panning.value) return;
        panning.value = false;
        if (pinch.value) return;
        if (pinched.value || !release) settle?.();
        else release(velocityX, velocityY);
      });

    // A finger lifting or landing moves the focal point in the same event
    // that still counts the old number of fingers, so the next update has to
    // start from the new focal point rather than move the map.
    const regroup = () => {
      'worklet';
      const current = pinch.value;
      if (current) pinch.value = { ...current, pointers: -1 };
    };
    const zoom = Gesture.Pinch()
      .onTouchesDown(regroup)
      .onTouchesUp(regroup)
      .onTouchesCancelled(regroup)
      .onStart(({ focalX, focalY, scale, numberOfPointers }) => {
        const offset = origin ? origin() : null;
        pinch.value = {
          x: focalX - (offset ? offset.x : 0),
          y: focalY - (offset ? offset.y : 0),
          scale,
          pointers: numberOfPointers,
        };
        pinched.value = true;
        lastTap.value = null;
        start?.();
      })
      .onUpdate(({ focalX, focalY, scale, numberOfPointers }) => {
        const previous = pinch.value;
        if (!previous) return;
        const offset = origin ? origin() : null;
        const next = {
          x: focalX - (offset ? offset.x : 0),
          y: focalY - (offset ? offset.y : 0),
          scale,
          pointers: numberOfPointers,
        };
        if (scale > 0) pinch.value = next;
        const motion = pinchStep(previous, next);
        if (motion) move(motion);
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
  }, [move, touch, start, settle, release, tap, doubleTap, origin, panning, pinch, pinched, lastTap, multiTouch]);
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
