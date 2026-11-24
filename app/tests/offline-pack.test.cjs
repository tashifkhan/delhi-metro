const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function evaluate(path, requireFn) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireFn, JSON, Error });
  return exports;
}

const model = evaluate('src/offline/model.ts', () => { throw new Error('model must stay pure'); });
const sync = evaluate('src/offline/sync.ts', (name) => {
  if (name === './model') return model;
  throw new Error(`Unexpected module ${name}`);
});

const manifest = { version: '2026-11-24', generated_at: '2026-11-24T02:00:00Z', sha256: 'abc', size_bytes: 1234, sections: {} };
const response = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

function memoryStore(meta = null) {
  const writes = [];
  return { writes, readMeta: async () => meta, write: async (body, m) => { writes.push([body, m]); meta = m; } };
}

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push([url, init]);
    const path = url.replace('https://api.test', '');
    if (!(path in routes)) throw new Error(`unexpected ${path}`);
    const route = routes[path];
    return typeof route === 'function' ? route(init) : route;
  };
  return { fn, calls };
}

const deps = (fetchFn, store) => ({ apiBase: 'https://api.test', fetchFn, store, now: () => 42 });

test('downloads when nothing is held, and records the manifest version', async () => {
  const store = memoryStore();
  const { fn } = fakeFetch({
    '/api/v1/export/manifest': response(200, manifest),
    '/api/v1/export': response(200, '{"version":"2026-11-24","stations":[]}'),
  });
  const outcome = await sync.syncPack(deps(fn, store));
  assert.equal(outcome.kind, 'downloaded');
  assert.equal(store.writes.length, 1);
  assert.equal(store.writes[0][1].version, '2026-11-24');
  assert.equal(store.writes[0][1].savedAt, 42);
});

test('skips the download when the held pack matches the manifest', async () => {
  const held = { version: '2026-11-24', sha256: 'abc', generatedAt: 'x', sizeBytes: 10, savedAt: 1 };
  const store = memoryStore(held);
  const { fn, calls } = fakeFetch({ '/api/v1/export/manifest': response(200, manifest) });
  const outcome = await sync.syncPack(deps(fn, store));
  assert.equal(outcome.kind, 'up-to-date');
  assert.equal(calls.length, 1, 'only the manifest is fetched');
  assert.equal(store.writes.length, 0);
});

test('a 404 means the server offers no pack yet', async () => {
  const { fn } = fakeFetch({ '/api/v1/export/manifest': response(404, {}) });
  assert.equal((await sync.syncPack(deps(fn, memoryStore()))).kind, 'unavailable');
});

test('a truncated download never replaces the held pack', async () => {
  const held = { version: 'old', sha256: 'old', generatedAt: 'x', sizeBytes: 10, savedAt: 1 };
  const store = memoryStore(held);
  const { fn, calls } = fakeFetch({
    '/api/v1/export/manifest': response(200, manifest),
    '/api/v1/export': response(200, '{"version":"2026-11-24","stat'),
  });
  const outcome = await sync.syncPack(deps(fn, store));
  assert.equal(outcome.kind, 'failed');
  assert.equal(store.writes.length, 0);
  assert.equal(calls[1][1].headers['If-None-Match'], '"old"', 'asks for a 304 against the held pack');
});

test('a network error is a failure, not a crash', async () => {
  const fn = async () => { throw new Error('Network request failed'); };
  const outcome = await sync.syncPack(deps(fn, memoryStore()));
  assert.equal(outcome.kind, 'failed');
});

test('auto-sync respects the switches and never runs offline', () => {
  assert.equal(model.mayAutoSync({ autoSync: true, wifiOnly: false }, 'cellular'), true);
  assert.equal(model.mayAutoSync({ autoSync: true, wifiOnly: true }, 'cellular'), false);
  assert.equal(model.mayAutoSync({ autoSync: true, wifiOnly: true }, 'wifi'), true);
  assert.equal(model.mayAutoSync({ autoSync: false, wifiOnly: false }, 'wifi'), false);
  assert.equal(model.mayAutoSync({ autoSync: true, wifiOnly: false }, 'none'), false);
  assert.equal(model.dueForCheck(null, 0), true);
  assert.equal(model.dueForCheck(0, model.AUTO_SYNC_INTERVAL_MS - 1), false);
});
