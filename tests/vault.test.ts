import { describe, it, expect } from 'vitest';
import { encryptVault, decryptVault, type VaultProfileV1 } from '@/lib/shared/vault';
import { VaultSession, type VaultStorage } from '@/lib/client/vault-adapter';
const field = { value: 'Private fixture', provenance: 'self_entered', updated_at: '2026-09-12T00:00:00Z' } as const;
const profile: VaultProfileV1 = { version: 1, legal_name: field, delivery_address: field };
const secret = 'correct horse battery staple';
describe('device Vault', () => {
  it('round trips, uses fresh salt/IV and contains no plaintext', async () => {
    const a = await encryptVault(profile, secret), b = await encryptVault(profile, secret);
    expect(await decryptVault(a, secret)).toEqual(profile);
    expect(a.salt).not.toBe(b.salt); expect(a.iv).not.toBe(b.iv); expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(JSON.stringify(a)).not.toContain(field.value);
  });
  it('fails closed for wrong secret, tamper, parameters and versions', async () => {
    const a = await encryptVault(profile, secret);
    await expect(decryptVault(a, 'wrong secret long enough')).rejects.toThrow();
    for (const patch of [{ version: 2 }, { iterations: 1 }, { iv: 'AAAAAAAAAAAAAAAA' }, { ciphertext: a.ciphertext.slice(1) }, { extra: true }]) await expect(decryptVault({ ...a, ...patch }, secret)).rejects.toThrow();
  });
  it('preserves unknown versions and interrupted writes, reloads locked and deletes', async () => {
    let stored: unknown;
    let fail = false;
    const storage: VaultStorage = { read: async () => stored, write: async v => { if (fail) throw Error(); stored = v; }, remove: async () => { stored = undefined; } };
    const session = new VaultSession(storage);
    await session.save(profile, secret); const before = stored;
    fail = true; await expect(session.save(profile, secret)).rejects.toThrow(); expect(stored).toEqual(before);
    expect(() => new VaultSession(storage).read()).toThrow('vault_locked');
    session.lock(); expect(() => session.read()).toThrow();
    stored = { version: 2 }; await expect(session.unlock(secret)).rejects.toThrow(); expect(stored).toEqual({ version: 2 });
    await session.delete(); expect(stored).toBeUndefined(); expect(() => session.read()).toThrow();
  });
});
it('does not resurrect an in-flight unlock after lock', async () => {
  const envelope = await encryptVault(profile, secret);
  const session = new VaultSession({read:async()=>envelope,write:async()=>{},remove:async()=>{}});
  const pending = session.unlock(secret); session.lock();
  await expect(pending).rejects.toThrow('vault_locked'); expect(()=>session.read()).toThrow();
});
