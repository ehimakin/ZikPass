import { agreement, claimByField } from '@/lib/shared/vault/claims';
import type { Claim, ClaimField, DocumentClass, Observation, VaultDocument } from '@/lib/shared/vault/model';

/**
 * Prototype Zik ID readiness policy, version 1.
 *
 * This answers one question: has the user prepared enough reviewed evidence to
 * start an application? It is a product default chosen by Zik, not a regulatory
 * assurance level, and it is deliberately easy to replace — the owner will define
 * the real onboarding checks later.
 *
 * What it cannot do: a forged document that reads cleanly satisfies text matching
 * here exactly as a genuine one would. Deciding whether a document is authentic and
 * belongs to the person holding it is the later verification stage's job, not this
 * function's.
 */
export const READINESS_POLICY_VERSION = 'zik-id-readiness/1';

/** A supporting address document is treated as current for this long. */
export const ADDRESS_EVIDENCE_MAX_AGE_DAYS = 90;

const PHOTO_ID_CLASSES: DocumentClass[] = ['passport', 'driving_licence'];

export type ReadinessStatus = 'not_ready' | 'needs_review' | 'ready_to_apply';

export type RequirementId = 'active_pass' | 'primary_photo_id' | 'independent_support' | 'proposals_reviewed' | 'no_material_conflicts';

export type ReasonCode =
  | 'no_active_pass'
  | 'no_photo_id_document'
  | 'photo_id_expired'
  | 'photo_id_incomplete'
  | 'primary_evidence_unreviewed'
  | 'no_supporting_document'
  | 'supporting_evidence_unreviewed'
  | 'supporting_address_out_of_date'
  | 'duplicate_evidence_only'
  | 'conflict_legal_name'
  | 'conflict_date_of_birth'
  | 'conflict_address';

export type Requirement = { id: RequirementId; satisfied: boolean; reasons: ReasonCode[]; document_ids: string[] };

export type ReadinessInput = {
  documents: VaultDocument[];
  observations: Observation[];
  claims: Claim[];
  /** The existing Zik Pass, unchanged by this sprint. Its age assertion stands on its own. */
  pass: { active: boolean };
  now: Date;
};

export type ReadinessResult = {
  policy_version: typeof READINESS_POLICY_VERSION;
  status: ReadinessStatus;
  requirements: Requirement[];
  reasons: ReasonCode[];
  next_actions: string[];
  evidence: { primary_document_id: string | null; supporting_document_id: string | null };
};

/**
 * Same bytes, or the same real-world document scanned twice, is one piece of
 * evidence. The head of a group carries no `group_id` of its own, so a group is
 * matched from either side, and identical bytes count regardless of grouping.
 *
 * This detects the duplicates we can see. It does not detect a genuinely different
 * scan of the same document that the user has not grouped, which is why uncertain
 * independence is put to the user rather than assumed.
 */
function evidenceKeys(document: VaultDocument): string[] {
  return [document.group_id ?? document.id, document.content_hash].filter(Boolean);
}

function sameEvidence(a: VaultDocument, b: VaultDocument): boolean {
  const keys = new Set(evidenceKeys(a));
  return evidenceKeys(b).some(key => keys.has(key)) || a.group_id === b.id || b.group_id === a.id;
}

const acceptedFor = (observations: Observation[], documentId: string, field: Observation['field']) =>
  observations.filter(observation => observation.document_id === documentId && observation.field === field && observation.review === 'accepted' && observation.normalised !== null);

const pendingFor = (observations: Observation[], documentId: string) =>
  observations.filter(observation => observation.document_id === documentId && observation.review === 'pending' && ['legal_name', 'date_of_birth', 'address', 'expiry_date'].includes(observation.field));

const claimValue = (claims: Claim[], field: ClaimField) => claimByField(claims, field)?.value ?? null;

function agreesWithClaim(claims: Claim[], field: ClaimField, observations: Observation[]): boolean {
  const value = claimValue(claims, field);
  if (!value) return false;
  return observations.some(observation => agreement(field, value, observation.normalised) === 'match');
}

const daysBetween = (from: string, now: Date) => Math.floor((now.getTime() - Date.parse(from)) / 86400000);

