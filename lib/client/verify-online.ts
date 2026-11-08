import { verifyPresentationBundle } from '@/lib/shared/verifier-sdk';
import type { PresentationBundle, VerificationResult } from '@/lib/shared/types';
/** Hosted verification fails closed if current revocation status cannot be read. */
export async function verifyOnlinePresentation(bundle: PresentationBundle, issuerPublicKey: JsonWebKey, now = new Date()): Promise<VerificationResult> {
  const result = await verifyPresentationBundle(bundle, issuerPublicKey, now);
  if (result.decision !== 'allow') return result;
  const response = await fetch('/api/credential/status', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentialId: bundle.credential.payload.credential_id, holderX: bundle.credential.payload.subject_public_key.x }) });
  if (!response.ok) throw new Error('Cannot check current pass status. Try again when online.');
  const status = await response.json();
  return { ...result, decision: status.revoked === false ? 'allow' : 'deny' };
}
