import { isManifest, needsDownload, type ExportManifest, type PackMeta } from './model';

export interface PackStore {
  readMeta(): Promise<PackMeta | null>;
  write(body: string, meta: PackMeta): Promise<void>;
}

export type SyncOutcome =
  | { kind: 'up-to-date'; meta: PackMeta; manifest: ExportManifest }
  | { kind: 'downloaded'; meta: PackMeta; manifest: ExportManifest }
  /** The server has no pack to offer (not deployed yet, or the build failed). */
  | { kind: 'unavailable' }
  | { kind: 'failed'; reason: string };

interface Deps {
  /** Origin with no trailing slash, e.g. https://ncr-metro.tashif.codes */
  apiBase: string;
  fetchFn: typeof fetch;
  store: PackStore;
  now: () => number;
}

/** Fetch the manifest alone, e.g. to show the download size before asking. */
export async function fetchManifest(apiBase: string, fetchFn: typeof fetch): Promise<ExportManifest | null> {
  try {
    const response = await fetchFn(`${apiBase}/api/v1/export/manifest`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isManifest(body) ? body : null;
  } catch {
    return null;
  }
}

/**
 * Bring the phone's pack up to date: read the manifest, and download the
 * pack only if the version differs from what is held. A failed download
 * never touches the pack already stored.
 */
export async function syncPack({ apiBase, fetchFn, store, now }: Deps): Promise<SyncOutcome> {
  let manifestResponse: Response;
  try {
    manifestResponse = await fetchFn(`${apiBase}/api/v1/export/manifest`, { headers: { Accept: 'application/json' } });
  } catch (error) {
    return { kind: 'failed', reason: error instanceof Error ? error.message : 'No connection' };
  }
  if (manifestResponse.status === 404) return { kind: 'unavailable' };
  if (!manifestResponse.ok) return { kind: 'failed', reason: `Server answered ${manifestResponse.status}` };

  let manifest: unknown;
  try {
    manifest = await manifestResponse.json();
  } catch {
    return { kind: 'failed', reason: 'The manifest was not readable' };
  }
  if (!isManifest(manifest)) return { kind: 'failed', reason: 'The manifest was not readable' };

  const held = await store.readMeta();
  if (held && !needsDownload(manifest, held)) return { kind: 'up-to-date', meta: held, manifest };

  let body: string;
  try {
    const response = await fetchFn(`${apiBase}/api/v1/export`, {
      headers: { Accept: 'application/json', ...(held ? { 'If-None-Match': `"${held.sha256}"` } : {}) },
    });
    if (response.status === 304 && held) return { kind: 'up-to-date', meta: held, manifest };
    if (response.status === 404) return { kind: 'unavailable' };
    if (!response.ok) return { kind: 'failed', reason: `Server answered ${response.status}` };
    body = await response.text();
  } catch (error) {
    return { kind: 'failed', reason: error instanceof Error ? error.message : 'Download interrupted' };
  }

  // A truncated download is the likely failure; it won't parse.
  try {
    const parsed = JSON.parse(body) as { version?: unknown };
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
  } catch {
    return { kind: 'failed', reason: 'The download was incomplete' };
  }

  const meta: PackMeta = {
    version: manifest.version,
    sha256: manifest.sha256,
    generatedAt: manifest.generated_at,
    sizeBytes: body.length,
    savedAt: now(),
  };
  await store.write(body, meta);
  return { kind: 'downloaded', meta, manifest };
}
