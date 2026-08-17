/**
 * Tiny IndexedDB wrapper for the demo's local persistence.
 *
 * Two stores:
 *  - `state`  : the whole SocietyData object, minus photo image data
 *  - `photos` : one record per uploaded image, keyed by photo id
 *
 * Images live separately so that saving a donation doesn't rewrite megabytes of
 * photo data, and so the gallery isn't capped by localStorage's ~5 MB limit.
 *
 * When this moves to Supabase, `state` becomes Postgres tables and `photos`
 * becomes a Storage bucket — the split is already the right shape.
 */

const DB_NAME = "society-app";
const DB_VERSION = 1;
const STATE_STORE = "state";
const PHOTO_STORE = "photos";
const STATE_KEY = "society-data";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function readState<T>(): Promise<T | null> {
  try {
    return (await tx<T>(STATE_STORE, "readonly", (s) => s.get(STATE_KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function writeState(value: unknown): Promise<void> {
  try {
    await tx(STATE_STORE, "readwrite", (s) => s.put(value, STATE_KEY));
  } catch {
    // Private-browsing or a storage-denied context: the app still works for
    // this session, it just won't remember anything after a reload.
  }
}

export async function putPhotoFile(id: string, dataUrl: string): Promise<void> {
  try {
    await tx(PHOTO_STORE, "readwrite", (s) => s.put(dataUrl, id));
  } catch {
    /* see writeState */
  }
}

export async function deletePhotoFile(id: string): Promise<void> {
  try {
    await tx(PHOTO_STORE, "readwrite", (s) => s.delete(id));
  } catch {
    /* see writeState */
  }
}

/** All uploaded images as `id → dataUrl`, for rehydrating on load. */
export async function readAllPhotoFiles(): Promise<Record<string, string>> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const t = db.transaction(PHOTO_STORE, "readonly");
      const store = t.objectStore(PHOTO_STORE);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      t.oncomplete = () => {
        const out: Record<string, string> = {};
        (keysReq.result as IDBValidKey[]).forEach((k, i) => {
          out[String(k)] = valsReq.result[i] as string;
        });
        resolve(out);
      };
      t.onerror = () => reject(t.error);
    });
  } catch {
    return {};
  }
}

export async function clearAll(): Promise<void> {
  try {
    await tx(STATE_STORE, "readwrite", (s) => s.clear());
    await tx(PHOTO_STORE, "readwrite", (s) => s.clear());
  } catch {
    /* see writeState */
  }
}
