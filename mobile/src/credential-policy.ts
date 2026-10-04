import type { SignedCredential } from '../../lib/shared/types';
export function validCredential(value: unknown): value is SignedCredential {
  if (!value || typeof value !== 'object') return false;
  const c = value as SignedCredential;
  return c.algorithm === 'Ed25519' && typeof c.zignature === 'string' && /^[A-Za-z0-9_-]{86}$/.test(c.zignature)
    && c.payload?.over18 === true && typeof c.payload.credential_id === 'string'
    && c.payload.subject_public_key?.kty === 'OKP' && c.payload.subject_public_key.crv === 'Ed25519'
    && typeof c.payload.subject_public_key.x === 'string' && /^[A-Za-z0-9_-]{43}$/.test(c.payload.subject_public_key.x)
    && c.payload.subject_public_key.d === undefined
    && [c.payload.issued_at, c.payload.activates_at, c.payload.expires_at].every(value => typeof value === 'string' && Number.isFinite(Date.parse(value)))
    && Date.parse(c.payload.expires_at) > Date.parse(c.payload.activates_at);
}
export function credentialStatus(credential: SignedCredential, now = Date.now()): 'Expired' | 'Pending' | 'Saved' {
  return Date.parse(credential.payload.expires_at) <= now ? 'Expired' : Date.parse(credential.payload.activates_at) > now ? 'Pending' : 'Saved';
}
