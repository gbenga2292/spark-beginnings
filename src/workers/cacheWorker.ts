/**
 * Web Worker for offloading IndexedDB serialization off the main thread.
 * Receives { key, data } messages and writes to IndexedDB.
 */

import { openDB } from 'idb';

const DB_NAME = 'dcel-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';

let dbPromise: ReturnType<typeof openDB> | null = null;

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

self.onmessage = async (e: MessageEvent<{ key: string; data: any }>) => {
  const { key, data } = e.data;
  try {
    const db = await getDb();
    await db.put(STORE_NAME, { data, lastUpdated: new Date().toISOString() }, key);
    self.postMessage({ ok: true, key });
  } catch (err) {
    self.postMessage({ ok: false, key, error: String(err) });
  }
};