export function evaluateReadiness({ documents, observations, claims, pass, now }: ReadinessInput): ReadinessResult {
  const reasons = new Set<ReasonCode>();
  const analysed = documents.filter(document => document.processing === 'analysed');

  // 1. The Pass is a precondition, and stays an independent age credential.
  const activePass: Requirement = { id: 'active_pass', satisfied: pass.active, reasons: pass.active ? [] : ['no_active_pass'], document_ids: [] };
  if (!pass.active) reasons.add('no_active_pass');

  // 2. Primary evidence: one photo ID with a reviewed name, date of birth and an expiry still in the future.
  const photoIds = analysed.filter(document => PHOTO_ID_CLASSES.includes(document.classification ?? 'unknown'));
  let primary: VaultDocument | null = null;
  let primaryUnreviewed = false;
  let primaryExpired = false;
  let primaryIncomplete = false;
  for (const document of photoIds) {
    const names = acceptedFor(observations, document.id, 'legal_name');
    const births = acceptedFor(observations, document.id, 'date_of_birth');
    const expiries = acceptedFor(observations, document.id, 'expiry_date');
    if (pendingFor(observations, document.id).length) primaryUnreviewed = true;
    if (!names.length || !births.length || !expiries.length) { primaryIncomplete = true; continue; }
    if (!agreesWithClaim(claims, 'legal_name', names) || !agreesWithClaim(claims, 'date_of_birth', births)) { primaryIncomplete = true; continue; }
    const unexpired = expiries.some(observation => observation.normalised !== null && Date.parse(observation.normalised) > now.getTime());
    if (!unexpired) { primaryExpired = true; continue; }
    primary = document;
    break;
  }
  const primaryRequirement: Requirement = { id: 'primary_photo_id', satisfied: Boolean(primary), reasons: [], document_ids: primary ? [primary.id] : [] };
  if (!primary) {
    if (!photoIds.length) primaryRequirement.reasons.push('no_photo_id_document');
    else if (primaryUnreviewed) primaryRequirement.reasons.push('primary_evidence_unreviewed');
    else if (primaryExpired) primaryRequirement.reasons.push('photo_id_expired');
    else if (primaryIncomplete) primaryRequirement.reasons.push('photo_id_incomplete');
    for (const reason of primaryRequirement.reasons) reasons.add(reason);
  }

  // 3. Support must come from a genuinely separate document.
  const others = analysed.filter(document => document.id !== primary?.id && !(primary && sameEvidence(document, primary)));
  const duplicatesOnly = Boolean(primary) && !others.length && analysed.length > 1;
  let supporting: VaultDocument | null = null;
  let supportingUnreviewed = false;
  let addressOutOfDate = false;
  for (const document of others) {
    const names = acceptedFor(observations, document.id, 'legal_name');
    if (pendingFor(observations, document.id).length) supportingUnreviewed = true;
    if (!names.length || !agreesWithClaim(claims, 'legal_name', names)) continue;
    if (agreesWithClaim(claims, 'date_of_birth', acceptedFor(observations, document.id, 'date_of_birth'))) { supporting = document; break; }
    if (agreesWithClaim(claims, 'address', acceptedFor(observations, document.id, 'address'))) {
      const issued = acceptedFor(observations, document.id, 'issue_date').map(observation => observation.normalised).filter((value): value is string => value !== null);
      const recent = issued.some(value => daysBetween(value, now) <= ADDRESS_EVIDENCE_MAX_AGE_DAYS && daysBetween(value, now) >= 0);
      if (recent) { supporting = document; break; }
      addressOutOfDate = true;
    }
  }
  const supportRequirement: Requirement = { id: 'independent_support', satisfied: Boolean(primary && supporting), reasons: [], document_ids: supporting ? [supporting.id] : [] };
  if (!supporting) {
    if (duplicatesOnly) supportRequirement.reasons.push('duplicate_evidence_only');
    else if (addressOutOfDate) supportRequirement.reasons.push('supporting_address_out_of_date');
    // Without a primary every document is still a candidate, so an unreviewed one
    // says nothing about support. Asking for a second document is the honest answer.
    else if (supportingUnreviewed && primary) supportRequirement.reasons.push('supporting_evidence_unreviewed');
    else supportRequirement.reasons.push('no_supporting_document');
    for (const reason of supportRequirement.reasons) reasons.add(reason);
  }

  // 4. Every proposal on the evidence we are relying on has to have been reviewed.
  // Before a primary is settled there is nothing to rely on yet, so anything still
  // waiting counts — otherwise this would report "all reviewed" beside a list of
  // proposals the user has not looked at.
  const relied = primary ? [primary.id, supporting?.id].filter((id): id is string => Boolean(id)) : analysed.map(document => document.id);
  const outstanding = relied.flatMap(id => pendingFor(observations, id));
  const reviewed: Requirement = { id: 'proposals_reviewed', satisfied: outstanding.length === 0, reasons: outstanding.length ? ['primary_evidence_unreviewed'] : [], document_ids: [...new Set(outstanding.map(observation => observation.document_id))] };
  if (outstanding.length) reasons.add('primary_evidence_unreviewed');

  // 5. An unresolved contradiction about who this is blocks the application.
  const conflictReasons: ReasonCode[] = [];
  const conflictDocuments = new Set<string>();
  for (const claim of claims) {
    if (!claim.conflicting_observation_ids.length) continue;
    if (claim.field === 'legal_name') conflictReasons.push('conflict_legal_name');
    if (claim.field === 'date_of_birth') conflictReasons.push('conflict_date_of_birth');
    if (claim.field === 'address') conflictReasons.push('conflict_address');
    for (const id of claim.conflicting_observation_ids) {
      const observation = observations.find(entry => entry.id === id);
      if (observation) conflictDocuments.add(observation.document_id);
    }
  }
  const conflicts: Requirement = { id: 'no_material_conflicts', satisfied: conflictReasons.length === 0, reasons: conflictReasons, document_ids: [...conflictDocuments] };
  for (const reason of conflictReasons) reasons.add(reason);

  const requirements = [activePass, primaryRequirement, supportRequirement, reviewed, conflicts];
  const blocking = requirements.filter(requirement => !requirement.satisfied);
  const reviewable = blocking.every(requirement => requirement.id === 'proposals_reviewed' || requirement.id === 'no_material_conflicts'
    || requirement.reasons.every(reason => reason === 'primary_evidence_unreviewed' || reason === 'supporting_evidence_unreviewed'));

  const status: ReadinessStatus = blocking.length === 0 ? 'ready_to_apply' : reviewable && (primary || photoIds.length) ? 'needs_review' : 'not_ready';

  return {
    policy_version: READINESS_POLICY_VERSION,
    status,
    requirements,
    reasons: [...reasons],
    next_actions: [...reasons].map(nextAction),
    evidence: { primary_document_id: primary?.id ?? null, supporting_document_id: supporting?.id ?? null },
  };
}

