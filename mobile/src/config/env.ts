/**
 * Runtime configuration.
 *
 * The default points at the deployed production API origin (no version
 * suffix). Routes include their own `/api/v1` or `/api/v2` prefix.
 *
 * A localhost default is not reachable from a physical device or a release
 * build — it only ever worked on a simulator sharing the dev machine's
 * loopback.
 *
 * Set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` to point at a local backend
 * instead; see `.env.example`.
 */

const DEFAULT_API_BASE_URL = 'https://dmrc-rest-api.vercel.app';

/**
 * Normalize a configured base so path joining never doubles a trailing slash
 * or an accidental `/api/v1` leftover from older env files.
 */
function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  // Older configs appended `/api/v1`; strip that so v1 and v2 can both be used.
  return trimmed.replace(/\/api\/v\d+$/i, '');
}

export const env = {
  apiBaseUrl: normalizeApiBaseUrl(
    process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  ),
} as const;
