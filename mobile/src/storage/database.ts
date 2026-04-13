import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'dmrc-mobile.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS popular_routes (
      route_key TEXT PRIMARY KEY NOT NULL,
      from_station_code TEXT NOT NULL,
      to_station_code TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 1,
      last_fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS station_search_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL,
      last_updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDb();
  }
  return dbPromise;
}
