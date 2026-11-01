/** Fictional, versioned workflow fixtures. These are not real recipient or legal rules. */
export const requirements = {
  'Certified copy': 'I have inspected the presented original and confirm that this is a true copy of that document.',
  'Identity / photograph confirmation': 'I have completed the required identity checks and confirm that the photograph is a true likeness of the person presented.',
  'Witness a signature': 'I witnessed the person presented sign this document.',
  'Professional declaration': 'I have reviewed the supporting material and made the professional declaration requested in this document.'
} as const;
export type ValidationType = keyof typeof requirements;

export const recipients = [
  { id: 'northstar', label: 'Northstar College — fictional' },
  { id: 'harbour', label: 'Harbour Services — fictional' }
] as const;
export const documentTypes = [
  { id: 'passport-copy', label: 'Passport copy' },
  { id: 'identity-photo', label: 'Identity photograph' },
  { id: 'consent-form', label: 'Consent form' },
  { id: 'professional-declaration', label: 'Professional declaration form' }
] as const;
export const jurisdictions = [
  { id: 'GB-EAW', label: 'England and Wales' },
  { id: 'GB-SCT', label: 'Scotland' }
] as const;
export interface RequirementContext {
  recipientId: string;
  documentType: string;
  jurisdiction: string;
}
export interface Verifier {
  id: string;
  name: string;
  profession: string;
  professionalStatus: 'verified' | 'unverified';
  jurisdictions: readonly string[];
}
export const verifiers: readonly Verifier[] = [
  { id: 'maya', name: 'Dr Maya Evans', profession: 'Dentist', professionalStatus: 'verified', jurisdictions: ['GB-EAW'] },
  { id: 'alex', name: 'Alex Morgan', profession: 'Solicitor', professionalStatus: 'verified', jurisdictions: ['GB-EAW', 'GB-SCT'] },
  { id: 'elena', name: 'Elena Rossi', profession: 'Notary', professionalStatus: 'verified', jurisdictions: ['GB-EAW'] },
  { id: 'sam', name: 'Sam Patel', profession: 'Accountant', professionalStatus: 'verified', jurisdictions: ['GB-EAW'] }
];
export const declineReasons = {
  'requirements-unclear': 'Receiving organisation’s requirements need clarification',
  'not-eligible': 'I do not meet the eligibility requirements',
  'evidence-missing': 'Required evidence or original document is unavailable',
  'identity-not-established': 'I cannot establish the identity or likeness required',
  'cannot-attest': 'I cannot truthfully make the requested statement',
  'specialist-required': 'A specialist or different validation process is required'
} as const;
export type DeclineReason = keyof typeof declineReasons;
export interface EvidenceCheck {
  id: string;
  label: string;
}
export interface CheckMethod {
  mode: 'in_person' | 'document_review';
  title: string;
  instructions: string;
  preparation: string;
}
export interface PolicySnapshot {
  id: string;
  version: number;
  mode: 'fictional-prototype';
  source: string;
  context: RequirementContext;
  recipientLabel: string;
  documentLabel: string;
  jurisdictionLabel: string;
  validationType: ValidationType;
  statement: string;
  eligibleProfessions: readonly string[];
  evidence: readonly EvidenceCheck[];
  // Absent on historical version 1 policies.
  checkMethod?: CheckMethod;
}
interface Policy extends PolicySnapshot {
  lifecycle: 'active' | 'retired';
}
const baseEvidence: EvidenceCheck[] = [
  { id: 'recipient-instructions', label: 'I checked the receiving organisation’s instructions for this document and jurisdiction.' },
  { id: 'professional-eligibility', label: 'I confirmed my professional standing and eligibility for this specific request.' }
];
const evidenceByType: Record<ValidationType, EvidenceCheck[]> = {
  'Certified copy': [{ id: 'original-inspected', label: 'I inspected the presented original and compared every page with the uploaded copy.' }],
  'Identity / photograph confirmation': [
    { id: 'identity-established', label: 'I completed the identity checks required by the receiving organisation.' },
    { id: 'likeness-confirmed', label: 'I compared the photograph with the person presented and confirmed the likeness.' }
  ],
  'Witness a signature': [
    { id: 'signer-identified', label: 'I established the signer’s identity as required by the receiving organisation.' },
    { id: 'signature-witnessed', label: 'I personally witnessed the signature on this document.' }
  ],
  'Professional declaration': [
    { id: 'supporting-material', label: 'I reviewed the supporting material required for this declaration.' },
    { id: 'within-competence', label: 'The requested declaration is within my professional competence.' }
  ]
};
function fixture(
  id: string, recipientId: string, documentType: string, jurisdiction: string,
  validationType: ValidationType, eligibleProfessions: string[], extra: EvidenceCheck[] = []
): Policy {
  return {
    id, version: 1, lifecycle: 'active', mode: 'fictional-prototype',
    source: 'Zik prototype fixture — invented recipient requirements; not researched acceptance rules.',
    context: { recipientId, documentType, jurisdiction },
    recipientLabel: recipients.find(r => r.id === recipientId)!.label,
    documentLabel: documentTypes.find(d => d.id === documentType)!.label,
    jurisdictionLabel: jurisdictions.find(j => j.id === jurisdiction)!.label,
    validationType, statement: requirements[validationType], eligibleProfessions,
    evidence: [...baseEvidence, ...evidenceByType[validationType], ...extra]
  };
}
const versionOnePolicies: readonly Policy[] = [
  fixture('northstar-passport-eaw', 'northstar', 'passport-copy', 'GB-EAW', 'Certified copy', ['Solicitor', 'Notary', 'Dentist', 'Accountant']),
  fixture('harbour-passport-eaw', 'harbour', 'passport-copy', 'GB-EAW', 'Certified copy', ['Notary']),
  fixture('northstar-passport-sct', 'northstar', 'passport-copy', 'GB-SCT', 'Certified copy', ['Solicitor']),
  fixture('northstar-photo-eaw', 'northstar', 'identity-photo', 'GB-EAW', 'Identity / photograph confirmation', ['Solicitor', 'Dentist'], [
    { id: 'personal-knowledge', label: 'I personally know the applicant as required by this fictional recipient’s instructions.' }
  ]),
  fixture('northstar-consent-eaw', 'northstar', 'consent-form', 'GB-EAW', 'Witness a signature', ['Solicitor', 'Notary']),
  fixture('harbour-declaration-eaw', 'harbour', 'professional-declaration', 'GB-EAW', 'Professional declaration', ['Solicitor', 'Accountant'])
];
const checkMethods: Record<ValidationType, CheckMethod> = {
  'Certified copy': {
    mode: 'in_person', title: 'In-person original inspection',
    instructions: 'For this example, the verifier must inspect the original document in person and compare it with your uploaded copy.',
    preparation: 'Bring the original document and the copy you want validated. An upload alone does not complete the original inspection.'
  },
  'Identity / photograph confirmation': {
    mode: 'in_person', title: 'In-person identity and photograph check',
    instructions: 'For this example, meet the verifier so they can check your identity and compare the photograph with you.',
    preparation: 'Bring the photograph and supporting identity documents requested by the verifier.'
  },
  'Witness a signature': {
    mode: 'in_person', title: 'In-person witnessing appointment',
    instructions: 'The verifier must be physically present and observe you sign. Reviewing an already signed upload does not count as witnessing.',
    preparation: 'Bring the unsigned document and the requested identity evidence. Do not sign before the appointment.'
  },
  'Professional declaration': {
    mode: 'document_review', title: 'Review of supporting documents',
    instructions: 'This example allows the verifier to review the supporting documents without an in-person appointment.',
    preparation: 'Provide the supporting material requested for the declaration. If it is insufficient, the verifier must ask for clarification or decline.'
  }
};
// Preserve the original contracts for historical records; new requests use version 2.
export const policies: readonly Policy[] = [
  ...versionOnePolicies.map(policy => ({ ...policy, lifecycle: 'retired' as const })),
  ...versionOnePolicies.map(policy => ({
    ...policy, version: 2,
    checkMethod: checkMethods[policy.validationType],
    evidence: [
      ...policy.evidence,
      ...(checkMethods[policy.validationType].mode === 'in_person' ? [{
        id: 'in-person-appointment',
        label: policy.validationType === 'Witness a signature'
          ? 'I attended the in-person appointment and observed the customer sign this document in my physical presence.'
          : 'I completed the required checks with the customer at an in-person appointment.'
      }] : [])
    ]
  }))
];
function sameContext(a: RequirementContext, b: RequirementContext) {
  return a.recipientId === b.recipientId && a.documentType === b.documentType && a.jurisdiction === b.jurisdiction;
}
export type PolicyResolution =
  | { status: 'matched'; policy: PolicySnapshot }
  | { status: 'needs_clarification'; reason: string; suggestedType?: ValidationType };
