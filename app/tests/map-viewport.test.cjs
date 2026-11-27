const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

const { moveViewport, viewportTransform, imageTransform } = (() => {
  const source = readFileSync('src/components/map/mapViewport.ts', 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  new Function('exports', outputText)(exports);
  return exports;
})();

const size = { width: 400, height: 600 };
const limits = { ...size, minK: 0.5, maxK: 4, minX: -1_000, maxX: 1_000, minY: -1_000, maxY: 1_000 };
const initial = { cx: 0, cy: 0, k: 1 };

test('pinch keeps the same map point under a moving midpoint, even at the zoom limit', () => {
  const { x, y, dx, dy } = { x: 150, y: 380, dx: 40, dy: 40 };
  const next = moveViewport(initial, limits, { x, y, dx, dy, scale: 10 });
  assert.equal(next.k, limits.maxK);
  assert.equal(next.cx + (x - size.width / 2) / next.k, x - dx - size.width / 2);
  assert.equal(next.cy + (y - size.height / 2) / next.k, y - dy - size.height / 2);
});

test('drag respects the network bounds and moves the drawing by the finger', () => {
  const drag = (dx, dy) => moveViewport(initial, limits, { x: 200, y: 300, dx, dy, scale: 1 });
  assert.deepEqual(viewportTransform(drag(100, -80), initial), { x: 100, y: -80, scale: 1 });
  assert.equal(drag(5_000, 0).cx, limits.minX);
});

test('a fixed drawing centred on the screen lines up with the camera', () => {
  // The backdrop: a box of the map drawn once, scaled about its own centre.
  const drawing = { cx: 300, cy: -100, k: 0.25 };
  const live = { cx: 120, cy: 40, k: 2 };
  const { x, y, scale } = viewportTransform(live, drawing);
  const point = { x: 380, y: -60 };
  // Offset from the box centre in the drawing, scaled, then moved.
  const sx = size.width / 2 + x + scale * (point.x - drawing.cx) * drawing.k;
  const sy = size.height / 2 + y + scale * (point.y - drawing.cy) * drawing.k;
  assert.ok(Math.abs(sx - (size.width / 2 + (point.x - live.cx) * live.k)) < 1e-9);
  assert.ok(Math.abs(sy - (size.height / 2 + (point.y - live.cy) * live.k)) < 1e-9);
});

test('the drawing and its anchor compose to the live camera', () => {
  const anchor = { cx: 120, cy: -40, k: 0.8 };
  const drawn = { cx: -300, cy: 200, k: 2.5 };
  const live = { cx: -250, cy: 180, k: 3 };
  const inner = viewportTransform(anchor, drawn);
  const outer = viewportTransform(live, anchor);
  const direct = viewportTransform(live, drawn);
  // A point d px from the layer centre lands at outer(inner(d)).
  for (const d of [0, 37, -150]) {
    const composed = outer.x + outer.scale * (inner.x + inner.scale * d);
    assert.ok(Math.abs(composed - (direct.x + direct.scale * d)) < 1e-9);
  }
  assert.ok(Math.abs(outer.scale * inner.scale - direct.scale) < 1e-12);
});

test('official map zoom anchors to the pointer and clamps to the fitted image', () => {
  const wideImage = { width: 800, height: 300 };
  const zoom = imageTransform([0, 0, 1], size, wideImage, { x: 160, y: 300, dx: 0, dy: 0, scale: 2 });
  assert.deepEqual(zoom, [40, 0, 2]);
  const pan = imageTransform(zoom, size, wideImage, { x: 200, y: 300, dx: 500, dy: 100, scale: 1 });
  assert.deepEqual(pan, [200, 0, 2]);
  assert.deepEqual(imageTransform(pan, size, wideImage, { x: 160, y: 300, dx: 0, dy: 0, scale: 0.1 }), [0, 0, 1]);
});
