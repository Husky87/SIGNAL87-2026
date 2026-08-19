/**
 * Local storage for the bytes of PDFs whose pages have been inserted or merged
 * into a document being edited.
 *
 * These bytes deliberately never leave the device. A pending edit is described
 * by a JSON overlay in Firestore, but an inserted page needs the actual source
 * file to be exportable, and that file is neither small enough for a Firestore
 * document nor something this feature is willing to upload anywhere. IndexedDB
 * is the only client-side store that survives a reload, so it is where they go.
 *
 * The consequence is deliberate and surfaced in the UI: a pending insert or
 * merge is device-local. Opening the same document on another machine finds
 * the page plan without the pages, and the editor says so by name rather than
 * exporting a document that is quietly missing pages.
 */

const DB_NAME = 'signal87-pdf-sources';
const DB_VERSION = 1;
const STORE = 'sources';

interface StoredSource {
  /** `${docId}::${sourceId}` — the primary key. */
  key: string;
  docId: string;
  sourceId: string;
  fileName: string;
  bytes: ArrayBuffer;
  addedAt: string;
}

function keyFor(docId: string, sourceId: string): string {
  return `${docId}::${sourceId}`;
}

/**
 * IndexedDB is absent or blocked in private windows and some embedded
 * webviews. Every entry point below degrades to "no sources available" rather
 * than throwing, so the rest of the editor — which is the part that works on
 * the document's own pages — keeps functioning there.
 */
function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('docId', 'docId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDatabase().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let request: IDBRequest<T>;
        try {
          request = work(db.transaction(STORE, mode).objectStore(STORE));
        } catch {
          db.close();
          resolve(null);
          return;
        }
        request.onsuccess = () => {
          resolve(request.result);
          db.close();
        };
        request.onerror = () => {
          resolve(null);
          db.close();
        };
      })
  );
}

/** Stores one source file's bytes. Returns false when the store is unavailable. */
export async function putSourceBytes(
  docId: string,
  sourceId: string,
  fileName: string,
  bytes: ArrayBuffer
): Promise<boolean> {
  const record: StoredSource = {
    key: keyFor(docId, sourceId),
    docId,
    sourceId,
    fileName,
    bytes,
    addedAt: new Date().toISOString()
  };
  const result = await runTransaction<IDBValidKey>('readwrite', (store) => store.put(record));
  return result !== null;
}

/** The stored bytes, or null when this device does not have them. */
export async function getSourceBytes(docId: string, sourceId: string): Promise<ArrayBuffer | null> {
  const record = await runTransaction<StoredSource | undefined>('readonly', (store) =>
    store.get(keyFor(docId, sourceId))
  );
  return record?.bytes ?? null;
}

/** Source ids this device holds bytes for, for the given document. */
export async function listAvailableSourceIds(docId: string): Promise<string[]> {
  const db = await openDatabase();
  if (!db) return [];
  return new Promise<string[]>((resolve) => {
    let request: IDBRequest<IDBValidKey[]>;
    try {
      request = db.transaction(STORE, 'readonly').objectStore(STORE).index('docId').getAllKeys(docId);
    } catch {
      db.close();
      resolve([]);
      return;
    }
    request.onsuccess = () => {
      const prefix = `${docId}::`;
      resolve(
        request.result
          .filter((key): key is string => typeof key === 'string' && key.startsWith(prefix))
          .map((key) => key.slice(prefix.length))
      );
      db.close();
    };
    request.onerror = () => {
      resolve([]);
      db.close();
    };
  });
}

/** Loads every source this device holds for a document, keyed by source id. */
export async function loadSourceBytesMap(docId: string, sourceIds: string[]): Promise<Map<string, Uint8Array>> {
  const entries = await Promise.all(
    sourceIds.map(async (sourceId) => {
      const bytes = await getSourceBytes(docId, sourceId);
      return bytes ? ([sourceId, new Uint8Array(bytes)] as const) : null;
    })
  );
  const map = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry) map.set(entry[0], entry[1]);
  }
  return map;
}

export async function deleteSourceBytes(docId: string, sourceId: string): Promise<void> {
  await runTransaction<undefined>('readwrite', (store) => store.delete(keyFor(docId, sourceId)));
}
