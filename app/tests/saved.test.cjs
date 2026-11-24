const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const source = fs.readFileSync('src/saved/model.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: () => { throw new Error('model.ts must stay pure'); } });
  return exports;
}

const m = load();
// The module runs in its own VM context, so compare plain copies of its arrays.
const plain = (value) => JSON.parse(JSON.stringify(value));
const rc = { code: 'RCK', name: 'Rajiv Chowk' };
const hk = { code: 'HKS', name: 'Hauz Khas' };

test('saving a trip twice removes it, newest first otherwise', () => {
  let s = m.toggleTrip(m.EMPTY_SAVED, rc, hk, 1);
  s = m.toggleTrip(s, hk, rc, 2);
  assert.deepEqual(plain(s.trips.map((t) => t.from.code)), ['HKS', 'RCK']);
  assert.equal(m.isTripSaved(s, 'rck', 'hks'), true, 'codes match case-insensitively');
  s = m.toggleTrip(s, rc, hk, 3);
  assert.equal(m.isTripSaved(s, 'RCK', 'HKS'), false);
  assert.equal(s.trips.length, 1);
});

test('a trip to the same station is not saved', () => {
  assert.equal(m.toggleTrip(m.EMPTY_SAVED, rc, rc, 1).trips.length, 0);
});

test('a place label is cleaned and matched case-insensitively, keeping its position', () => {
  let s = m.setPlace(m.EMPTY_SAVED, '  home ', rc);
  s = m.setPlace(s, 'Work', hk);
  s = m.setPlace(s, 'HOME', hk);
  assert.deepEqual(plain(s.places.map((p) => [p.label, p.station.code])), [['home', 'HKS'], ['Work', 'HKS']]);
  assert.equal(m.setPlace(s, '   ', rc), s, 'an empty label changes nothing');
  assert.equal(m.removePlace(s, 'WORK').places.length, 1);
});

test('stored data that is malformed is dropped, not thrown', () => {
  assert.deepEqual(plain(m.decodeSaved(null)), { trips: [], places: [] });
  assert.deepEqual(plain(m.decodeSaved('nope')), { trips: [], places: [] });
  const decoded = m.decodeSaved({
    trips: [{ from: rc, to: hk, savedAt: 5 }, { from: { code: '' }, to: hk, savedAt: 1 }, null],
    places: [{ label: 'Gym', station: hk }, { label: ' ', station: rc }, { label: 'X' }],
  });
  assert.equal(decoded.trips.length, 1);
  assert.deepEqual(plain(decoded.places.map((p) => p.label)), ['Gym']);
});

test('launcher shortcuts read "From <place>", at most four, with the station to start from', () => {
  const source = fs.readFileSync('src/saved/shortcuts.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const shortcuts = {};
  vm.runInNewContext(code, { exports: shortcuts });
  const places = ['Home', 'Work', 'Gym', 'College', 'Clinic'].map((label, i) => ({ label, station: { code: `S${i}`, name: `Station ${i}` } }));
  const items = plain(shortcuts.shortcutsFor(places));
  assert.equal(items.length, 4);
  assert.deepEqual(items[0], { id: 'place:home', title: 'From Home', subtitle: 'Station 0', icon: 'symbol:house', params: { code: 'S0', name: 'Station 0' } });
  assert.equal(plain(shortcuts.shortcutsFor(places, 2)).length, 2, "the launcher's own limit wins");
});
