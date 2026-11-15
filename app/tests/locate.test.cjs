const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

/** The near-me rules from `src/components/map/locate.ts`. */
function loadLocate() {
  const source = fs.readFileSync('src/components/map/locate.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: () => ({}) });
  return exports;
}

const { decide, roughDistance } = loadLocate();

const stations = [
  { code: 'RCK', name: 'RAJIV CHOWK', x: 0, y: 0 },
  { code: 'BCGN', name: 'BOTANICAL GARDEN', x: 11_000, y: 7_600 },
];

test('a precise fix picks the closest station', () => {
  const outcome = decide(stations, { x: 10_800, y: 7_500, accuracy: 30 });
  assert.equal(outcome.kind, 'station');
  assert.equal(outcome.station.code, 'BCGN');
});

test('a coarse fix picks nothing, however close a station looks', () => {
  // A Wi-Fi or IP estimate can land on a station kilometres from the user.
  const outcome = decide(stations, { x: 50, y: 50, accuracy: 20_000 });
  assert.equal(outcome.kind, 'imprecise');
  assert.equal(outcome.accuracy, 20_000);
});

test('a missing accuracy counts as coarse', () => {
  assert.equal(decide(stations, { x: 0, y: 0, accuracy: NaN }).kind, 'imprecise');
});

test('a precise fix far from the network says how far', () => {
  const outcome = decide(stations, { x: -9_000, y: 0, accuracy: 20 });
  assert.equal(outcome.kind, 'far');
  assert.equal(Math.round(outcome.distance), 9_000);
});

test('distances read the way a person says them', () => {
  assert.equal(roughDistance(20_000), '20 km');
  assert.equal(roughDistance(1_240), '1.2 km');
  assert.equal(roughDistance(320), '300 m');
  assert.equal(roughDistance(10), '50 m');
});
