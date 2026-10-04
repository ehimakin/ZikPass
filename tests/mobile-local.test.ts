import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { LocalVault, type VaultStorage } from '../mobile/src/vault/repository';
import { configuredOrigin, webDestination } from '../mobile/src/web-policy';
import { seal, unseal } from '../mobile/src/vault/crypto';

function memory() {
  const files = new Map<string, Uint8Array>();
  let pointer: 'a' | 'b' | null = null;
  const storage: VaultStorage = {
    random: size => new Uint8Array(randomBytes(size)),
    async read(name) { const value = files.get(name); if (!value) throw new Error('Missing'); return value; },
    async write(name, bytes) { files.set(name, bytes); },
    async remove(name) { files.delete(name); },
    async pointer() { return pointer; }, async commit(slot) { pointer = slot; }
  };
  return { files, storage };
}
describe('native local Vault', () => {
  it('persists encrypted documents and self-entered identity across sessions', async () => {
    const { storage, files } = memory(); const key = randomBytes(32);
    const first = new LocalVault(key, storage);
    const bytes = new TextEncoder().encode('a private original document');
    const index = await first.import('passport.pdf', 'application/pdf', bytes);
    await first.updateIdentity({ name: 'Private Person', dateOfBirth: '1990-01-02', address: 'Private street' });
    expect([...files.values()].every(value => !new TextDecoder().decode(value).includes('Private Person'))).toBe(true);
    expect([...files.values()].every(value => !new TextDecoder().decode(value).includes('a private original document'))).toBe(true);
    first.lock();
    await expect(first.read()).rejects.toThrow('Unlock');
    const next = new LocalVault(key, storage);
    expect((await next.read()).identity.name).toBe('Private Person');
    expect((await next.document(index.documents[0].id)).bytes).toEqual(bytes);
    await next.remove(index.documents[0].id);
    expect((await next.read()).documents).toHaveLength(0);
    expect(files.has(index.documents[0].id)).toBe(false);
  });
  it('rejects tampering, another key and document swapping', () => {
    const key = randomBytes(32), nonce = randomBytes(12), bytes = new TextEncoder().encode('secret');
    const encrypted = seal(key, nonce, bytes, 'document-a');
    expect(() => unseal(randomBytes(32), encrypted, 'document-a')).toThrow();
    expect(() => unseal(key, encrypted, 'document-b')).toThrow();
    encrypted[15] ^= 1;
    expect(() => unseal(key, encrypted, 'document-a')).toThrow();
  });
  it('keeps the previous index when committing a new index fails', async () => {
    const { storage } = memory(); const vault = new LocalVault(randomBytes(32), storage);
    await vault.updateIdentity({ name: 'First', dateOfBirth: '', address: '' });
    storage.commit = async () => { throw new Error('Storage full'); };
    await expect(vault.updateIdentity({ name: 'Second', dateOfBirth: '', address: '' })).rejects.toThrow('Storage full');
    expect((await vault.read()).identity.name).toBe('First');
  });
  it('serialises concurrent updates without losing documents', async () => {
    const { storage } = memory(); const vault = new LocalVault(randomBytes(32), storage);
    await Promise.all(['first', 'second'].map(name => vault.import(`${name}.pdf`, 'application/pdf', new Uint8Array([1, 2]))));
    expect((await vault.read()).documents).toHaveLength(2);
  });
  it('rejects impossible and future dates without changing the saved profile', async () => {
    const { storage } = memory(); const vault = new LocalVault(randomBytes(32), storage);
    for (const dateOfBirth of ['2023-02-29', '1990-13-01', '2999-01-01']) {
      await expect(vault.updateIdentity({ name: 'Person', dateOfBirth, address: '' })).rejects.toThrow('valid date');
    }
    expect((await vault.read()).identity.name).toBe('');
    await vault.updateIdentity({ name: 'Person', dateOfBirth: '2000-02-29', address: '' });
    expect((await vault.read()).identity.dateOfBirth).toBe('2000-02-29');
  });
  it('does not commit a document after the Vault locks', async () => {
    const { storage } = memory(); const vault = new LocalVault(randomBytes(32), storage);
    const write = storage.write;
    storage.write = async (name, bytes) => { await write(name, bytes); vault.lock(); };
    await expect(vault.import('test.pdf', 'application/pdf', new Uint8Array([1, 2]))).rejects.toThrow('Unlock');
    expect(await storage.pointer()).toBeNull();
  });
});
describe('native WebView routing', () => {
  const origin = 'https://zik.example';
  it('requires configured HTTPS; permits only emulator loopback HTTP in development', () => {
    expect(configuredOrigin(undefined, false)).toBeNull();
    expect(configuredOrigin('http://example.com', true)).toBeNull();
    expect(configuredOrigin('https://user:secret@zik.example', false)).toBeNull();
    expect(configuredOrigin('http://localhost:3000', true)).toBe('http://localhost:3000');
    expect(configuredOrigin('http://localhost:3000', false)).toBeNull();
  });
  it('routes private surfaces natively and service pages to the approved origin', () => {
    expect(webDestination(`${origin}/vault`, origin)).toEqual({ kind: 'native', path: '/vault' });
    expect(webDestination(`${origin}/id/apply`, origin)).toEqual({ kind: 'native', path: '/identity' });
    expect(webDestination(`${origin}/wallet`, origin)).toEqual({ kind: 'native', path: '/wallet' });
    expect(webDestination(`${origin}/get-pass`, origin).kind).toBe('web');
    expect(webDestination(`${origin}/pass`, origin).kind).toBe('web'); // Existing web-to-native handoff surface.
  });
  it('does not grant lookalike hosts, file URLs or JavaScript local access', () => {
    expect(webDestination('https://zik.example.attacker.test/vault', origin).kind).toBe('external');
    for (const url of ['javascript:alert(1)', 'file:///private/vault', 'data:text/html,hi', 'http://elsewhere.test', 'https://user@zik.example/vault']) expect(webDestination(url, origin).kind).toBe('blocked');
  });
  it('only accepts exact handoff links and bounded tokens', () => {
    const token = 'a'.repeat(43);
    expect(webDestination(`zik://handoff?token=${token}`, origin)).toEqual({ kind: 'handoff', token });
    expect(webDestination(`zik://handoff/other?token=${token}`, origin).kind).toBe('blocked');
    expect(webDestination('zik://handoff?token=short', origin).kind).toBe('blocked');
    expect(webDestination('zik://vault?export=all', origin).kind).toBe('blocked');
  });
});
