/**
 * Station positions read off an operator's official map image.
 *
 * `GET /api/v1/{network}/maps/layout` returns where each station sits on the
 * published map, as fractions of the image's width and height. The backend
 * hashes the official image on request and only asks Gemini to read it again
 * when the hash changes, which can take about a minute. Asked for
 * `text/event-stream`, it reports that progress as Server-Sent Events so the
 * app can tell people to wait instead of showing a frozen map.
 *
 * Streaming uses `expo/fetch`, which exposes a readable body on native as well
 * as on the web. Anything that goes wrong with the stream falls back to the
 * plain JSON request, which waits for the same result without progress.
 */

import { fetch as expoFetch } from 'expo/fetch';
import { env } from '../config/env';
import { ApiError } from '../api/errors';
import { offlineStore } from '../storage/offlineStore';
import type { MetroNetwork } from '../types';
import { SseParser, type SseEvent } from './mapLayoutSse';

export { SseParser, type SseEvent } from './mapLayoutSse';

export type MapLayoutStatus = 'ready' | 'disabled' | 'unavailable';

export interface MapLayoutStation {
  code: string;
  name: string;
  /** Fraction of the image width, 0 at the left edge. */
  x: number;
  /** Fraction of the image height, 0 at the top edge. */
  y: number;
}

export interface MapLayout {
  network: MetroNetwork;
  status: MapLayoutStatus;
  detail: string | null;
  image: { url: string; sha256: string; width: number; height: number } | null;
  model: string | null;
  extracted_at: string | null;
  coverage: { expected: number; found: number };
  stations: MapLayoutStation[];
}

export type LayoutStage = 'checking' | 'unchanged' | 'extracting' | 'progress' | 'saved';

export interface LayoutStatusEvent {
  stage: LayoutStage;
  message: string;
  done: number | null;
  total: number | null;
}

export interface LayoutStreamHandlers {
  onStatus?: (event: LayoutStatusEvent) => void;
}

function layoutUrl(network: MetroNetwork, stream: boolean): string {
  const base = `${env.apiBaseUrl}/api/v1/${network}/maps/layout`;
  return stream ? `${base}?stream=true` : base;
}

async function errorFrom(response: { status: number; json: () => Promise<unknown> }): Promise<ApiError> {
  let detail: string | undefined;
  try {
    detail = ((await response.json()) as { detail?: string }).detail;
  } catch {
    detail = undefined;
  }
  return new ApiError(detail ?? `Request failed with status ${response.status}`, response.status, detail);
}

/** Plain JSON request. Waits for any re-read to finish, without progress. */
export async function fetchMapLayout(network: MetroNetwork, signal?: AbortSignal): Promise<MapLayout> {
  const response = await fetch(layoutUrl(network, false), {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as MapLayout;
}

/** Raised when the stream itself can't be used, so the caller tries JSON. */
class StreamUnavailable extends Error {}

/**
 * Stream the layout, reporting progress through `handlers.onStatus`.
 * Resolves with the final layout; an `error` event rejects with its detail.
 */
export async function streamMapLayout(
  network: MetroNetwork,
  handlers: LayoutStreamHandlers = {},
  signal?: AbortSignal,
): Promise<MapLayout> {
  if (typeof TextDecoder === 'undefined') throw new StreamUnavailable('No TextDecoder');

  const response = await expoFetch(layoutUrl(network, true), {
    headers: { Accept: 'text/event-stream' },
    signal,
  });
  if (!response.ok) throw await errorFrom(response);
  const type = response.headers.get('content-type') ?? '';
  // A proxy or older API answering with JSON is still a usable answer.
  if (type.includes('application/json')) return (await response.json()) as MapLayout;
  if (!response.body) throw new StreamUnavailable('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  let layout: MapLayout | null = null;

  const handle = (events: SseEvent[]) => {
    for (const { event, data } of events) {
      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === 'status') handlers.onStatus?.(payload as LayoutStatusEvent);
      else if (event === 'layout') layout = payload as MapLayout;
      else if (event === 'error') {
        const detail = (payload as { detail?: string }).detail ?? 'The map layout could not be read.';
        throw new ApiError(detail, 502, detail);
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      handle(parser.push(decoder.decode(value, { stream: true })));
    }
    handle(parser.push(decoder.decode()));
    handle(parser.end());
  } finally {
    reader.releaseLock?.();
  }

  if (!layout) throw new StreamUnavailable('Stream ended without a layout');
  return layout;
}

/**
 * Stream with a JSON fallback. API errors (an `error` event or a 4xx/5xx) are
 * real answers and are not retried; only a stream that can't be read is.
 */
export async function loadMapLayout(
  network: MetroNetwork,
  handlers: LayoutStreamHandlers = {},
  signal?: AbortSignal,
): Promise<MapLayout> {
  try {
    return await streamMapLayout(network, handlers, signal);
  } catch (error) {
    if (error instanceof ApiError || signal?.aborted) throw error;
    return fetchMapLayout(network, signal);
  }
}

// --- Last good layout, kept on device ---------------------------------------

const cacheKey = (network: MetroNetwork) => `map-layout:${network}`;

export async function readCachedLayout(
  network: MetroNetwork,
): Promise<{ layout: MapLayout; savedAt: number } | null> {
  try {
    const doc = await offlineStore.get<MapLayout>(cacheKey(network));
    return doc ? { layout: doc.payload, savedAt: doc.savedAt } : null;
  } catch {
    return null;
  }
}

/** Only usable layouts are kept, so a failed re-read never replaces a good one. */
export async function writeCachedLayout(layout: MapLayout): Promise<void> {
  if (layout.status !== 'ready' || layout.stations.length === 0) return;
  try {
    await offlineStore.put(cacheKey(layout.network), layout);
  } catch {
    // The layout is an enhancement; losing the cache only costs a refetch.
  }
}
