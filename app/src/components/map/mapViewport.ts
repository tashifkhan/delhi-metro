import type { Box } from './labels';
import type { NetworkGeometry } from './geometry';

export interface Viewport {
  cx: number;
  cy: number;
  /** Screen pixels per metre. */
  k: number;
}

export interface MapSize {
  width: number;
  height: number;
}

export const MAX_MAP_IMAGE_EDGE = 4_096;

export interface OfficialMapRasterProps {
  uri: string;
  onReady: (size: MapSize) => void;
  onError: () => void;
}

export interface MapMotion {
  x: number;
  y: number;
  dx: number;
  dy: number;
  scale: number;
}

export type CameraLimits = MapSize & NetworkGeometry['bounds'] & {
  minK: number;
  maxK: number;
};

// The sharp drawing reaches 12% of the viewport past each edge. The GPU
// paints all of it on every redraw, and at this size it fits in a 4096 px
// texture even on a 1440 x 3200 screen. The backdrop covers whatever a
// gesture uncovers past it.
export const OVERSCAN = 0.12;

export function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function constrainViewport(view: Viewport, limits: CameraLimits): Viewport {
  'worklet';
  return {
    cx: clamp(view.cx, limits.minX, limits.maxX),
    cy: clamp(view.cy, limits.minY, limits.maxY),
    k: clamp(view.k, limits.minK, limits.maxK),
  };
}

export function moveViewport(view: Viewport, limits: CameraLimits, motion: MapMotion): Viewport {
  'worklet';
  const k = clamp(view.k * motion.scale, limits.minK, limits.maxK);
  const x = motion.x - limits.width / 2;
  const y = motion.y - limits.height / 2;
  return {
    cx: clamp(view.cx + (x - motion.dx) / view.k - x / k, limits.minX, limits.maxX),
    cy: clamp(view.cy + (y - motion.dy) / view.k - y / k, limits.minY, limits.maxY),
    k,
  };
}

export function viewportTransform(view: Viewport, drawn: Viewport) {
  'worklet';
  return {
    x: (drawn.cx - view.cx) * view.k,
    y: (drawn.cy - view.cy) * view.k,
    scale: drawn.k > 0 ? view.k / drawn.k : 1,
  };
}

export function drawingBounds(view: Viewport, size: MapSize, overscan = OVERSCAN): Box {
  const halfW = size.width * (0.5 + overscan) / view.k;
  const halfH = size.height * (0.5 + overscan) / view.k;
  return { x0: view.cx - halfW, y0: view.cy - halfH, x1: view.cx + halfW, y1: view.cy + halfH };
}

export type ImageTransform = [x: number, y: number, scale: number];

export function imageTransform(
  [tx, ty, previousScale]: ImageTransform,
  canvas: MapSize,
  image: MapSize,
  motion: MapMotion,
): ImageTransform {
  'worklet';
  const scale = clamp(previousScale * motion.scale, 1, 5);
  const ratio = scale / previousScale;
  const x = motion.x - canvas.width / 2;
  const y = motion.y - canvas.height / 2;
  const fit = image.width && image.height ? Math.min(canvas.width / image.width, canvas.height / image.height) : 0;
  const maxX = Math.max(0, ((fit ? image.width * fit : canvas.width) * scale - canvas.width) / 2);
  const maxY = Math.max(0, ((fit ? image.height * fit : canvas.height) * scale - canvas.height) / 2);
  return [
    clamp(x - (x - motion.dx - tx) * ratio, -maxX, maxX),
    clamp(y - (y - motion.dy - ty) * ratio, -maxY, maxY),
    scale,
  ];
}
