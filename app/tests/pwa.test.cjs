const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const html = fs.readFileSync('public/index.html', 'utf8');
const hook = fs.readFileSync('src/hooks/usePwaInstall.ts', 'utf8');

test('manifest carries what a browser needs before it will offer an install', () => {
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name);

  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192'), 'needs a 192px icon');
  assert.ok(sizes.includes('512x512'), 'needs a 512px icon');
  assert.ok(
    manifest.icons.some((icon) => icon.purpose === 'maskable'),
    'needs a maskable icon, or Android shrinks the one it has onto a blob',
  );
});

test('every icon the manifest names is actually shipped', () => {
  const referenced = [
    ...manifest.icons.map((icon) => icon.src),
    ...manifest.shortcuts.flatMap((shortcut) => shortcut.icons.map((icon) => icon.src)),
  ];
  for (const src of new Set(referenced)) {
    assert.ok(fs.existsSync(path.join('public', src)), `${src} is missing from public/`);
  }
});

test('shortcuts point at routes the navigator actually has', () => {
  const linking = fs.readFileSync('src/navigation/linking.ts', 'utf8');
  for (const shortcut of manifest.shortcuts) {
    const segment = shortcut.url.replace(/^\//, '');
    assert.ok(linking.includes(`'${segment}'`), `no route for ${shortcut.url}`);
  }
});

test('the html template still lets Expo fill it in and the app mount', () => {
  // The exporter substitutes these two and appends the bundle script. Losing
  // the root element would ship a page that renders nothing at all.
  assert.ok(html.includes('%WEB_TITLE%'));
  assert.ok(html.includes('%LANG_ISO_CODE%'));
  assert.ok(html.includes('id="root"'));
});

test('the html links the manifest and the touch icon it ships', () => {
  assert.ok(html.includes('rel="manifest" href="/manifest.webmanifest"'));

  const appleIcon = html.match(/rel="apple-touch-icon" href="([^"]+)"/);
  assert.ok(appleIcon, 'no apple-touch-icon link');
  assert.ok(fs.existsSync(path.join('public', appleIcon[1])));
});

test('the install prompt is stashed under the key the hook reads back', () => {
  const stashed = html.match(/window\.(__\w+)\s*=\s*event/);
  assert.ok(stashed, 'the beforeinstallprompt event is never stashed');
  assert.ok(hook.includes(`'${stashed[1]}'`), `usePwaInstall does not read ${stashed[1]}`);

  const notified = html.match(/new Event\('([\w-]+)'\)/);
  assert.ok(notified, 'nothing tells the app a prompt arrived');
  assert.ok(hook.includes(`'${notified[1]}'`), `usePwaInstall does not listen for ${notified[1]}`);

  // Without this, the browser shows its own install bar next to the app's.
  assert.ok(html.includes('event.preventDefault()'));
});

test('the worker is registered off the Metro dev ports only', () => {
  assert.ok(html.includes("navigator.serviceWorker.register('/sw.js')"));
  assert.ok(html.includes("'8081'"), 'the Metro dev port is not excluded');
});

function loadWorker() {
  const handlers = {};
  const origin = 'https://ncr-metro.tashif.codes';
  const stored = new Map();

  const cache = {
    match: async (request) => stored.get(request.url ?? request) ?? undefined,
    put: async (request, response) => stored.set(request.url ?? request, response),
    add: async () => {},
  };
  const caches = {
    open: async () => cache,
    match: async (request) => cache.match(request),
    keys: async () => [],
    delete: async () => true,
  };

  const context = {
    self: {
      addEventListener: (type, handler) => handlers[type] = handler,
      location: { origin },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches,
    fetch: async () => ({ ok: true, clone: () => ({}), from: 'network' }),
    URL,
    Request: class {
      constructor(url) {
        this.url = url;
      }
    },
  };

  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), context);
  return {
    handlers,
    stored,
    origin,
    /** Returns what the worker answered with, or null if it stood aside. */
    handle(request) {
      let responded = null;
      handlers.fetch({ request, respondWith: (value) => responded = value });
      return responded;
    },
  };
}

test('the worker handles fetches, or it is not installable at all', () => {
  const { handlers } = loadWorker();
  for (const type of ['install', 'activate', 'fetch']) {
    assert.equal(typeof handlers[type], 'function', `no ${type} handler`);
  }
});

test('live metro data is never answered from the cache', async () => {
  const worker = loadWorker();
  worker.stored.set(`${worker.origin}/api/v1/dmrc/lines`, { from: 'cache' });

  for (const pathname of ['/api', '/api/v1/dmrc/lines']) {
    const answer = worker.handle({ method: 'GET', mode: 'cors', url: worker.origin + pathname });
    assert.equal(answer, null, `${pathname} was answered by the worker`);
  }
});

test('non-GET requests and other origins are left alone', () => {
  const worker = loadWorker();

  assert.equal(
    worker.handle({ method: 'POST', mode: 'cors', url: `${worker.origin}/api/v1/dmrc/lines` }),
    null,
  );
  assert.equal(
    worker.handle({ method: 'GET', mode: 'navigate', url: 'https://tashif.codes/download/delhi-metro' }),
    null,
  );
});

test('hashed bundles come from the cache, navigations from the network', async () => {
  const worker = loadWorker();
  const bundle = `${worker.origin}/_expo/static/js/web/index-abc123.js`;
  worker.stored.set(bundle, { from: 'cache' });

  const asset = await worker.handle({ method: 'GET', mode: 'no-cors', url: bundle });
  assert.equal(asset.from, 'cache');

  const page = await worker.handle({ method: 'GET', mode: 'navigate', url: `${worker.origin}/map` });
  assert.equal(page.from, 'network');
});

test('an offline navigation falls back to the cached shell', async () => {
  const worker = loadWorker();
  worker.stored.set('/', { from: 'shell' });

  // Every client-side route is served by the same page, so the cached shell
  // can answer a deep link that was never opened online.
  const answer = await offlineNavigate(worker, `${worker.origin}/lines/RED`);
  assert.equal(answer.from, 'shell');
});

/** Re-runs the worker with a network that always fails. */
function offlineNavigate(worker, url) {
  const stored = worker.stored;
  const handlers = {};
  const context = {
    self: {
      addEventListener: (type, handler) => handlers[type] = handler,
      location: { origin: worker.origin },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({ put: async () => {}, add: async () => {} }),
      match: async (request) => stored.get(request.url ?? request) ?? undefined,
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async () => {
      throw new Error('offline');
    },
    URL,
    Request: class {
      constructor(value) {
        this.url = value;
      }
    },
  };

  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), context);

  let responded = null;
  handlers.fetch({
    request: { method: 'GET', mode: 'navigate', url },
    respondWith: (value) => responded = value,
  });
  return responded;
}