/** Plain-language next step for each reason. Kept beside the codes so they cannot drift apart. */
export function nextAction(reason: ReasonCode): string {
  switch (reason) {
    case 'no_active_pass': return 'Set up or renew your Zik Pass on this device.';
    case 'no_photo_id_document': return 'Add a passport or driving licence and let Zik read it.';
    case 'photo_id_expired': return 'The photo ID you added has expired. Add a current one.';
    case 'photo_id_incomplete': return 'Your photo ID did not give a name, date of birth and expiry date you have confirmed.';
    case 'primary_evidence_unreviewed': return 'Review what Zik found in your documents.';
    case 'no_supporting_document': return 'Add a second, different document that shows your name with your date of birth or current address.';
    case 'supporting_evidence_unreviewed': return 'Review what Zik found in your supporting document.';
    case 'supporting_address_out_of_date': return `Add address evidence issued in the last ${ADDRESS_EVIDENCE_MAX_AGE_DAYS} days.`;
    case 'duplicate_evidence_only': return 'Your other documents are copies of the same one. Add a different document.';
    case 'conflict_legal_name': return 'Resolve the difference between the names in your documents.';
    case 'conflict_date_of_birth': return 'Resolve the difference between the dates of birth in your documents.';
    case 'conflict_address': return 'Resolve the difference between the addresses in your documents.';
  }
}
