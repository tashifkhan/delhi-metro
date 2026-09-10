/**
 * Service worker for the web build.
 *
 * It has two jobs. A browser will not offer to install a page unless a worker
 * handles its fetches, and the app has to survive a platform where the signal
 * drops the moment the train enters the tunnel.
 *
 * What gets cached follows what each response is worth offline. The shell and
 * the hashed bundles are safe to keep. Live metro data is not, since a stale
 * fare or a stale alert is worse than an error.
 */

const CACHE = 'ncr-metro-v1';
const SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // A fresh copy of the shell, so the first offline load has something to
      // start from. Failing here must not fail the install.
      .then((cache) => cache.add(new Request(SHELL, { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Content-hashed by the exporter, so a hit is always the right file. */
function isImmutable(url) {
  return url.pathname.startsWith('/_expo/static/');
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.webmanifest'
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallback) {
      const shell = await caches.match(fallback);
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The app reads timetables, fares and alerts live from the operators. A
  // cached answer would put a wrong number in front of someone at a gate, so
  // these go straight to the network and the app handles its own failures.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (isImmutable(url) || isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Every other path is a client-side route, and the server answers all of
  // them with the same shell. Offline, the copy already here answers instead.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL));
  }
});
