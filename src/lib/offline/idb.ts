/**
 * A tiny key-value store on IndexedDB (the browser's database), for offline data: the saved data cache and the queue
 * of changes made while offline. Every call fails soft (returns undefined / does nothing) where IndexedDB is not
 * available, e.g. a private window, so the app keeps working online.
 */
const DB_NAME = "tirvex-offline";
const STORE = "kv";

let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const request = work(db.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export const offlineDb = {
  get: <T>(key: string) => run<T>("readonly", (s) => s.get(key) as IDBRequest<T>),
  set: (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key)).then(() => undefined),
  remove: (key: string) => run("readwrite", (s) => s.delete(key)).then(() => undefined),
};
