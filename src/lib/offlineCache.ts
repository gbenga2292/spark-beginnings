import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'dcel-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/** Persist a keyed dataset to IndexedDB with timestamp metadata. */
export async function cacheSet(key: string, data: any): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, { data, lastUpdated: new Date().toISOString() }, key);
  } catch (err) {
    console.warn('[OfflineCache] Failed to write cache for', key, err);
  }
}

/** Retrieve a keyed dataset from IndexedDB. Returns null if missing. */
export async function cacheGet<T = any>(key: string): Promise<{ data: T; lastUpdated: string } | null> {
  try {
    const db = await getDb();
    const entry = await db.get(STORE_NAME, key);
    return entry ?? null;
  } catch (err) {
    console.warn('[OfflineCache] Failed to read cache for', key, err);
    return null;
  }
}

/** Get the last-updated timestamp for a given cache key. */
export async function cacheTimestamp(key: string): Promise<string | null> {
  const entry = await cacheGet(key);
  return entry?.lastUpdated ?? null;
}

/** Clear all cached data. */
export async function cacheClear(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
  } catch (err) {
    console.warn('[OfflineCache] Failed to clear cache', err);
  }
}
