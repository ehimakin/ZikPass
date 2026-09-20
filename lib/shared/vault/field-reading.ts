import { agreement, claimFieldFor } from './claims';
import type { ClaimField, Observation } from './model';

/** A document text match is separate from issuer verification and human acceptance. */
export function fieldReading(field: ClaimField, value: string, observations: Observation[]) {
  const relevant = observations.filter(o => o.review !== 'rejected' && claimFieldFor(o.field) === field);
  const clear = relevant.filter(o => o.normalised && !o.ambiguities.length && (o.recognition_quality === null || o.recognition_quality >= 80));
  if (value.trim()) {
    const matches = clear.filter(o => agreement(field, value, o.normalised) === 'match');
    const conflicts = clear.filter(o => agreement(field, value, o.normalised) === 'different');
    return { suggestion: undefined, matches, conflicts, uncertain: relevant.length > clear.length };
  }
  const first = clear[0];
  const agrees = first && clear.every(o => agreement(field, first.normalised, o.normalised) === 'match');
  return { suggestion: agrees ? first : undefined, matches: [], conflicts: agrees ? [] : clear, uncertain: relevant.length > clear.length };
}
