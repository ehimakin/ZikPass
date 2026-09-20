import 'fake-indexeddb/auto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateRecoveryPhrase, normalizeRecoveryPhrase, recoveryKeys, encryptBackup, decryptBackup, recoverySigningText } from '@/lib/shared/account-recovery/crypto';
import { generateKeyPair, signString, type ExportedKeyPair } from '@/lib/shared/crypto/ed25519';
import type { RecoveryAction, RecoveryRequest, SignedRecoveryRequest } from '@/lib/shared/account-recovery/types';
import type { EnrollmentRecord, SignedCredential } from '@/lib/shared/types';
import { VaultV2 } from '@/lib/client/vault/session';
import { destroyDatabase, commit, sealBytes, transact, getRecord, openBytes } from '@/lib/client/vault/store';
import { openKeyEnvelope } from '@/lib/shared/vault/crypto';
import { indexedVaultStorage } from '@/lib/client/vault-adapter';
import { exportVaultSnapshot, prepareVaultRestore, importVaultSnapshot } from '@/lib/client/account-recovery/vault-backup';

let directory: string;
let service: typeof import('@/lib/server/account-recovery');
let storage: typeof import('@/lib/server/storage');
let issuer: typeof import('@/lib/server/credential-issuer');
let phrase: string;
let keys: Awaited<ReturnType<typeof recoveryKeys>>;
let holder: ExportedKeyPair;
let credential: SignedCredential;
const enrollmentId = 'account-recovery-test-enrollment';
const field = { value: 'Private Person', provenance: 'self_entered', updated_at: '2026-09-20T00:00:00Z' } as const;

beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'zik-account-recovery-'));
  vi.stubEnv('ZIK_RUNTIME_DATA_DIR', directory);
  vi.stubEnv('ZIK_ACCOUNT_RECOVERY_ENABLED', 'true');
  vi.resetModules();
  service = await import('@/lib/server/account-recovery');
  storage = await import('@/lib/server/storage');
  issuer = await import('@/lib/server/credential-issuer');
});
afterAll(async () => { vi.unstubAllEnvs(); vi.resetModules(); await rm(directory, { recursive: true, force: true }); });
beforeEach(async () => {
  await storage.resetDemoRuntimeState();
  await destroyDatabase(); await indexedVaultStorage.remove();
  phrase = generateRecoveryPhrase(); keys = await recoveryKeys(phrase); holder = await generateKeyPair();
  const record = {
    id: enrollmentId, holder_public_key: holder.publicKeyJwk, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    application: {}, providers: {}, risk_decision: {}, orchestration: {}, status: 'issued',
    cooling_off: { ends_at: new Date(Date.now() - 1000).toISOString() }, assurance_level: 'remote_standard', issuance_channel: 'remote',
  } as unknown as EnrollmentRecord;
  credential = await issuer.issueCredential(record);
  record.issued_credential = credential;
  await storage.upsertEnrollment(record);
});
async function signed(action: RecoveryAction, patch: Partial<RecoveryRequest> = {}, signingHolder = holder): Promise<SignedRecoveryRequest> {
  const challenge = await service.createRecoveryChallenge(keys.id, action);
  const request: RecoveryRequest = { action, recoveryId: keys.id, recoveryPublicKey: keys.signing.publicKeyJwk, nonce: challenge.nonce, revision: 0, ...patch };
  const message = recoverySigningText(request);
  return { request, recoverySignature: await signString(keys.signing.privateKeyJwk, message), ...(action !== 'read' ? { holderSignature: await signString(signingHolder.privateKeyJwk, message) } : {}) };
}
async function save() {
  const backup = await encryptBackup(keys.encryption, keys.id, { version: 1, createdAt: new Date().toISOString(), enrollmentId });
  return service.accountRecoveryAction(await signed('save', { holderPublicKey: holder.publicKeyJwk, enrollmentId, backup }));
}

