import { openJson, sealJson, seal, open, type SealedCell } from '@/lib/shared/vault/crypto';

/**
 * Encrypted device storage for Vault v2.
 *
 * Document bytes live in their own object store as binary, not as base64 inside a
 * JSON envelope: structured clone keeps a 12 MB scan at 12 MB instead of 16 MB of
 * string, and a single record can be written without rewriting the whole Vault.
 *
 * Only technical indexing metadata sits outside the ciphertext: record ids,
 * `document_id` on observations, and byte lengths. Filenames, extracted text,
 * dates of birth, addresses and thumbnails are all inside the sealed payload.
 */
export const VAULT_DB = 'zik-vault';
export const VAULT_DB_VERSION = 1;

export type RecordStore = 'meta' | 'profile' | 'documents' | 'observations' | 'claims' | 'consents' | 'applications' | 'blobs' | 'thumbnails';
const RECORD_STORES: RecordStore[] = ['meta', 'profile', 'documents', 'observations', 'claims', 'consents', 'applications', 'blobs', 'thumbnails'];

export type StoredCell = { id: string; iv: string; ciphertext: Uint8Array; document_id?: string; byte_length?: number };

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(new Error('vault_storage_failed'));
  });
}

export async function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) throw new Error('vault_unavailable');
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(VAULT_DB, VAULT_DB_VERSION);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      for (const name of RECORD_STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: 'id' });
        if (name === 'observations') store.createIndex('document_id', 'document_id', { unique: false });
        if (name === 'blobs' || name === 'thumbnails') store.createIndex('document_id', 'document_id', { unique: false });
      }
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(new Error('vault_unavailable'));
    opening.onblocked = () => reject(new Error('vault_unavailable'));
  });
}

/**
 * One transaction per call, so a failed write never leaves half a document behind.
 *
 * `work` may only issue IndexedDB requests. Awaiting anything else — Web Crypto in
 * particular — lets the transaction auto-commit before the remaining writes are
 * issued, so every seal and unseal happens outside these callbacks.
 */
export async function transact<T>(stores: RecordStore[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let outcome: T;
      let failed = false;
      tx.oncomplete = () => { if (!failed) resolve(outcome); };
      tx.onabort = tx.onerror = () => { failed = true; reject(new Error(tx.error?.name === 'QuotaExceededError' ? 'vault_storage_full' : 'vault_storage_failed')); };
      Promise.resolve(work(tx)).then(value => { outcome = value; }).catch(error => {
        failed = true;
        try { tx.abort(); } catch { /* already settled */ }
        reject(error instanceof Error ? error : new Error('vault_storage_failed'));
      });
    });
  } finally { db.close(); }
}

export async function putRecord(tx: IDBTransaction, store: RecordStore, cell: StoredCell): Promise<void> {
  await request(tx.objectStore(store).put(cell));
}

export async function getRecord(tx: IDBTransaction, store: RecordStore, id: string): Promise<StoredCell | undefined> {
  return request(tx.objectStore(store).get(id) as IDBRequest<StoredCell | undefined>);
}

export async function allRecords(tx: IDBTransaction, store: RecordStore): Promise<StoredCell[]> {
  return request(tx.objectStore(store).getAll() as IDBRequest<StoredCell[]>);
}

export async function recordsFor(tx: IDBTransaction, store: RecordStore, documentId: string): Promise<StoredCell[]> {
  return request(tx.objectStore(store).index('document_id').getAll(documentId) as IDBRequest<StoredCell[]>);
}

export async function deleteRecord(tx: IDBTransaction, store: RecordStore, id: string): Promise<void> {
  await request(tx.objectStore(store).delete(id));
}


export type WriteOperation =
  | { store: RecordStore; action: 'put'; cell: StoredCell }
  | { store: RecordStore; action: 'delete'; id: string };

/** Applies a prepared set of writes atomically. Everything is already sealed by here. */
export async function commit(operations: WriteOperation[]): Promise<void> {
  if (!operations.length) return;
  const stores = [...new Set(operations.map(operation => operation.store))];
  await transact(stores, 'readwrite', async tx => {
    for (const operation of operations) {
      if (operation.action === 'put') await putRecord(tx, operation.store, operation.cell);
      else await deleteRecord(tx, operation.store, operation.id);
    }
  });
}

export async function sealRecord(key: CryptoKey, store: RecordStore, id: string, value: unknown, extra: Partial<StoredCell> = {}): Promise<StoredCell> {
  const cell: SealedCell = await sealJson(key, store, id, value);
  return { id, iv: cell.iv, ciphertext: cell.ciphertext, ...extra };
}

export async function openRecord(key: CryptoKey, store: RecordStore, cell: StoredCell): Promise<unknown> {
  return openJson(key, store, cell.id, cell);
}

export async function sealBytes(key: CryptoKey, store: RecordStore, id: string, bytes: Uint8Array, extra: Partial<StoredCell> = {}): Promise<StoredCell> {
  const cell = await seal(key, store, id, bytes);
  return { id, iv: cell.iv, ciphertext: cell.ciphertext, byte_length: bytes.byteLength, ...extra };
}

export async function openBytes(key: CryptoKey, store: RecordStore, cell: StoredCell): Promise<Uint8Array> {
  return open(key, store, cell.id, cell);
}

/** Used by demo reset and by "delete my Vault". Removes the database itself. */
export async function destroyDatabase(): Promise<void> {
  if (!globalThis.indexedDB) return;
  await new Promise<void>((resolve, reject) => {
    const deleting = indexedDB.deleteDatabase(VAULT_DB);
    deleting.onsuccess = () => resolve();
    deleting.onerror = () => reject(new Error('vault_storage_failed'));
    // A still-open connection in another tab blocks the delete; the caller retries.
    deleting.onblocked = () => reject(new Error('vault_storage_blocked'));
  });
}

/**
 * Whether an application record exists, without opening it. The Wallet needs to
 * show that an application is in progress while the Vault is locked, and this
 * reveals only that a record is present — never a name, a document or a value.
 */
export async function hasApplicationRecord(): Promise<boolean> {
  try {
    return await transact(['applications'], 'readonly', async tx => {
      const keys = await request(tx.objectStore('applications').getAllKeys() as IDBRequest<IDBValidKey[]>);
      return keys.some(key => key === 'application');
    });
  } catch { return false; }
}

export type StorageEstimate = { usage: number | null; quota: number | null; persisted: boolean };

/**
 * Browser-local storage is not a backup: the browser may evict it, and a declined
 * persistence request is normal rather than an error.
 */
export async function storageStatus(): Promise<StorageEstimate> {
  const manager = globalThis.navigator?.storage;
  if (!manager?.estimate) return { usage: null, quota: null, persisted: false };
  const estimate = await manager.estimate();
  const persisted = manager.persisted ? await manager.persisted() : false;
  return { usage: estimate.usage ?? null, quota: estimate.quota ?? null, persisted };
}

export async function requestPersistence(): Promise<boolean> {
  const manager = globalThis.navigator?.storage;
  if (!manager?.persist) return false;
  try { return await manager.persist(); } catch { return false; }
}
