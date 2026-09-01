import type * as SQLite from 'expo-sqlite';

/**
 * The web build persists through `localStorage` (see the `.web.ts` repository
 * variants) rather than SQLite — the caches this app keeps are a handful of
 * JSON blobs, which does not justify shipping a WASM SQLite engine and the
 * cross-origin isolation headers its OPFS backend needs.
 *
 * Nothing on web should reach for a database handle; if something does, fail
 * loudly here rather than silently diverging from the native behaviour.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  throw new Error('SQLite is not available on web; use the localStorage-backed repositories.');
}