describe('account recovery phrase and encryption', () => {
  it('generates 24 valid words, normalizes whitespace and rejects passwords or changed checksums', async () => {
    expect(phrase.split(' ')).toHaveLength(24);
    expect(normalizeRecoveryPhrase(`  ${phrase.toUpperCase().replaceAll(' ', '\n')} `)).toBe(phrase);
    expect(() => normalizeRecoveryPhrase('my old messaging passphrase')).toThrow();
    expect((await recoveryKeys(phrase)).id).toBe(keys.id);
    expect((await recoveryKeys(generateRecoveryPhrase())).id).not.toBe(keys.id);
  });
  it('separates signing and encryption and authenticates both backup identity and ciphertext', async () => {
    const backup = await encryptBackup(keys.encryption, keys.id, { private: 'document' });
    expect(await decryptBackup(keys.encryption, keys.id, backup)).toEqual({ private: 'document' });
    await expect(decryptBackup(keys.encryption, 'other-account', backup)).rejects.toThrow();
    const other = await recoveryKeys(generateRecoveryPhrase());
    await expect(decryptBackup(other.encryption, keys.id, backup)).rejects.toThrow();
    await expect(decryptBackup(keys.encryption, keys.id, { ...backup, ciphertext: (backup.ciphertext[0] === 'A' ? 'B' : 'A') + backup.ciphertext.slice(1) })).rejects.toThrow();
  });
});

describe('authenticated recovery service', () => {
  it('stores only ciphertext and public keys, requires holder ownership, and refuses replay', async () => {
    const backup = await encryptBackup(keys.encryption, keys.id, { private: 'Private Person' });
    const attacker = await generateKeyPair();
    await expect(service.accountRecoveryAction(await signed('save', { holderPublicKey: attacker.publicKeyJwk, enrollmentId, backup }, attacker))).rejects.toThrow();
    const request = await signed('save', { holderPublicKey: holder.publicKeyJwk, enrollmentId, backup });
    await expect(service.accountRecoveryAction(request)).resolves.toMatchObject({ revision: 1 });
    await expect(service.accountRecoveryAction(request)).rejects.toThrow();
    const persisted = await readFile(path.join(directory, 'runtime-state.json'), 'utf8');
    expect(persisted).not.toContain(phrase);
    expect(persisted).not.toContain('Private Person');
    expect(persisted).not.toContain(keys.signing.privateKeyJwk.d);
    expect(persisted).not.toContain(holder.privateKeyJwk.d);
  });
  it('rejects bad signatures, expired challenges, unknown phrases and a second seed for the same pass', async () => {
    const req = await signed('read'); req.recoverySignature = 'invalid';
    await expect(service.accountRecoveryAction(req)).rejects.toThrow();
    const expired = await signed('read');
    await storage.runAccountRecoveryTransaction(s => { s.recovery_challenges.forEach(c => { c.expiresAt = 0; }); });
    await expect(service.accountRecoveryAction(expired)).rejects.toThrow();
    await expect(service.accountRecoveryAction(await signed('read'))).rejects.toThrow('No backup');
    await save();
    keys = await recoveryKeys(generateRecoveryPhrase());
    await expect(save()).rejects.toThrow('already set up');
  });
  it('rebinds the pass, revokes every old binding, supersedes handoffs and safely retries', async () => {
    const second = await generateKeyPair();
    await storage.runAccountRecoveryTransaction(s => {
      s.device_bindings.push(...[holder, second].map((k, i) => ({ binding_id: `binding-${i}`, enrollment_id: enrollmentId, holder_public_key: k.publicKeyJwk, status: 'active' as const, is_primary: i === 0, linked_at: new Date().toISOString() })));
      s.mobile_handoffs.push({ token_hash: 'old-token', enrollment_id: enrollmentId, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString() });
    });
    await save();
    const replacement = await generateKeyPair();
    const operationId = crypto.randomUUID();
    const patch = { revision: 1, operationId, holderPublicKey: replacement.publicKeyJwk };
    const result = await service.accountRecoveryAction(await signed('restore', patch, replacement));
    expect(result.credential?.payload.subject_public_key.x).toBe(replacement.publicKeyJwk.x);
    expect(result.credential?.payload.expires_at).toBe(credential.payload.expires_at);
    expect(await storage.isHolderRevoked(credential.payload.credential_id, holder.publicKeyJwk.x)).toBe(true);
    expect(await storage.isHolderRevoked(credential.payload.credential_id, second.publicKeyJwk.x)).toBe(true);
    expect(await storage.isHolderRevoked(credential.payload.credential_id, replacement.publicKeyJwk.x)).toBe(false);
    expect((await storage.listDeviceBindings(enrollmentId)).filter(b => b.status === 'active')).toHaveLength(1);
    expect((await storage.getMobileAppHandoff('old-token'))?.superseded_at).toBeTruthy();
    expect(await service.accountRecoveryAction(await signed('restore', patch, replacement))).toEqual(result);
    const { createNativeAppHandoff } = await import('@/lib/server/mobile-handoff');
    await expect(createNativeAppHandoff(enrollmentId)).rejects.toThrow('recovery phrase');
    await expect(service.accountRecoveryAction(await signed('restore', { ...patch, holderPublicKey: second.publicKeyJwk }, second))).rejects.toThrow();
    await expect(service.accountRecoveryAction(await signed('save', { revision: 2, holderPublicKey: holder.publicKeyJwk, enrollmentId, backup: (await service.accountRecoveryAction(await signed('read'))).backup }))).rejects.toThrow();
  });
  it('denies a revoked pass at affiliate verification and accepts its replacement', async () => {
    await save();
    const replacement = await generateKeyPair();
    const restored = await service.accountRecoveryAction(await signed('restore', { revision: 1, operationId: crypto.randomUUID(), holderPublicKey: replacement.publicKeyJwk }, replacement));
    const affiliate = await import('@/lib/server/affiliate-verifier');
    async function verify(pass: SignedCredential, key: ExportedKeyPair) {
      const request = await affiliate.createAffiliateAuthorizationRequest({ clientId: 'nightfall-demo', redirectUri: '/affiliate-demo/callback', state: crypto.randomUUID() });
      return affiliate.completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: { credential: pass, challenge: request.challenge, holder_signature: await signString(key.privateKeyJwk, request.challenge), holder_algorithm: 'Ed25519', presented_at: new Date().toISOString() } });
    }
    expect((await verify(credential, holder)).outcome).toBe('denied');
    expect((await verify(restored.credential!, replacement)).outcome).toBe('approved');
  });
  it('allows only one concurrent replacement at a revision', async () => {
    await save();
    const a = await generateKeyPair(), b = await generateKeyPair();
    const inputs = await Promise.all([a, b].map(k => signed('restore', { revision: 1, operationId: crypto.randomUUID(), holderPublicKey: k.publicKeyJwk }, k)));
    const results = await Promise.allSettled(inputs.map(input => service.accountRecoveryAction(input)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  });
  it('fails closed when hosted backup storage is disabled', async () => {
    vi.stubEnv('ZIK_ACCOUNT_RECOVERY_ENABLED', 'false');
    await expect(service.createRecoveryChallenge(keys.id, 'read')).rejects.toThrow('durable');
    vi.stubEnv('ZIK_ACCOUNT_RECOVERY_ENABLED', 'true');
  });
});

