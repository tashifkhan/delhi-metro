import { isPackMeta, type PackMeta } from './model';

const DB = 'ncr-offline';
const STORE = 'pack';

/**
 * The web keeps the pack in IndexedDB: it is several megabytes, more than
 * localStorage reliably allows. Every call fails soft, because a browser can
 * refuse storage (private windows, blocked site data).
 */
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

export const packStore = {
  async readMeta(): Promise<PackMeta | null> {
    try {
      const value = await run<unknown>('readonly', (s) => s.get('meta'));
      return isPackMeta(value) ? value : null;
    } catch {
      return null;
    }
  },

  async readBody(): Promise<string | null> {
    try {
      const value = await run<unknown>('readonly', (s) => s.get('body'));
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  },

  async write(body: string, meta: PackMeta): Promise<void> {
    await run('readwrite', (s) => {
      s.put(body, 'body');
      s.put(meta, 'meta');
    });
  },

  async clear(): Promise<void> {
    await run('readwrite', (s) => s.clear()).catch(() => undefined);
  },
};
