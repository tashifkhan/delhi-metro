/**
 * The offline pack: one file from `GET /api/v1/export` holding everything the
 * app can show without a connection (lines, stations and their details,
 * first and last trains, notices, maps, a routing graph). A small manifest at
 * `GET /api/v1/export/manifest` says which version is current, so a phone
 * only downloads the pack when it changed.
 *
 * Pure functions here; storage, fetching and React live next door.
 */

export interface ExportManifest {
  version: string;
  generated_at: string;
  sha256: string;
  size_bytes: number;
  sections: Record<string, { count?: number; sha256?: string }>;
  router_agreement?: number | null;
}

/** What the phone remembers about the pack it holds. */
export interface PackMeta {
  version: string;
  sha256: string;
  generatedAt: string;
  sizeBytes: number;
  savedAt: number;
}

export function isManifest(value: unknown): value is ExportManifest {
  const m = value as ExportManifest;
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof m.version === 'string' &&
    m.version.length > 0 &&
    typeof m.sha256 === 'string' &&
    typeof m.size_bytes === 'number' &&
    typeof m.generated_at === 'string'
  );
}

export function isPackMeta(value: unknown): value is PackMeta {
  const m = value as PackMeta;
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof m.version === 'string' &&
    typeof m.sha256 === 'string' &&
    typeof m.savedAt === 'number' &&
    typeof m.sizeBytes === 'number'
  );
}

/** Download when there is no pack yet or the server has a different one. */
export function needsDownload(manifest: ExportManifest, held: PackMeta | null): boolean {
  if (!held) return true;
  return held.version !== manifest.version || held.sha256 !== manifest.sha256;
}

export type Connection = 'none' | 'wifi' | 'cellular' | 'other' | 'unknown';

export interface AutoSyncPolicy {
  autoSync: boolean;
  wifiOnly: boolean;
}

/**
 * Whether a background sync may run on this connection. Manual "Sync now"
 * ignores both switches; auto-sync respects them, and never runs offline.
 * An unknown connection type counts as allowed unless Wi-Fi only is on.
 */
export function mayAutoSync(policy: AutoSyncPolicy, connection: Connection): boolean {
  if (!policy.autoSync || connection === 'none') return false;
  if (policy.wifiOnly) return connection === 'wifi';
  return true;
}

/** Don't check the manifest more often than this from the background. */
export const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function dueForCheck(lastCheckedAt: number | null, now: number): boolean {
  return lastCheckedAt === null || now - lastCheckedAt >= AUTO_SYNC_INTERVAL_MS;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
