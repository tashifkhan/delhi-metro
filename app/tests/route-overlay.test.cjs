const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/components/map/routeOverlay.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported });

test('Namo Bharat draws the shared track and marks the stops served by the train', () => {
  const stations = [
    { code: 'A10', name: 'Meerut South', x: 0, y: 0 },
    { code: 'A11', name: 'Partapur', x: 1, y: 1 },
    { code: 'A13', name: 'Shatabdi Nagar', x: 2, y: 0 },
  ];
  const color = '#E86E25';
  const geo = {
    stations,
    stationByCode: new Map(stations.map((station) => [station.code, station])),
    lines: [{ color, stations: stations.map((station) => station.code) }],
  };
  const leg = {
    kind: 'metro',
    network: 'ncrtc',
    from_station: 'Meerut South',
    from_station_code: 'A10',
    to_station: 'Shatabdi Nagar',
    to_station_code: 'A13',
    stops: [{ name: 'Meerut South' }, { name: 'Shatabdi Nagar' }],
  };

  const overlay = exported.buildRouteOverlay([leg], geo, () => color);
  assert.equal(overlay.segments[0].points.length, 3);
  assert.deepEqual([...overlay.stationCodes], ['A10', 'A13']);
});
