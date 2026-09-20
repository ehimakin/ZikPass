import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { runAccountRecoveryTransaction } from '@/lib/server/storage';
import { rebindIssuedCredential } from '@/lib/server/credential-issuer';
import { verifyString } from '@/lib/shared/crypto/ed25519';
import { recoverySigningText } from '@/lib/shared/account-recovery/crypto';
import { MAX_BACKUP_BYTES, type RecoveryAction, type RecoveryResponse, type SignedRecoveryRequest } from '@/lib/shared/account-recovery/types';

export class AccountRecoveryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function accountRecoveryAvailable(): boolean {
  // Never advertise a durable recovery backup on ephemeral hosted storage.
  if (process.env.ZIK_ACCOUNT_RECOVERY_ENABLED === 'false') return false;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || process.env.AWS_REGION) {
    return process.env.ZIK_ACCOUNT_RECOVERY_ENABLED === 'true' && Boolean(process.env.ZIK_RUNTIME_DATA_DIR?.trim());
  }
  return true;
}
function requireAvailable() {
  if (!accountRecoveryAvailable()) throw new AccountRecoveryError('Account recovery is unavailable until durable backup storage is configured. Nothing has been backed up.', 503);
}
function validId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(id)) throw new AccountRecoveryError('Invalid recovery request.');
}
function publicKey(key: unknown): asserts key is JsonWebKey {
  const k = key as JsonWebKey | undefined;
  if (!k || k.kty !== 'OKP' || k.crv !== 'Ed25519' || k.d !== undefined || typeof k.x !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(k.x)) throw new AccountRecoveryError('Invalid public key.');
}
const same = (a: JsonWebKey, b: JsonWebKey) => a.x === b.x && a.crv === b.crv && a.kty === b.kty;
const denied = () => new AccountRecoveryError('Recovery proof is invalid or expired. Try again.', 403);

export async function createRecoveryChallenge(id: string, action: RecoveryAction) {
  requireAvailable(); validId(id);
  if (!['save', 'read', 'restore'].includes(action)) throw new AccountRecoveryError('Invalid action.');
  return runAccountRecoveryTransaction(store => {
    store.recovery_challenges = store.recovery_challenges.filter(item => item.expiresAt > Date.now());
    if (store.recovery_challenges.filter(item => item.recoveryId === id).length >= 10 || store.recovery_challenges.length >= 2000) throw new AccountRecoveryError('Too many attempts. Please wait five minutes.', 429);
    const challenge = { recoveryId: id, action, nonce: randomBytes(32).toString('base64url'), expiresAt: Date.now() + 300_000 };
    store.recovery_challenges.push(challenge);
    return challenge;
  });
}

