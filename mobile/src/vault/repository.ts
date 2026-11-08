import { seal, unseal } from './crypto';
export type LocalIdentity = { name: string; dateOfBirth: string; address: string };
export type LocalDocument = { id: string; name: string; mime: string; size: number; addedAt: string };
export type VaultIndex = { version: 1; documents: LocalDocument[]; identity: LocalIdentity };
export interface VaultStorage {
  read(name: string): Promise<Uint8Array>;
  write(name: string, value: Uint8Array): Promise<void>;
  remove(name: string): Promise<void>;
  pointer(): Promise<'a' | 'b' | null>;
  commit(slot: 'a' | 'b'): Promise<void>;
  random(size: number): Uint8Array;
}
export const emptyVault = (): VaultIndex => ({ version: 1, documents: [], identity: { name: '', dateOfBirth: '', address: '' } });
export class LocalVault {
  private key: Uint8Array | null;
  private active = true;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(key: Uint8Array, private storage: VaultStorage) { this.key = Uint8Array.from(key); }
  lock() { this.active = false; this.key?.fill(0); this.key = null; }
  private getKey() { if (!this.active || !this.key) throw new Error('Unlock your Vault to continue.'); return this.key; }
  private async load(): Promise<VaultIndex> {
    this.getKey();
    const pointer = await this.storage.pointer();
    if (!pointer) return emptyVault();
    const bytes = unseal(this.getKey(), await this.storage.read(`index-${pointer}`), 'zik.native.vault.index.v1');
    try {
      const result = JSON.parse(new TextDecoder().decode(bytes)) as VaultIndex;
      if (result.version !== 1 || !Array.isArray(result.documents) || !result.identity) throw new Error('Unsupported Vault format.');
      return result;
    } finally { bytes.fill(0); }
  }
  private async save(index: VaultIndex) {
    const slot = await this.storage.pointer() === 'a' ? 'b' : 'a';
    const bytes = new TextEncoder().encode(JSON.stringify(index));
    try { await this.storage.write(`index-${slot}`, seal(this.getKey(), this.storage.random(12), bytes, 'zik.native.vault.index.v1')); }
    finally { bytes.fill(0); }
    this.getKey();
    // The old index remains valid if writing or switching the pointer fails.
    await this.storage.commit(slot);
  }
  private run<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => { this.getKey(); return work(); });
    this.queue = next.catch(() => undefined);
    return next;
  }
  read() { return this.run(() => this.load()); }
  updateIdentity(identity: LocalIdentity) {
    return this.run(async () => {
      const date = identity.dateOfBirth ? new Date(`${identity.dateOfBirth}T00:00:00.000Z`) : null;
      if (identity.name.length > 160 || identity.address.length > 1000 || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(identity.dateOfBirth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== identity.dateOfBirth || date.getTime() > Date.now()))) throw new Error('Check your details. Use a valid date of birth in YYYY-MM-DD format.');
      const index = await this.load();
      index.identity = { name: identity.name.trim(), dateOfBirth: identity.dateOfBirth, address: identity.address.trim() };
      await this.save(index); return index;
    });
  }
  import(name: string, mime: string, bytes: Uint8Array) {
    return this.run(async () => {
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/heic'].includes(mime)) throw new Error('Choose a PDF, JPEG, PNG or HEIC file.');
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('Choose a file up to 10 MB.');
      const index = await this.load();
      if (index.documents.length >= 100) throw new Error('This Vault can hold up to 100 documents.');
      const id = Array.from(this.storage.random(16), value => value.toString(16).padStart(2, '0')).join('');
      const document = { id, name: name.slice(0, 200), mime, size: bytes.length, addedAt: new Date().toISOString() };
      await this.storage.write(id, seal(this.getKey(), this.storage.random(12), bytes, `zik.native.document.${id}`));
      index.documents.push(document);
      try { await this.save(index); }
      catch (error) { await this.storage.remove(id).catch(() => undefined); throw error; }
      return index;
    });
  }
  document(id: string) {
    return this.run(async () => {
      const index = await this.load();
      const document = index.documents.find(item => item.id === id);
      if (!document) throw new Error('Document not found.');
      return { document, bytes: unseal(this.getKey(), await this.storage.read(id), `zik.native.document.${id}`) };
    });
  }
  remove(id: string) {
    return this.run(async () => {
      const index = await this.load();
      index.documents = index.documents.filter(item => item.id !== id);
      await this.save(index);
      await this.storage.remove(id); return index;
    });
  }
}
