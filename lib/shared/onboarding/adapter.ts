import { boundedString, strictObject } from '@/lib/shared/vault';
import type { Application } from '@/lib/shared/vault/model';

/**
 * The boundary between "the user has prepared an application" and "an authorised
 * checker has verified them".
 *
 * Zik has not specified the real checks yet, so nothing in this repository can
 * approve an application. That is deliberate: issuance authority belongs to an
 * issuer's signature over a specific application, holder key and evidence snapshot,
 * never to a flag a client can set. The pending adapter below refuses every outcome
 * for exactly that reason, and a real adapter must verify a signature rather than
 * trusting a status string.
 */
export const ONBOARDING_CONTRACT_VERSION = 'zik-onboarding/1';

export type OnboardingStartRequest = {
  application_id: string;
  policy_version: string;
  /** Digests, not values: the adapter learns what was agreed, not what it says. */
  claim_set_digest: string;
  evidence_digest: string;
  holder_key_thumbprint: string;
};

export type OnboardingState = 'unavailable' | 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export type OnboardingSession = { adapter: string; reference: string; state: OnboardingState; updated_at: string; message: string };

export type OnboardingExpectation = OnboardingStartRequest & { reference: string };

export type OnboardingOutcome =
  | { accepted: false; reason: string }
  | { accepted: true; issuer: string; issued_at: string; expires_at: string; credential: unknown };

export interface OnboardingAdapter {
  readonly id: string;
  start(request: OnboardingStartRequest): Promise<OnboardingSession>;
  status(reference: string): Promise<OnboardingSession>;
  cancel(reference: string): Promise<OnboardingSession>;
  /** Must verify an issuer signature bound to the expectation before accepting anything. */
  receive(outcome: unknown, expectation: OnboardingExpectation): Promise<OnboardingOutcome>;
}

/**
 * The adapter in use until Zik defines the real onboarding process. It records that
 * an application is waiting and refuses every outcome, including a well-formed one,
 * because no issuer is authorised yet.
 */
export const pendingOnboardingAdapter: OnboardingAdapter = {
  id: 'pending-owner-specification',
  async start(request) {
    return {
      adapter: this.id,
      reference: `pending:${request.application_id}`,
      state: 'unavailable',
      updated_at: new Date().toISOString(),
      message: 'Zik ID identity checks are not available yet. Your application is saved on this device and nothing has been shared.',
    };
  },
  async status(reference) {
    return { adapter: this.id, reference, state: 'unavailable', updated_at: new Date().toISOString(), message: 'Waiting for Zik to publish the identity checks for Zik ID.' };
  },
  async cancel(reference) {
    return { adapter: this.id, reference, state: 'cancelled', updated_at: new Date().toISOString(), message: 'Application withdrawn on this device.' };
  },
  async receive() {
    return { accepted: false, reason: 'No issuer is authorised to approve a Zik ID yet, so no approval can be accepted.' };
  },
};

/**
 * Rejects an outcome that does not match the application it claims to be about,
 * before any signature work: a stale approval for changed claims or a different
 * holder is not merely invalid, it is the case this check exists for.
 */
export function bindsToApplication(outcome: unknown, expectation: OnboardingExpectation): boolean {
  try {
    const record = strictObject(outcome, ['application_id', 'claim_set_digest', 'evidence_digest', 'holder_key_thumbprint', 'reference'], ['issuer', 'issued_at', 'expires_at', 'signature', 'credential']);
    return boundedString(record.application_id, 64) === expectation.application_id
      && boundedString(record.claim_set_digest, 128) === expectation.claim_set_digest
      && boundedString(record.evidence_digest, 128) === expectation.evidence_digest
      && boundedString(record.holder_key_thumbprint, 128) === expectation.holder_key_thumbprint
      && boundedString(record.reference, 200) === expectation.reference;
  } catch { return false; }
}

/** A stable digest of what the user agreed to, used to spot later changes. */
export function claimSetDigest(application: Pick<Application, 'claim_snapshot' | 'policy_version'>): string {
  const entries = Object.entries(application.claim_snapshot).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([application.policy_version, entries]).slice(0, 512);
}

export function evidenceDigest(application: Pick<Application, 'evidence_snapshot'>): string {
  const entries = application.evidence_snapshot.map(entry => [entry.document_id, entry.content_hash, [...entry.observation_ids].sort()]).sort();
  return JSON.stringify(entries).slice(0, 512);
}

/** An application is stale once the evidence or claims behind it have moved on. */
export function isStale(application: Application, current: { claim_snapshot: Application['claim_snapshot']; evidence_snapshot: Application['evidence_snapshot']; policy_version: string }): boolean {
  return claimSetDigest(application) !== claimSetDigest(current) || evidenceDigest(application) !== evidenceDigest(current);
}