export async function accountRecoveryAction(input: SignedRecoveryRequest): Promise<RecoveryResponse> {
  requireAvailable();
  const r = input?.request;
  if (!r || !['save', 'read', 'restore'].includes(r.action)) throw new AccountRecoveryError('Invalid recovery request.');
  validId(r.recoveryId); publicKey(r.recoveryPublicKey);
  const expectedId = createHash('sha256').update(`zik-recovery-id-v1:${r.recoveryPublicKey.x}`).digest('base64url');
  if (r.recoveryId !== expectedId || !Number.isSafeInteger(r.revision) || r.revision < 0 || typeof r.nonce !== 'string') throw denied();
  const message = recoverySigningText(r);
  try {
    if (typeof input.recoverySignature !== 'string' || input.recoverySignature.length > 100 || !await verifyString(r.recoveryPublicKey, message, input.recoverySignature)) throw denied();
    if (r.action !== 'read') {
      publicKey(r.holderPublicKey);
      if (typeof input.holderSignature !== 'string' || input.holderSignature.length > 100 || !await verifyString(r.holderPublicKey!, message, input.holderSignature)) throw denied();
    }
  } catch { throw denied(); }
  if (r.action === 'save') {
    const b = r.backup;
    if (!b || b.version !== 1 || !/^[A-Za-z0-9_-]{16}$/.test(b.iv) || typeof b.ciphertext !== 'string' || b.ciphertext.length < 22 || b.ciphertext.length > MAX_BACKUP_BYTES || !/^[A-Za-z0-9_-]+$/.test(b.ciphertext)) throw new AccountRecoveryError('Invalid or oversized encrypted backup (32 MB maximum).');
  }
  if (r.action === 'restore' && (typeof r.operationId !== 'string' || !/^[a-f0-9-]{36}$/.test(r.operationId))) throw new AccountRecoveryError('Invalid restore request.');
  return runAccountRecoveryTransaction(async store => {
    const challenge = store.recovery_challenges.find(item => item.nonce === r.nonce && item.recoveryId === r.recoveryId && item.action === r.action && item.expiresAt > Date.now());
    if (!challenge) throw denied();
    const record = store.account_recoveries.find(item => item.id === r.recoveryId);
    const consume = () => { store.recovery_challenges = store.recovery_challenges.filter(item => item.nonce !== r.nonce); };
    if (r.action === 'read') {
      if (!record) throw new AccountRecoveryError('No backup found for this recovery phrase. Check the words, or use the phrase saved during setup.', 404);
      consume();
      return { revision: record.revision, savedAt: record.savedAt, backup: record.backup };
    }
    if (r.action === 'save') {
      if (record && !same(record.holderPublicKey, r.holderPublicKey!)) throw denied();
      if ((record?.revision ?? 0) !== r.revision) throw new AccountRecoveryError('Backup changed. Reload and try again.', 409);
      if (record?.enrollmentId && r.enrollmentId !== record.enrollmentId) throw new AccountRecoveryError('This backup must retain its existing pass.', 409);
      if (r.enrollmentId) {
        const enrollment = store.enrollments.find(item => item.id === r.enrollmentId);
        const credential = enrollment?.issued_credential;
        if (!credential || !same(credential.payload.subject_public_key, r.holderPublicKey!)) throw denied();
        if (store.revoked_holders.some(item => item.credentialId === credential.payload.credential_id && item.holderX === r.holderPublicKey!.x)) throw denied();
      }
      if (store.account_recoveries.some(item => item.id !== r.recoveryId && (same(item.holderPublicKey, r.holderPublicKey!) || (r.enrollmentId && item.enrollmentId === r.enrollmentId)))) {
        throw new AccountRecoveryError('Recovery is already set up. Enter your existing 24-word phrase to update its backup.', 409);
      }
      const savedAt = new Date().toISOString();
      const next = { ...record, id: r.recoveryId, recoveryPublicKey: r.recoveryPublicKey, holderPublicKey: r.holderPublicKey!, enrollmentId: r.enrollmentId, backup: r.backup!, revision: r.revision + 1, savedAt };
      store.account_recoveries = [...store.account_recoveries.filter(item => item.id !== r.recoveryId), next];
      consume();
      return { revision: next.revision, savedAt };
    }
    if (!record) throw denied();
    // Safe retry after a lost response or failed local write. A different
    // replacement device may not reuse this operation id.
    if (record.lastRestore && record.lastRestore.operationId === r.operationId) {
      if (record.lastRestore.holderX !== r.holderPublicKey!.x) throw denied();
      consume();
      return { revision: record.revision, savedAt: record.savedAt, credential: record.lastRestore.credential, enrollmentId: record.enrollmentId };
    }
    if (record.revision !== r.revision) throw new AccountRecoveryError('Backup changed on another device. Start recovery again.', 409);
    if (same(record.holderPublicKey, r.holderPublicKey!)) throw new AccountRecoveryError('Recovery needs a new device key.');
    if (store.revoked_holders.some(item => item.holderX === r.holderPublicKey!.x)) throw new AccountRecoveryError('A previously revoked device key cannot be reused.');
    const now = new Date().toISOString();
    let credential;
    if (record.enrollmentId) {
      const enrollment = store.enrollments.find(item => item.id === record.enrollmentId);
      if (!enrollment?.issued_credential) throw new AccountRecoveryError('The backed-up pass is no longer available.', 409);
      const old = enrollment.issued_credential;
      credential = await rebindIssuedCredential(old, r.holderPublicKey!);
      const keys = [old.payload.subject_public_key, ...store.device_bindings.filter(item => item.enrollment_id === enrollment.id).map(item => item.holder_public_key), ...store.mobile_handoffs.filter(item => item.enrollment_id === enrollment.id && item.holder_public_key).map(item => item.holder_public_key!)];
      for (const key of keys) if (key.x && !store.revoked_holders.some(item => item.credentialId === old.payload.credential_id && item.holderX === key.x)) store.revoked_holders.push({ credentialId: old.payload.credential_id, holderX: key.x });
      for (const binding of store.device_bindings.filter(item => item.enrollment_id === enrollment.id)) { binding.status = 'revoked'; binding.revoked_at = now; binding.is_primary = false; }
      store.device_bindings.push({ binding_id: `device_${randomUUID()}`, enrollment_id: enrollment.id, holder_public_key: r.holderPublicKey!, status: 'active', is_primary: true, linked_at: now, last_seen_at: now });
      for (const handoff of store.mobile_handoffs.filter(item => item.enrollment_id === enrollment.id)) handoff.superseded_at = now;
      enrollment.holder_public_key = r.holderPublicKey!;
      enrollment.issued_credential = credential;
      enrollment.updated_at = now;
      enrollment.account_recovered_at = now;
    }
    record.holderPublicKey = r.holderPublicKey!;
    record.recoveredAt = now;
    record.revision++;
    record.lastRestore = { operationId: r.operationId!, holderX: r.holderPublicKey!.x!, credential };
    consume();
    return { revision: record.revision, savedAt: record.savedAt, credential, enrollmentId: record.enrollmentId };
  });
}
