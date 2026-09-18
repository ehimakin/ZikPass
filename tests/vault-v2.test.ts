import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { contentHash, createKeyEnvelope, openKeyEnvelope, parseKeyEnvelope, rewrapKeyEnvelope, seal, open, sealJson, openJson } from '@/lib/shared/vault/crypto';
import { parseDocument, parseObservation, parseProfileV2 } from '@/lib/shared/vault/model';
import { migrateProfile, seedClaims, toProfileV1, VaultV2 } from '@/lib/client/vault/session';
import { destroyDatabase } from '@/lib/client/vault/store';
import { encryptVault, type VaultProfileV1 } from '@/lib/shared/vault';
import { indexedVaultStorage } from '@/lib/client/vault-adapter';

const secret = 'correct horse battery staple';
const field = { value: 'Alex Morgan Rivers', provenance: 'self_entered', updated_at: '2026-09-12T00:00:00Z' } as const;
const address = { value: 'Flat 3, 14 Harbour Lane, Bristol, BS1 4TR', provenance: 'self_entered', updated_at: '2026-09-12T00:00:00Z' } as const;
const profileV2 = { legal_name: field, delivery_address: address, designations: [] };
const bytes = (text: string) => new TextEncoder().encode(text);

beforeEach(async () => { await destroyDatabase().catch(() => undefined); await indexedVaultStorage.remove().catch(() => undefined); });

describe('vault v2 key hierarchy', () => {
  it('wraps a random data key and opens it again with the passphrase', async () => {
    const { envelope, key } = await createKeyEnvelope(secret);
    expect(parseKeyEnvelope(envelope)).toEqual(envelope);
    const sealed = await sealJson(key, 'profile', 'profile', { hello: 'private' });
    expect(new TextDecoder().decode(sealed.ciphertext)).not.toContain('private');
    const reopened = await openKeyEnvelope(envelope, secret);
    expect(await openJson(reopened, 'profile', 'profile', sealed)).toEqual({ hello: 'private' });
  });

  it('uses a fresh salt, nonce and key every time', async () => {
    const a = await createKeyEnvelope(secret);
    const b = await createKeyEnvelope(secret);
    expect(a.envelope.salt).not.toBe(b.envelope.salt);
    expect(a.envelope.wrap_iv).not.toBe(b.envelope.wrap_iv);
    expect(a.envelope.wrapped_key).not.toBe(b.envelope.wrapped_key);
    const first = await seal(a.key, 'blobs', 'doc', bytes('same bytes'));
    const second = await seal(a.key, 'blobs', 'doc', bytes('same bytes'));
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
  });

  it('fails closed on a wrong passphrase, tampering and unknown parameters', async () => {
    const { envelope } = await createKeyEnvelope(secret);
    await expect(openKeyEnvelope(envelope, 'a different passphrase')).rejects.toThrow();
    await expect(openKeyEnvelope({ ...envelope, wrapped_key: `${envelope.wrapped_key.slice(0, -2)}AA` }, secret)).rejects.toThrow();
    for (const patch of [{ version: 3 }, { iterations: 1000 }, { kdf: 'scrypt' }, { extra: true }]) {
      await expect(openKeyEnvelope({ ...envelope, ...patch }, secret)).rejects.toThrow();
    }
  });

  it('refuses ciphertext moved to another record or store', async () => {
    const { key } = await createKeyEnvelope(secret);
    const sealed = await seal(key, 'documents', 'document-a', bytes('a private document'));
    await expect(open(key, 'documents', 'document-b', sealed)).rejects.toThrow();
    await expect(open(key, 'blobs', 'document-a', sealed)).rejects.toThrow();
    expect(await open(key, 'documents', 'document-a', sealed)).toEqual(bytes('a private document'));
  });

  it('changes the passphrase without touching stored records', async () => {
    const { envelope, key } = await createKeyEnvelope(secret);
    const sealed = await seal(key, 'blobs', 'doc', bytes('a scan'));
    const next = await rewrapKeyEnvelope(envelope, secret, 'an entirely new passphrase');
    await expect(openKeyEnvelope(next, secret)).rejects.toThrow();
    const reopened = await openKeyEnvelope(next, 'an entirely new passphrase');
    expect(await open(reopened, 'blobs', 'doc', sealed)).toEqual(bytes('a scan'));
  });

  it('hashes identical bytes identically and different bytes differently', async () => {
    expect(await contentHash(bytes('same'))).toBe(await contentHash(bytes('same')));
    expect(await contentHash(bytes('same'))).not.toBe(await contentHash(bytes('other')));
  });
});

