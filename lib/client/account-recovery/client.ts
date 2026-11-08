import { generateKeyPair, signString } from '@/lib/shared/crypto/ed25519';
import { decryptBackup, encryptBackup, normalizeRecoveryPhrase, recoveryKeys, recoverySigningText } from '@/lib/shared/account-recovery/crypto';
import { MAX_BACKUP_BYTES, type RecoveryAction, type RecoveryRequest, type RecoveryResponse } from '@/lib/shared/account-recovery/types';
import { ensureHolderKeyPair, loadWalletState, saveWalletState } from '@/lib/client/wallet-client';
import { VaultV2 } from '@/lib/client/vault/session';
import { exportVaultSnapshot, importVaultSnapshot, prepareVaultRestore, type VaultSnapshot } from './vault-backup';
import { readRecoveryLocal, writeRecoveryLocal, type PendingRestore, type RecoveryStatus } from './local';
import type { ExportedKeyPair } from '@/lib/shared/crypto/ed25519';

type Keys = Awaited<ReturnType<typeof recoveryKeys>>;
export type BackupContents = { version: 1; createdAt: string; enrollmentId?: string; vault?: VaultSnapshot };
export type LoadedBackup = { keys: Keys; response: RecoveryResponse; contents: BackupContents };
class RequestError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function post(value: unknown) {
  const response = await fetch('/api/account-recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify(value) });
  const body = await response.json();
  if (!response.ok) throw new RequestError(body.error ?? 'Could not contact recovery storage.', response.status);
  return body;
}
async function signedRequest(keys: Keys, action: RecoveryAction, input: Partial<RecoveryRequest> = {}, holder?: ExportedKeyPair): Promise<RecoveryResponse> {
  const challenge = await post({ action: 'challenge', recoveryId: keys.id, forAction: action });
  const request: RecoveryRequest = { ...input, action, recoveryId: keys.id, recoveryPublicKey: keys.signing.publicKeyJwk, revision: input.revision ?? 0, nonce: challenge.nonce };
  const message = recoverySigningText(request);
  return post({ request, recoverySignature: await signString(keys.signing.privateKeyJwk, message), ...(holder ? { holderSignature: await signString(holder.privateKeyJwk, message) } : {}) });
}

export async function saveAccountBackup(phraseInput: string, vaultPassphrase: string): Promise<RecoveryStatus> {
  const phrase = normalizeRecoveryPhrase(phraseInput);
  const keys = await recoveryKeys(phrase);
  let revision = 0;
  try { revision = (await signedRequest(keys, 'read')).revision; } catch (error) { if (!(error instanceof RequestError) || error.status !== 404) throw error; }
  const wallet = await ensureHolderKeyPair();
  if (wallet.enrollmentId && !wallet.credential) throw new Error('Finish setting up your pass before creating its recovery backup.');
  const vault = await exportVaultSnapshot(vaultPassphrase, phrase);
  if (!wallet.credential && !vault) throw new Error('Create a Vault or finish setting up your pass before enabling recovery.');
  if (wallet.credential && !wallet.enrollmentId) throw new Error('This pass has no recoverable enrollment. Contact support before enabling recovery.');
  const contents: BackupContents = { version: 1, createdAt: new Date().toISOString(), ...(wallet.credential ? { enrollmentId: wallet.enrollmentId } : {}), ...(vault ? { vault } : {}) };
  const backup = await encryptBackup(keys.encryption, keys.id, contents);
  if (backup.ciphertext.length > MAX_BACKUP_BYTES) throw new Error('Your encrypted backup exceeds the current 32 MB limit. Recovery has not been enabled or updated.');
  // Verify our own backup before publishing it.
  await decryptBackup(keys.encryption, keys.id, backup);
  const result = await signedRequest(keys, 'save', { revision, backup, holderPublicKey: wallet.holderKeyPair!.publicKeyJwk, ...(wallet.credential ? { enrollmentId: wallet.enrollmentId } : {}) }, wallet.holderKeyPair);
  const status = { recoveryId: keys.id, savedAt: result.savedAt, revision: result.revision, hasVault: Boolean(vault), hasPass: Boolean(wallet.credential) };
  await writeRecoveryLocal('status', status);
  return status;
}

export async function loadAccountBackup(phrase: string): Promise<LoadedBackup> {
  const keys = await recoveryKeys(phrase);
  const response = await signedRequest(keys, 'read');
  if (!response.backup) throw new Error('Recovery backup is missing.');
  const contents = await decryptBackup(keys.encryption, keys.id, response.backup) as BackupContents;
  if (contents?.version !== 1 || typeof contents.createdAt !== 'string' || (!contents.vault && !contents.enrollmentId)) throw new Error('Invalid recovery backup.');
  return { keys, response, contents };
}

export async function restoreAccountBackup(loaded: LoadedBackup, phrase: string, newVaultPassphrase: string): Promise<void> {
  const previous = await loadWalletState();
  const pending = await readRecoveryLocal<PendingRestore>('pending');
  if (pending && pending.recoveryId !== loaded.keys.id) throw new Error('A different recovery is unfinished in this browser. Use a fresh browser profile.');
  if ((previous.holderKeyPair || previous.credential || previous.enrollmentId) && (!pending || previous.holderKeyPair?.publicKeyJwk.x !== pending.holder.publicKeyJwk.x)) throw new Error('This browser already has a wallet. Use a fresh browser profile so it is not overwritten.');
  const vaultStatus = await VaultV2.status();
  if (vaultStatus !== 'none' && !pending) throw new Error('This browser already has a Vault. Use a fresh browser profile so it is not overwritten.');
  // Validate and authenticate the whole snapshot before server revocation.
  const prepared = loaded.contents.vault ? await prepareVaultRestore(loaded.contents.vault, normalizeRecoveryPhrase(phrase), newVaultPassphrase) : undefined;
  const operation = pending ?? { recoveryId: loaded.keys.id, operationId: crypto.randomUUID(), holder: await generateKeyPair() };
  // Retain only the replacement device key for crash-safe retries, never the phrase.
  await writeRecoveryLocal('pending', operation);
  const result = await signedRequest(loaded.keys, 'restore', { revision: loaded.response.revision, operationId: operation.operationId, holderPublicKey: operation.holder.publicKeyJwk }, operation.holder);
  await saveWalletState({ holderKeyPair: operation.holder, ...(result.credential ? { credential: result.credential, enrollmentId: result.enrollmentId, localCredentialStoredAt: new Date().toISOString() } : {}) });
  if (prepared) await importVaultSnapshot(prepared, operation.operationId);
  await writeRecoveryLocal('status', { recoveryId: loaded.keys.id, revision: result.revision, savedAt: result.savedAt, hasVault: Boolean(prepared), hasPass: Boolean(result.credential) });
  await writeRecoveryLocal('pending');
}