export function resolvePolicy(context: RequirementContext, requested: ValidationType | 'Not sure'): PolicyResolution {
  if (!context.recipientId || !context.documentType || !context.jurisdiction) {
    return { status: 'needs_clarification', reason: 'Select a receiving organisation, document type and jurisdiction.' };
  }
  const matches = policies.filter(p => p.lifecycle === 'active' && sameContext(p.context, context));
  // No fallback to broad profession/type rules when the recipient policy is absent or ambiguous.
  if (matches.length !== 1) return { status: 'needs_clarification', reason: 'No unambiguous prototype policy covers this combination. Confirm the recipient’s requirements before creating a request. This does not mean an in-person appointment is required.' };
  const match = matches[0];
  if (requested !== 'Not sure' && match.validationType !== requested) {
    return { status: 'needs_clarification', reason: `This fictional recipient policy requires ${match.validationType.toLowerCase()}. Your selected validation type does not match.`, suggestedType: match.validationType };
  }
  const { lifecycle, ...snapshot } = match;
  void lifecycle;
  return { status: 'matched', policy: structuredClone(snapshot) };
}
export function eligibility(policy: PolicySnapshot, verifier: Verifier): { eligible: boolean; reason: string } {
  if (verifier.professionalStatus !== 'verified') return { eligible: false, reason: 'Professional standing is not verified in this demo.' };
  if (!policy.eligibleProfessions.includes(verifier.profession)) return { eligible: false, reason: 'Profession is not included in this recipient policy.' };
  if (!verifier.jurisdictions.includes(policy.context.jurisdiction)) return { eligible: false, reason: 'No simulated professional coverage for this jurisdiction.' };
  return { eligible: true, reason: 'Example policy match · Evidence checks still required' };
}
/** Compare all contract content, not only the identifier, before accepting a snapshot. */
export function isKnownPolicy(snapshot: PolicySnapshot, activeOnly = false) {
  return policies.some(p => {
    if (activeOnly && p.lifecycle !== 'active') return false;
    const { lifecycle, ...known } = p;
    void lifecycle;
    return JSON.stringify(snapshot) === JSON.stringify(known);
  });
}
