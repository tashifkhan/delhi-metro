const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');

const { moveViewport, viewportTransform, needsRedraw, imageTransform } = (() => {
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

test('drag respects the network bounds and reuses the drawing until its edge nears the screen', () => {
  const drag = (dx, dy) => moveViewport(initial, limits, { x: 200, y: 300, dx, dy, scale: 1 });
  const near = drag(100, -80);
  assert.deepEqual(viewportTransform(near, initial), { x: 100, y: -80, scale: 1 });
  assert.equal(needsRedraw(near, initial, size), false);
  assert.equal(needsRedraw(drag(125, 0), initial, size), true);
  assert.equal(needsRedraw({ ...initial, k: 0.5 }, initial, size), true);
  assert.equal(drag(5_000, 0).cx, limits.minX);
});

test('official map zoom anchors to the pointer and clamps to the fitted image', () => {
  const wideImage = { width: 800, height: 300 };
  const zoom = imageTransform([0, 0, 1], size, wideImage, { x: 160, y: 300, dx: 0, dy: 0, scale: 2 });
  assert.deepEqual(zoom, [40, 0, 2]);
  const pan = imageTransform(zoom, size, wideImage, { x: 200, y: 300, dx: 500, dy: 100, scale: 1 });
  assert.deepEqual(pan, [200, 0, 2]);
  assert.deepEqual(imageTransform(pan, size, wideImage, { x: 160, y: 300, dx: 0, dy: 0, scale: 0.1 }), [0, 0, 1]);
});