describe('vault v2 records', () => {
  it('rejects records with unknown fields, bad enums or out-of-range numbers', () => {
    const document = { id: 'abc', filename: 'passport.png', media_type: 'image/png', byte_length: 10, content_hash: 'hash', imported_at: '2026-09-18T00:00:00Z', classification: 'passport', page_count: 1, rotation: 0, processing: 'analysed' };
    expect(parseDocument(document).id).toBe('abc');
    expect(() => parseDocument({ ...document, surprise: true })).toThrow();
    expect(() => parseDocument({ ...document, classification: 'birth_certificate' })).toThrow();
    expect(() => parseDocument({ ...document, rotation: 45 })).toThrow();
    expect(() => parseDocument({ ...document, byte_length: -1 })).toThrow();
    expect(() => parseProfileV2({ version: 1, ...profileV2 })).toThrow();
  });

  it('keeps the raw text beside the proposal and rejects an impossible confidence', () => {
    const observation = { id: 'o1', document_id: 'd1', page: 1, field: 'date_of_birth', raw_text: '940312', normalised: '1994-03-12', ambiguities: [], method: 'mrz', parser_version: 'x', recognition_quality: 92, excerpt: '', review: 'pending', created_at: '2026-09-18T00:00:00Z' };
    expect(parseObservation(observation).raw_text).toBe('940312');
    expect(() => parseObservation({ ...observation, recognition_quality: 400 })).toThrow();
    expect(() => parseObservation({ ...observation, review: 'verified' })).toThrow();
  });
});

describe('migration from a v1 Vault', () => {
  const legacy: VaultProfileV1 = { version: 1, legal_name: field, delivery_address: address, email: { value: 'alex@example.invalid', provenance: 'self_entered', updated_at: '2026-09-12T00:00:00Z' } };

  it('carries v1 values across and invents nothing', () => {
    const migrated = migrateProfile(legacy, new Date('2026-09-18T00:00:00Z'));
    expect(migrated.version).toBe(2);
    expect(migrated.legal_name).toEqual(field);
    expect(migrated.email?.value).toBe('alex@example.invalid');
    expect(migrated.date_of_birth).toBeUndefined();
    expect(migrated.designations).toEqual([]);
    expect(toProfileV1(migrated)).toEqual(legacy);
  });

  it('migrates on unlock and leaves the v1 record in place', async () => {
    await indexedVaultStorage.write(await encryptVault(legacy, secret));
    expect(await VaultV2.status()).toBe('v1_only');
    const vault = new VaultV2();
    await vault.unlock(secret);
    expect((await vault.readProfile()).legal_name.value).toBe(field.value);
    // The old record is only a fallback now, but destroying it would be a migration that can lose data.
    expect(await indexedVaultStorage.read()).toBeDefined();
    expect(await VaultV2.status()).toBe('ready');
  });

  it('leaves a v1 Vault untouched when the passphrase is wrong', async () => {
    const stored = await encryptVault(legacy, secret);
    await indexedVaultStorage.write(stored);
    await expect(new VaultV2().unlock('a completely wrong passphrase')).rejects.toThrow();
    expect(await indexedVaultStorage.read()).toEqual(stored);
    expect(await VaultV2.status()).toBe('v1_only');
  });

  it('seeds claims from the profile without any evidence behind them', () => {
    const claims = seedClaims(parseProfileV2({ version: 2, ...profileV2 }), new Date());
    expect(claims.map(claim => claim.field).sort()).toEqual(['address', 'date_of_birth', 'email', 'legal_name']);
    for (const claim of claims) {
      expect(claim.supporting_observation_ids).toEqual([]);
      expect(claim.attestations).toEqual([]);
      expect(claim.source).toBe('self_entered');
    }
  });
});

