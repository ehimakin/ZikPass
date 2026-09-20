import type { ExportedKeyPair } from '@/lib/shared/crypto/ed25519';
export type RecoveryStatus = { recoveryId: string; savedAt: string; revision: number; hasVault: boolean; hasPass: boolean };
export type PendingRestore = { recoveryId: string; operationId: string; holder: ExportedKeyPair };

async function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('zik-account-recovery', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('state'); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not open recovery storage.'));
  });
}
export async function readRecoveryLocal<T>(id: 'status' | 'pending'): Promise<T | undefined> {
  const database = await db();
  try {
    return await new Promise((resolve, reject) => {
      const r = database.transaction('state').objectStore('state').get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(new Error('Could not read recovery storage.'));
    });
  } finally { database.close(); }
}
export async function writeRecoveryLocal(id: 'status' | 'pending', value?: RecoveryStatus | PendingRestore): Promise<void> {
  const database = await db();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('state', 'readwrite');
      if (value) tx.objectStore('state').put(value, id); else tx.objectStore('state').delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error('Could not save recovery storage.'));
    });
  } finally { database.close(); }
}