describe('Vault backup and replacement-device restore', () => {
  it('restores encrypted records and document bytes with a new passphrase, refuses overwrite and retries atomically', async () => {
    const vault = new VaultV2();
    await vault.create({ legal_name: field, delivery_address: { ...field, value: 'Private Address' }, designations: [] }, 'original vault passphrase');
    const meta = await transact(['meta'], 'readonly', tx => getRecord(tx, 'meta', 'key')) as unknown as { envelope: unknown };
    const key = await openKeyEnvelope(meta.envelope, 'original vault passphrase');
    await commit([{ store: 'blobs', action: 'put', cell: await sealBytes(key, 'blobs', 'document-1', new TextEncoder().encode('private document bytes')) }]);
    const snapshot = await exportVaultSnapshot('original vault passphrase', phrase);
    expect(JSON.stringify(snapshot)).not.toContain('private document bytes');
    await expect(exportVaultSnapshot('incorrect secret', phrase)).rejects.toThrow();
    const prepared = await prepareVaultRestore(snapshot!, phrase, 'replacement vault passphrase');
    await expect(importVaultSnapshot(prepared, 'restore-a')).rejects.toThrow('already has');
    vault.lock(); await destroyDatabase();
    await importVaultSnapshot(prepared, 'restore-a');
    await importVaultSnapshot(prepared, 'restore-a');
    const restored = new VaultV2();
    await expect(restored.unlock('original vault passphrase')).rejects.toThrow();
    await restored.unlock('replacement vault passphrase');
    expect((await restored.readProfile()).legal_name.value).toBe('Private Person');
    const restoredMeta = await transact(['meta'], 'readonly', tx => getRecord(tx, 'meta', 'key')) as unknown as { envelope: unknown };
    const restoredKey = await openKeyEnvelope(restoredMeta.envelope, 'replacement vault passphrase');
    const doc = await transact(['blobs'], 'readonly', tx => getRecord(tx, 'blobs', 'document-1'));
    expect(new TextDecoder().decode(await openBytes(restoredKey, 'blobs', doc!))).toBe('private document bytes');
    await expect(prepareVaultRestore({ ...snapshot!, records: { ...snapshot!.records, blobs: [{ ...snapshot!.records.blobs[0], id: 'tampered' }] } }, phrase, 'replacement vault passphrase')).rejects.toThrow();
  });
});
