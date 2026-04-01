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

// ── Web Worker for off-thread writes ─────────────────────────────────────────
let cacheWorker: Worker | null = null;

function getWorker(): Worker | null {
  if (cacheWorker) return cacheWorker;
  try {
    cacheWorker = new Worker(
      new URL('../workers/cacheWorker.ts', import.meta.url),
      { type: 'module' }
    );
    return cacheWorker;
  } catch {
    // Workers may not be available (e.g. in tests or some Electron builds)
    return null;
  }
}

/** Persist a keyed dataset to IndexedDB with timestamp metadata.
 *  Uses a Web Worker when available to avoid blocking the main thread. */
export async function cacheSet(key: string, data: any): Promise<void> {
  try {
    const worker = getWorker();
    if (worker) {
      // Fire-and-forget to the worker — serialization happens off-thread
      worker.postMessage({ key, data });
      return;
    }
    // Fallback: write on main thread
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
