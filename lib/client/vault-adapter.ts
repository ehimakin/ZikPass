import { decryptVault, encryptVault, parseVaultEnvelope, type VaultProfileV1, type VaultEnvelopeV1 } from '@/lib/shared/vault';

export interface VaultStorage { read(): Promise<unknown>; write(value: VaultEnvelopeV1): Promise<void>; remove(): Promise<void> }
async function operation(mode: IDBTransactionMode, action: 'read' | 'write' | 'delete', value?: VaultEnvelopeV1): Promise<unknown> {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle) throw new Error('vault_unavailable');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('zik-local-vault', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('encrypted'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('vault_unavailable'));
    request.onblocked = () => reject(new Error('vault_unavailable'));
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction('encrypted', mode);
    const store = tx.objectStore('encrypted');
    const request = action === 'read' ? store.get('profile') : action === 'write' ? store.put(parseVaultEnvelope(value), 'profile') : store.delete('profile');
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('vault_storage_failed')); };
  });
}
export const indexedVaultStorage: VaultStorage = {
  read: () => operation('readonly', 'read'),
  write: async v => { await operation('readwrite', 'write', v); },
  remove: async () => { await operation('readwrite', 'delete'); }
};
/** Never stores a passphrase. Edits require it again. Epoch prevents an async unlock resurrecting a locked/deleted session. */
export class VaultSession {
  private profile: VaultProfileV1 | undefined;
  private epoch = 0;
  constructor(private storage: VaultStorage = indexedVaultStorage) {}
  async exists() { return (await this.storage.read()) !== undefined; }
  read() { if (!this.profile) throw new Error('vault_locked'); return structuredClone(this.profile); }
  lock() { this.epoch++; this.profile = undefined; }
  async unlock(secret: string) {
    const epoch = this.epoch;
    const profile = await decryptVault(await this.storage.read(), secret);
    if (epoch !== this.epoch) throw new Error('vault_locked');
    this.profile = profile;
  }
  async save(profile: VaultProfileV1, secret: string) {
    const epoch = this.epoch;
    const existing = await this.storage.read();
    if (existing !== undefined) await decryptVault(existing, secret);
    const envelope = await encryptVault(profile, secret);
    if (epoch !== this.epoch) throw new Error('vault_locked');
    await this.storage.write(envelope);
    if (epoch !== this.epoch) throw new Error("vault_locked");
    this.profile = structuredClone(profile);
  }
  async delete() { this.lock(); await this.storage.remove(); }
}
