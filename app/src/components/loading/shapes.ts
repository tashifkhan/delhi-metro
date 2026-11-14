/**
 * The shape sequence of Material 3 Expressive's LoadingIndicator, as radial
 * functions.
 *
 * Compose's indicator morphs between rounded polygons from `MaterialShapes`
 * (soft burst, 9-sided cookie, pentagon, pill, sunny, 4-sided cookie, oval).
 * Describing each one as a radius per angle, sampled at the same angles, makes
 * any two shapes morph by plain interpolation: point i of one shape moves to
 * point i of the next, with no matching step and no self-intersection.
 *
 * Pure functions, no React, so they can be tested on their own.
 */

export const SAMPLES = 96;

type Radial = (theta: number) => number;

/** Wavy edge: `lobes` bumps of the given depth around a circle. */
const wavy = (lobes: number, depth: number, sharpness = 1): Radial => (theta) => {
  const wave = Math.cos(lobes * theta);
  const shaped = Math.sign(wave) * Math.abs(wave) ** sharpness;
  return 1 - depth + depth * (shaped + 1) * 0.5;
};

/** Regular polygon with rounded corners: straight edges blended toward a circle. */
const roundedPolygon = (sides: number, rounding: number, rotation = 0): Radial => (theta) => {
  const sector = (2 * Math.PI) / sides;
  const local = ((((theta - rotation) % sector) + sector) % sector) - sector / 2;
  const straight = Math.cos(Math.PI / sides) / Math.cos(local);
  return straight * (1 - rounding) + rounding;
};

/** Superellipse: exponent 2 is an ellipse, higher flattens into a pill. */
const superellipse = (a: number, b: number, exponent: number): Radial => (theta) => {
  const c = Math.abs(Math.cos(theta)) / a;
  const s = Math.abs(Math.sin(theta)) / b;
  return (c ** exponent + s ** exponent) ** (-1 / exponent);
};

/** The order Compose's LoadingIndicator cycles through. */
const SEQUENCE: Radial[] = [
  wavy(10, 0.2, 0.6), // soft burst
  wavy(9, 0.14), // 9-sided cookie
  roundedPolygon(5, 0.3, -Math.PI / 2), // pentagon
  superellipse(1, 0.62, 3.2), // pill
  wavy(8, 0.1), // sunny
  wavy(4, 0.2), // 4-sided cookie
  superellipse(1, 0.78, 2), // oval
];

/** Radii for every shape, each scaled so its furthest point sits at 1. */
export const SHAPES: number[][] = SEQUENCE.map((shape) => {
  const radii = Array.from({ length: SAMPLES }, (_, i) => shape((i / SAMPLES) * 2 * Math.PI));
  const max = Math.max(...radii);
  return radii.map((r) => r / max);
});

/**
 * Smooth closed SVG path through the sampled points of a morph between two
 * shapes, rotated by `rotation` radians and scaled to `radius` around (cx, cy).
 *
 * Uses Catmull-Rom segments converted to cubic Béziers, so 96 samples read as
 * a continuous curve rather than a polygon.
 */
export function morphPath(
  from: number[],
  to: number[],
  progress: number,
  rotation: number,
  radius: number,
  cx: number,
  cy: number,
): string {
  const points: [number, number][] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const r = (from[i] + (to[i] - from[i]) * progress) * radius;
    const theta = (i / SAMPLES) * 2 * Math.PI + rotation;
    points.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
  }

  const n = points.length;
  let d = `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Time per shape, and how much of it the morph itself takes. */
export const STEP_MS = 650;
const MORPH_SHARE = 0.75;
/** Slow base spin, plus a quarter turn carried by each morph, as in Compose. */
const SPIN_MS = 4666;

/** Overshooting ease, standing in for Compose's spring on the morph. */
function springy(t: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Shape pair, morph progress and rotation at a given elapsed time. */
export function frameAt(elapsedMs: number): {
  from: number[];
  to: number[];
  progress: number;
  rotation: number;
} {
  const step = Math.floor(elapsedMs / STEP_MS);
  const within = (elapsedMs % STEP_MS) / STEP_MS;
  const linear = Math.min(1, within / MORPH_SHARE);
  const progress = springy(linear);
  const rotation =
    (elapsedMs / SPIN_MS) * 2 * Math.PI + (step + Math.min(1, linear)) * (Math.PI / 2);
  return {
    from: SHAPES[step % SHAPES.length],
    to: SHAPES[(step + 1) % SHAPES.length],
    progress,
    rotation,
  };
}
