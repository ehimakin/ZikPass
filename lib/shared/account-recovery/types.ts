import type { SignedCredential } from '@/lib/shared/types';

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
export type RecoveryCiphertext = { version: 1; iv: string; ciphertext: string };
export type RecoveryAction = 'save' | 'read' | 'restore';
export type RecoveryRequest = {
  action: RecoveryAction;
  recoveryId: string;
  recoveryPublicKey: JsonWebKey;
  nonce: string;
  revision: number;
  holderPublicKey?: JsonWebKey;
  enrollmentId?: string;
  backup?: RecoveryCiphertext;
  operationId?: string;
};
export type SignedRecoveryRequest = { request: RecoveryRequest; recoverySignature: string; holderSignature?: string };
export type RecoveryRecord = {
  id: string;
  recoveryPublicKey: JsonWebKey;
  holderPublicKey: JsonWebKey;
  enrollmentId?: string;
  backup: RecoveryCiphertext;
  revision: number;
  savedAt: string;
  recoveredAt?: string;
  lastRestore?: { operationId: string; holderX: string; credential?: SignedCredential };
};
export type RecoveryChallenge = { nonce: string; recoveryId: string; action: RecoveryAction; expiresAt: number };
export type RevokedHolder = { credentialId: string; holderX: string };
export type RecoveryResponse = {
  revision: number;
  savedAt: string;
  backup?: RecoveryCiphertext;
  credential?: SignedCredential;
  enrollmentId?: string;
};
