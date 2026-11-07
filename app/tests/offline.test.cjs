const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function transpile(path) {
  const source = fs.readFileSync(path, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
}

/**
 * The web store and the catalog cache, running against an in-memory
 * localStorage. Native uses the same catalog cache over SQLite, so the
 * fallback rules checked here are the rules both platforms share.
 */
function loadCache() {
  const storage = new Map();
  const sandbox = {
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
    },
  };

  function require(name) {
    if (name === './webStore') return evaluate('src/storage/webStore.ts');
    if (name === './offlineStore') return evaluate('src/storage/offlineStore.web.ts');
    throw new Error(`unexpected import ${name}`);
  }

  function evaluate(path) {
    const exports = {};
    vm.runInNewContext(transpile(path), { exports, require, ...sandbox });
    return exports;
  }

  return {
    cache: evaluate('src/storage/catalogCache.ts').catalogCache,
    // The store reads `window` from this sandbox, not from the test.
    window: sandbox.window,
  };
}

function same(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

test('a failed catalog read returns the stored copy and says so', async () => {
  const { cache } = loadCache();

  const live = await cache.lines('dmrc', async () => [{ line_code: 'RED' }]);
  assert.equal(live.fromCache, false);
  assert.equal(live.data[0].line_code, 'RED');

  const stored = await cache.lines('dmrc', async () => {
    throw new Error('offline');
  });
  assert.equal(stored.fromCache, true);
  assert.equal(stored.data[0].line_code, 'RED');
  assert.equal(stored.savedAt, live.savedAt);
});

test('a live response replaces the stored copy', async () => {
  const { cache } = loadCache();
  await cache.notifications('nmrc', async () => [{ id: 1 }]);

  const fresh = await cache.notifications('nmrc', async () => [{ id: 2 }]);
  assert.equal(fresh.fromCache, false);
  assert.equal(fresh.data[0].id, 2);

  const stored = await cache.notifications('nmrc', async () => {
    throw new Error('offline');
  });
  same(stored.data, [{ id: 2 }]);
});

test('a catalog that was never fetched still fails when the network does', async () => {
  const { cache } = loadCache();

  await assert.rejects(
    cache.stationDetail('dmrc', 'KB', async () => {
      throw new Error('offline');
    }),
    { message: 'offline' },
  );
});

test('each network keeps its own copy', async () => {
  const { cache } = loadCache();
  await cache.lines('dmrc', async () => ['delhi']);

  await assert.rejects(
    cache.lines('nmrc', async () => {
      throw new Error('offline');
    }),
    { message: 'offline' },
  );

  const delhi = await cache.lines('dmrc', async () => {
    throw new Error('offline');
  });
  same(delhi.data, ['delhi']);
});

test('a failed refresh keeps the live copy instead of marking it offline', async () => {
  const { cache } = loadCache();
  const live = await cache.lines('dmrc', async () => ['delhi']);

  const again = await cache.lines(
    'dmrc',
    async () => {
      throw new Error('offline');
    },
    live,
  );
  assert.equal(again.fromCache, false);
  same(again.data, ['delhi']);
});

test('the stored station catalog drops the facility lists', () => {
  const exports = {};
  vm.runInNewContext(transpile('src/storage/stationCatalog.ts'), { exports });
  const stored = exports.toStoredStation({
    id: 1,
    station_name: 'Kashmere Gate',
    station_code: 'KG',
    station_facility: [{ name: 'ATM', class_name: 'atm', image: { title: '', file: '' } }],
    metro_lines: [{ line_code: 'RED' }],
    network: 'dmrc',
  });
  assert.equal('station_facility' in stored, false);
  assert.equal(stored.station_code, 'KG');

  const restored = exports.asSearchResult(stored);
  assert.equal(JSON.stringify(restored.station_facility), '[]');
  assert.equal(restored.metro_lines[0].line_code, 'RED');
});

test('a failed write does not turn a good response into an error', async () => {
  const { cache, window: sandboxWindow } = loadCache();
  const original = sandboxWindow.localStorage.setItem;
  sandboxWindow.localStorage.setItem = () => {
    throw new Error('full');
  };

  try {
    const result = await cache.lines('dmrc', async () => ['delhi']);
    same(result.data, ['delhi']);
    assert.equal(result.fromCache, false);
  } finally {
    sandboxWindow.localStorage.setItem = original;
  }
});