describe('vault v2 session', () => {
  it('creates, locks and reopens with the right passphrase only', async () => {
    const vault = new VaultV2();
    await vault.create(profileV2, secret);
    expect(vault.unlocked).toBe(true);
    vault.lock();
    expect(vault.unlocked).toBe(false);
    await expect(vault.readProfile()).rejects.toThrow('vault_locked');
    await expect(vault.unlock('not the right passphrase')).rejects.toThrow();
    await vault.unlock(secret);
    expect((await vault.readProfile()).legal_name.value).toBe(field.value);
  });

  it('stores documents, survives a lock and reopen, and deletes what a document supports', async () => {
    const vault = new VaultV2();
    await vault.create(profileV2, secret);
    const { document } = await vault.addDocument({ bytes: bytes('%PDF-1.7 a private scan'), filename: 'passport.pdf', media_type: 'application/pdf' });
    await vault.saveAnalysis({
      document_id: document.id, generation: vault.epoch, classification: 'passport', page_count: 1, rotation: 0,
      analysis: { engine: 'test', method: 'ocr', completed_at: new Date().toISOString(), recognition_quality: 92 },
      observations: [{ page: 1, field: 'legal_name', raw_text: 'RIVERS<<ALEX MORGAN', normalised: 'Alex Morgan Rivers', ambiguities: [], method: 'mrz', parser_version: 'test', recognition_quality: 92, excerpt: '' }],
      extracted_text: 'passport text',
    });
    const [observation] = await vault.listObservations(document.id);
    await vault.reviewObservation(observation.id, 'accepted');

    vault.lock();
    await vault.unlock(secret);
    expect((await vault.listDocuments())[0].classification).toBe('passport');
    expect(new TextDecoder().decode(await vault.readDocumentBytes(document.id))).toContain('a private scan');
    expect((await vault.listClaims()).find(claim => claim.field === 'legal_name')?.supporting_observation_ids).toHaveLength(1);

    await vault.deleteDocument(document.id);
    expect(await vault.listDocuments()).toEqual([]);
    expect(await vault.listObservations()).toEqual([]);
    const claim = (await vault.listClaims()).find(entry => entry.field === 'legal_name');
    // The user's own value survives; only the evidence under it is gone.
    expect(claim?.value).toBe(field.value);
    expect(claim?.supporting_observation_ids).toEqual([]);
    await expect(vault.readDocumentBytes(document.id)).rejects.toThrow();
  });

  it('groups an identical re-import instead of treating it as new evidence', async () => {
    const vault = new VaultV2();
    await vault.create(profileV2, secret);
    const first = await vault.addDocument({ bytes: bytes('identical bytes'), filename: 'scan.png', media_type: 'image/png' });
    const second = await vault.addDocument({ bytes: bytes('identical bytes'), filename: 'scan-copy.png', media_type: 'image/png' });
    expect(second.duplicate_of?.id).toBe(first.document.id);
    expect(second.document.group_id).toBe(first.document.id);
    expect(second.document.content_hash).toBe(first.document.content_hash);
  });

  it('drops a result produced before the Vault locked', async () => {
    const vault = new VaultV2();
    await vault.create(profileV2, secret);
    const { document } = await vault.addDocument({ bytes: bytes('a scan'), filename: 'scan.png', media_type: 'image/png' });
    const staleGeneration = vault.epoch;
    vault.lock();
    await vault.unlock(secret);
    await expect(vault.saveAnalysis({
      document_id: document.id, generation: staleGeneration, classification: 'passport', page_count: 1, rotation: 0,
      analysis: { engine: 'test', method: 'ocr', completed_at: new Date().toISOString(), recognition_quality: 90 },
      observations: [], extracted_text: 'late result',
    })).rejects.toThrow('vault_locked');
    expect(await vault.listObservations(document.id)).toEqual([]);
  });

  it('records store and analyse consent separately, and can withdraw one', async () => {
    const vault = new VaultV2();
    await vault.create(profileV2, secret);
    const stored = await vault.recordConsent({ scope: 'store', purpose: 'Keep documents', policy_version: 'v1', source_descriptor: '2 files', source_fingerprint: 'abc', file_count: 2, granted_at: new Date().toISOString() });
    await vault.recordConsent({ scope: 'analyse', purpose: 'Read documents', policy_version: 'v1', source_descriptor: '2 files', source_fingerprint: 'abc', file_count: 2, granted_at: new Date().toISOString() });
    await vault.withdrawConsent(stored.id);
    const consents = await vault.listConsents();
    expect(consents).toHaveLength(2);
    expect(consents.find(consent => consent.scope === 'store')?.withdrawn_at).toBeDefined();
    expect(consents.find(consent => consent.scope === 'analyse')?.withdrawn_at).toBeUndefined();
  });

  it('keeps a document that was stored without ever being analysed', async () => {
    const vault = new VaultV2();
    await vault.create(profileV2, secret);
    const { document } = await vault.addDocument({ bytes: bytes('never read'), filename: 'note.png', media_type: 'image/png', processing: 'stored' });
    expect(document.processing).toBe('stored');
    expect(document.classification).toBeNull();
    expect(await vault.listObservations(document.id)).toEqual([]);
  });
});
