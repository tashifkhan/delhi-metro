/**
 * Runtime configuration.
 *
 * The default points at the deployed test API. A localhost default is not
 * reachable from a physical device or a release build — it only ever worked on
 * a simulator sharing the dev machine's loopback.
 *
 * Set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` to point at a local backend
 * instead; see `.env.example`.
 */

const DEFAULT_API_BASE_URL = 'https://dmrc-rest-api.vercel.app/api/v1';

export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
} as const;
