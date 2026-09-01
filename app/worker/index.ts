/**
 * Cloudflare Worker that hosts the Expo web build.
 *
 * Static files are served straight from the `dist/` asset bundle — those
 * requests never reach this handler. What does reach it is everything the
 * bundle has no file for:
 *
 *   - the API and its documentation, reverse-proxied to the FastAPI backend so
 *     the browser talks to a single origin. The API sends no CORS headers, so a
 *     direct cross-origin call from the page would be blocked.
 *   - every other path, which falls through to the single-page app shell.
 */

interface Env {
  ASSETS: Fetcher;
  API_ORIGIN: string;
}

/**
 * Headers worth forwarding upstream. The request's own `host`, `cf-*`, and
 * hop-by-hop headers must not be: the upstream is a different origin, and
 * Vercel routes on `host`.
 */
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'range',
  'user-agent',
];

/**
 * Paths the backend's own HTML asks for by absolute path, so they cannot be
 * moved under `/api`. Swagger UI at `/api/docs` fetches `/openapi.json`, and
 * the docs page posts analytics to `/ph/*`.
 */
const DOCS_PATHS = new Set(['playground', 'docs', 'redoc', 'openapi.json']);

function isRootPassthrough(pathname: string): boolean {
  return pathname === '/openapi.json' || pathname === '/ph' || pathname.startsWith('/ph/');
}

/**
 * Map a request path onto the backend.
 *
 * The backend serves its endpoints under `/api/v1` and `/api/v2`, but its
 * documentation at the root: `/` for the landing page, plus `/playground`,
 * `/docs` and `/redoc`. Publishing that root directly would collide with the
 * web app, so everything is offered under `/api` and the prefix is dropped for
 * anything that is not a versioned endpoint.
 *
 *   /api                 -> /              (docs landing)
 *   /api/playground      -> /playground
 *   /api/docs            -> /docs
 *   /api/v1/dmrc/lines   -> /api/v1/dmrc/lines  (unchanged)
 *
 * The docs page builds its own playground link from `window.location.pathname`,
 * so it follows the prefix without any rewriting here.
 */
function upstreamPathname(pathname: string): string | null {
  if (isRootPassthrough(pathname)) {
    return pathname;
  }

  if (pathname === '/api' || pathname === '/api/') {
    return '/';
  }

  if (!pathname.startsWith('/api/')) {
    return null;
  }

  const rest = pathname.slice('/api/'.length);
  if (DOCS_PATHS.has(rest) || rest.startsWith('ph/')) {
    return `/${rest}`;
  }

  // Anything else is forwarded verbatim, so a mistaken `/api/api/v1/...` still
  // reaches the backend as `/api/api/v1/...` and gets the 404 it deserves,
  // rather than being quietly rewritten into a working endpoint.
  return pathname;
}

/**
 * Re-point the documentation's own navigation at the `/api` prefix.
 *
 * The backend writes its links as absolute root paths (`/`, `/docs`,
 * `/redoc`), which are correct when it is served at a domain of its own. Here
 * the root belongs to the web app, so an unrewritten link drops the reader
 * into the journey planner. Links that already carry the prefix, including the
 * `/api/v2/...` request examples, are left alone.
 */
class DocsLinkRewriter {
  element(element: Element): void {
    const href = element.getAttribute('href');
    if (href === null || !href.startsWith('/') || href.startsWith('//')) {
      return;
    }
    if (href === '/') {
      element.setAttribute('href', '/api');
      return;
    }
    if (href !== '/api' && !href.startsWith('/api/')) {
      element.setAttribute('href', `/api${href}`);
    }
  }
}

function buildUpstreamRequest(request: Request, path: string, apiOrigin: string): Request {
  const url = new URL(request.url);
  const upstreamUrl = new URL(path + url.search, apiOrigin);

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }

  return new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'follow',
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const path = upstreamPathname(pathname);

    if (path !== null) {
      let upstream: Response;
      try {
        upstream = await fetch(buildUpstreamRequest(request, path, env.API_ORIGIN));
      } catch {
        // A dead upstream should read as a gateway failure, not a Worker crash,
        // so the app's error states can render the way they do on native.
        return Response.json(
          { detail: 'The metro API is unreachable right now. Please try again.' },
          { status: 502 },
        );
      }

      // The body streams through untouched; only the immutable header set has
      // to be rebuilt so it can be returned.
      const response = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: new Headers(upstream.headers),
      });

      // Only the documentation pages carry links to fix. Endpoint responses are
      // JSON or map images and must not be parsed as HTML.
      const isDocument = response.headers.get('content-type')?.includes('text/html') ?? false;
      if (isDocument) {
        return new HTMLRewriter().on('a[href]', new DocsLinkRewriter()).transform(response);
      }

      return response;
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
