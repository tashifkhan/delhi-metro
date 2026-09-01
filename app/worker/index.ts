/**
 * Cloudflare Worker that hosts the Expo web build.
 *
 * Static files are served straight from the `dist/` asset bundle — those
 * requests never reach this handler. What does reach it is everything the
 * bundle has no file for:
 *
 *   - `/api/*`, which is reverse-proxied to the FastAPI backend so the browser
 *     talks to a single origin. The API sends no CORS headers, so a direct
 *     cross-origin call from the page would be blocked.
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

function buildUpstreamRequest(request: Request, apiOrigin: string): Request {
  const url = new URL(request.url);
  const upstreamUrl = new URL(url.pathname + url.search, apiOrigin);

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

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      let upstream: Response;
      try {
        upstream = await fetch(buildUpstreamRequest(request, env.API_ORIGIN));
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
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: new Headers(upstream.headers),
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
