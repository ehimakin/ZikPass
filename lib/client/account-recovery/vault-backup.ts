import { VaultV2 } from '@/lib/client/vault/session';
import { allRecords, getRecord, transact, type RecordStore, type StoredCell } from '@/lib/client/vault/store';
import { open, openKeyEnvelope, rewrapKeyEnvelope } from '@/lib/shared/vault/crypto';
import { base64UrlToBytes, bytesToBase64Url } from '@/lib/shared/utils';

const stores: RecordStore[] = ['meta', 'profile', 'documents', 'observations', 'claims', 'consents', 'applications', 'blobs', 'thumbnails'];
type WireCell = Omit<StoredCell, 'ciphertext'> & { ciphertext: string };
export type VaultSnapshot = { version: 2; envelope: unknown; records: Record<string, WireCell[]> };
export type PreparedVault = { envelope: unknown; records: Record<string, StoredCell[]> };

export async function exportVaultSnapshot(passphrase: string, recoveryPhrase: string): Promise<VaultSnapshot | undefined> {
  const status = await VaultV2.status();
  if (status === 'none') return undefined;
  if (!passphrase) throw new Error('Enter your Vault passphrase to include your documents in the backup.');
  const vault = new VaultV2();
  try { await vault.unlock(passphrase); } catch { throw new Error('Could not unlock your Vault. Check its passphrase.'); } finally { vault.lock(); }
  // Read all stores in one snapshot so concurrent document writes cannot split it.
  const snapshot = await transact(stores, 'readonly', async tx => {
    const meta = await getRecord(tx, 'meta', 'key') as unknown as { envelope: unknown };
    const records: Record<string, WireCell[]> = {};
    for (const name of stores.filter(name => name !== 'meta')) {
      records[name] = (await allRecords(tx, name)).map(cell => ({ ...cell, ciphertext: bytesToBase64Url(cell.ciphertext) }));
    }
    return { envelope: meta.envelope, records };
  });
  return { version: 2, envelope: await rewrapKeyEnvelope(snapshot.envelope, passphrase, recoveryPhrase), records: snapshot.records };
}

export async function prepareVaultRestore(value: VaultSnapshot, phrase: string, newPassphrase: string): Promise<PreparedVault> {
  if (newPassphrase.length < 12) throw new Error('Choose a new Vault passphrase of at least 12 characters.');
  if (value?.version !== 2 || !value.records || Object.keys(value.records).some(name => !stores.includes(name as RecordStore) || name === 'meta')) throw new Error('Invalid Vault backup.');
  const key = await openKeyEnvelope(value.envelope, phrase);
  const records: Record<string, StoredCell[]> = {};
  for (const name of stores.filter(name => name !== 'meta')) {
    if (!Array.isArray(value.records[name])) throw new Error('Incomplete Vault backup.');
    const ids = new Set<string>();
    records[name] = [];
    for (const cell of value.records[name]) {
      if (typeof cell.id !== 'string' || ids.has(cell.id) || typeof cell.ciphertext !== 'string') throw new Error('Invalid Vault record.');
      ids.add(cell.id);
      const decoded = { ...cell, ciphertext: base64UrlToBytes(cell.ciphertext) };
      const bytes = await open(key, name, cell.id, decoded); // Authenticate every blob before revoking any device.
      bytes.fill(0);
      records[name].push(decoded);
    }
  }
  if (!records.profile.some(cell => cell.id === 'profile')) throw new Error('Vault profile missing from backup.');
  return { envelope: await rewrapKeyEnvelope(value.envelope, phrase, newPassphrase), records };
}

export async function importVaultSnapshot(value: PreparedVault, operationId: string): Promise<void> {
  // Existing device data is never replaced. All records commit or none do.
  await transact(stores, 'readwrite', async tx => {
    const existing = await getRecord(tx, 'meta', 'key') as unknown as { backup_restore_id?: string } | undefined;
    if (existing?.backup_restore_id === operationId) return;
    if (existing) throw new Error('This browser already has a Vault. Use a fresh browser profile to recover.');
    tx.objectStore('meta').put({ id: 'key', envelope: value.envelope, schema_version: 2, backup_restore_id: operationId });
    for (const [name, cells] of Object.entries(value.records)) for (const cell of cells) tx.objectStore(name).put(cell);
  });
}
