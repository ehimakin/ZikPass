import { compareAddresses, compareDates, compareNames, type Agreement } from '@/lib/shared/analysis/text';
import { CLAIM_FIELDS, type Claim, type ClaimField, type ClaimSource, type Observation, type ObservationField } from './model';

/**
 * Claims and the evidence under them.
 *
 * Only an observation the user has accepted can support a claim. Accepting an OCR
 * proposal records that the user agreed the text was read correctly — it is not a
 * check that the document is genuine or theirs, and nothing here ever sets an
 * attestation.
 */
const OBSERVATION_TO_CLAIM: Partial<Record<ObservationField, ClaimField>> = {
  legal_name: 'legal_name',
  date_of_birth: 'date_of_birth',
  address: 'address',
};

export function claimFieldFor(field: ObservationField): ClaimField | null {
  return OBSERVATION_TO_CLAIM[field] ?? null;
}

export function agreement(field: ClaimField, claimValue: string | null, observed: string | null): Agreement {
  if (field === 'date_of_birth') return compareDates(claimValue, observed);
  if (field === 'address') return compareAddresses(claimValue, observed);
  return compareNames(claimValue, observed);
}

export function emptyClaim(field: ClaimField, value: string | null, source: ClaimSource, now: Date): Claim {
  return { field, value, source, updated_at: now.toISOString(), supporting_observation_ids: [], conflicting_observation_ids: [], attestations: [] };
}

/**
 * Recomputes which accepted observations agree with the claim's current value.
 * Editing a value therefore drops the support the old value had, rather than
 * carrying it across to something the evidence never said.
 */
export function recomputeClaim(claim: Claim, observations: Observation[]): Claim {
  const supporting: string[] = [];
  const conflicting: string[] = [];
  for (const observation of observations) {
    if (observation.review !== 'accepted' || claimFieldFor(observation.field) !== claim.field) continue;
    const verdict = agreement(claim.field, claim.value, observation.normalised);
    if (verdict === 'match') supporting.push(observation.id);
    else if (verdict === 'different') conflicting.push(observation.id);
  }
  return { ...claim, supporting_observation_ids: supporting, conflicting_observation_ids: conflicting };
}

export function recomputeClaims(claims: Claim[], observations: Observation[]): Claim[] {
  return claims.map(claim => recomputeClaim(claim, observations));
}

export function claimByField(claims: Claim[], field: ClaimField): Claim | undefined {
  return claims.find(claim => claim.field === field);
}

export type ProposalStatus = 'matches' | 'different' | 'missing' | 'uncertain';

/** What the review screen shows next to a proposal, before the user decides anything. */
export function proposalStatus(field: ClaimField, claimValue: string | null, observation: Observation): ProposalStatus {
  if (observation.normalised === null) return 'uncertain';
  if (!claimValue) return 'missing';
  if (observation.ambiguities.length) return 'uncertain';
  const verdict = agreement(field, claimValue, observation.normalised);
  return verdict === 'match' ? 'matches' : verdict === 'different' ? 'different' : 'uncertain';
}

export const ALL_CLAIM_FIELDS = CLAIM_FIELDS;
