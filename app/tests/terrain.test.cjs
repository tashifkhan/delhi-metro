const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const overview = JSON.parse(fs.readFileSync('src/data/terrain.json', 'utf8'));
// The detail layer now ships in the offline pack; its source lives with the API.
const detail = JSON.parse(fs.readFileSync('../api/data/terrainDetail.json', 'utf8'));
const packWithTerrain = (terrain_detail) => ({ bundle: { sections: { terrain_detail } } });
let pack = Promise.resolve(packWithTerrain(detail));

function evaluate(path) {
  const exports = {};
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const requireFn = (name) => {
    if (name.endsWith('terrain.json')) return overview;
    if (name.endsWith('offline/reader')) return { readPack: () => pack };
    throw new Error(`unexpected require ${name}`);
  };
  vm.runInNewContext(code, { exports, require: requireFn, Promise });
  return exports;
}

const terrain = evaluate('src/components/map/terrain.ts');

test('the overview has contours, water and two high-ground bands', () => {
  assert.ok(overview.minor.startsWith('M'));
  assert.ok(overview.major.startsWith('M'));
  assert.ok(overview.water.length > 0);
  assert.equal(overview.high.length, 2);
});

test('overview culling keeps whole paths in source order, including at the network scale', () => {
  const whole = terrain.overviewForView({ x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 }, 0);
  for (const key of ['minor', 'major', 'water', 'rivers']) assert.equal(whole[key], overview[key]);
  assert.deepEqual(whole.high, overview.high);

  const central = terrain.overviewForView({ x0: -12_000, y0: -18_000, x1: 12_000, y1: 18_000 }, 12);
  for (const key of ['minor', 'major', 'water', 'rivers']) {
    assert.ok(central[key].length < overview[key].length);
    const kept = new Set(central[key].match(/M[^M]+/g));
    assert.equal(overview[key].match(/M[^M]+/g).filter((part) => kept.has(part)).join(''), central[key]);
  }
});

test('detail chunks sit on the chunk grid', () => {
  assert.ok(detail.chunks.length > 0);
  for (const chunk of detail.chunks) {
    assert.equal(Math.abs(chunk.x % detail.chunkSize), 0);
    assert.equal(Math.abs(chunk.y % detail.chunkSize), 0);
  }
});

test('chunksIn returns only the chunks overlapping a view', () => {
  const size = detail.chunkSize;
  const [first] = detail.chunks;
  const inside = terrain.chunksIn(detail, first.x + 1, first.y + 1, first.x + size - 1, first.y + size - 1);
  assert.deepEqual(
    inside.map((c) => `${c.x},${c.y}`),
    [`${first.x},${first.y}`],
  );
  const nowhere = terrain.chunksIn(detail, 1e9, 1e9, 1e9 + 1, 1e9 + 1);
  assert.equal(nowhere.length, 0);
});

test('a close-up of Begumpul has contour data in the current pack', () => {
  const view = [45_000, -43_000, 49_000, -38_000];
  const chunks = terrain.detailChunksForView(detail, view, view);
  assert.ok(chunks?.some((chunk) => chunk.minor || chunk.major));
});

test('the overview fills gaps even if old detail overlaps the drawing area', () => {
  const [first] = detail.chunks;
  const legacy = { chunkSize: detail.chunkSize, chunks: [first] };
  const { x, y } = first;
  const draw = [x - 20, y - 20, x + 50, y + 50];
  const covered = [x + 10, y + 10, x + 20, y + 20];
  assert.equal(terrain.detailChunksForView(legacy, covered, draw).length, 1);
  assert.equal(terrain.detailChunksForView(legacy, [x - 10, y, x + 10, y + 10], draw), null);
  assert.equal(terrain.detailChunksForView(legacy, [x - 10, y, x - 5, y + 10], draw), null);
  assert.equal(terrain.detailChunksForView({ ...legacy, chunks: [], bounds: draw }, covered, draw), null);
});

test('the detail layer is shared until the offline pack changes', async () => {
  const a = terrain.loadTerrainDetail();
  const b = terrain.loadTerrainDetail();
  assert.equal(a, b);
  assert.equal(await a, detail);

  const updated = { ...detail, interval: 2 };
  pack = Promise.resolve(packWithTerrain(updated));
  assert.equal(await terrain.loadTerrainDetail(), updated);

  pack = Promise.resolve(null);
  assert.equal(await terrain.loadTerrainDetail(), null);
});
