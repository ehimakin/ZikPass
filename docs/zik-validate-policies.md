# Zik Validate requirement and eligibility contract

## Purpose and scope

A validation request must identify the receiving organisation, document category,
jurisdiction, exact attestation and policy version before a verifier is selected.
The contract is implemented in `lib/validate/policy.ts` and enforced by
`lib/validate/model.ts` as well as the customer/verifier UI.

Every included policy is a **fictional prototype fixture**. Northstar College and
Harbour Services are invented organisations. The professions, jurisdiction coverage
and evidence requirements below are invented examples, not assertions about real
acceptance or legal rules. No external requirements have been researched or approved.

## Example coverage, version 2

| Fictional recipient | Document | Jurisdiction scenario | Validation | Example professions |
| --- | --- | --- | --- | --- |
| Northstar College | Passport copy | England and Wales | Certified copy | Solicitor, notary, dentist, accountant |
| Harbour Services | Passport copy | England and Wales | Certified copy | Notary |
| Northstar College | Passport copy | Scotland | Certified copy | Solicitor |
| Northstar College | Identity photograph | England and Wales | Identity / photograph confirmation | Solicitor, dentist |
| Northstar College | Consent form | England and Wales | Witness a signature | Solicitor, notary |
| Harbour Services | Professional declaration form | England and Wales | Professional declaration | Solicitor, accountant |

All other combinations show **Requirements need clarification** and cannot create
a request. This is an unresolved requirement, not a decision that an in-person
appointment is needed. The prototype has no clarification service or appointment booking.
Selecting **Not listed / not sure** for any context field also takes this path.

## Resolution and eligibility

1. Require all three context fields; do not infer jurisdiction or recipient from a filename.
2. Find exactly one active policy with that context. Missing or ambiguous coverage
   stops the flow. There is no fallback to broad profession-level eligibility.
3. For an explicit validation type, require agreement with the policy. A conflict
   stops the flow for clarification; it is never silently overwritten. A customer
   can explicitly choose **Use [required validation type]** to accept the matched
   requirement and see its check arrangements.
4. For **Not sure**, present the matched policy's type as a simulated recommendation.
   For example, a consent form selects witnessing rather than always selecting a copy.
5. Match the verifier's simulated professional standing, profession and jurisdiction
   coverage. All three must pass. The UI explains failed matches.
6. Required evidence checks, including personal knowledge where applicable, must be
   confirmed at review. A catalogue match alone does not establish eligibility.

Changing context or validation type clears the verifier selection. New requests are
checked again at the persistence boundary, independently of disabled UI controls.

## Versioned policy snapshot

A snapshot contains:

- Stable policy `id` and integer `version`.
- `mode: fictional-prototype` and a source statement identifying the fixture.
- Recipient/document/jurisdiction IDs and display labels.
- Validation type and exact statement.
- Eligible professions.
- Required evidence check IDs and their exact wording.
- `checkMethod`: in-person or document review, purpose, instructions and preparation.

New requests capture the entire resolved snapshot. Submission rejects an unknown,
modified or inactive snapshot, a mismatched statement/type, an ineligible verifier,
or a request that attempts to start in a completed state.

Policy definitions additionally have an `active` or `retired` lifecycle. Changing
policy wording or criteria requires a new version; existing versions must remain
in the catalogue unchanged. Retire the superseded version before activating its
replacement. The resolver requires one active match. Never overwrite the evidence
wording or statement in a historical snapshot.

Retirement stops new submissions against that version. Existing requests with explicit check arrangements may finish under their recognised
pinned version, subject to current simulated verifier standing and jurisdiction
coverage. Version 1 did not specify check arrangements: its completed records remain
readable, but its pending requests must be recreated using version 2 before validation. Emergency withdrawal/revocation is not implemented; it
would need a distinct status and an explicit rule for pending requests.

## Check arrangements, separate from clarification

The method is shown before verifier selection and retained on the customer, verifier
and lookup record:

- Signature witnessing: **In-person witnessing appointment**. Bring an unsigned
  document; the verifier must physically observe the act of signing. Reviewing a
  signed upload is not witnessing.
- Certified copy: **In-person original inspection** in these fixtures. Bring the
  original and copy for comparison.
- Identity/photo: **In-person identity and photograph check** in this fixture.
- Professional declaration: **Review of supporting documents**, with no appointment
  required in this fictional example.

These are prototype arrangements, not universal legal rules. No appointment is booked.
For every in-person policy, the verifier must additionally confirm completion of the
simulated appointment. The required `in-person-appointment` evidence ID is checked
inside the same persistence transaction as the other evidence. Reviewing an upload
alone cannot complete an in-person validation. Completed records display the
simulated confirmation. There is no real appointment or signing capture in this demo.

## Evidence and decisions

All policies require checking recipient instructions and professional eligibility.
Additional checks are scoped to the attestation:

- Certified copy: inspect the original and compare every page.
- Identity/photo: establish identity and compare likeness; the example Northstar
  policy also requires personal knowledge of the applicant.
- Witnessing: establish signer identity and personally witness the signature.
- Declaration: inspect supporting material and confirm professional competence.

The verifier must review the uploaded file, confirm **every** required check and
separately acknowledge the attestation. The persistence transaction rejects missing,
extra or duplicate evidence IDs. On success, it stores each check ID with the serverless
browser decision timestamp; the pinned snapshot supplies the original wording.
These confirmations are simulated declarations, not independently collected evidence.

Declining requires one controlled reason:

| Code | Meaning |
| --- | --- |
| `requirements-unclear` | Receiving organisation’s requirements need clarification |
| `not-eligible` | Verifier does not meet eligibility requirements |
| `evidence-missing` | Required evidence or original is unavailable |
| `identity-not-established` | Required identity or likeness cannot be established |
| `cannot-attest` | Verifier cannot truthfully make the requested statement |
| `specialist-required` | Different expertise or process is required |

The decline reason and timestamp remain visible to the customer. Decline and
validation are terminal: repeated actions cannot replace the original decision.

## Historical records and verification

The IndexedDB layout remains compatible with the previous prototype; new fields are
additive. Old completed records remain viewable and are explicitly labelled as having
no captured policy. Pending old records, including version 1 policies without check arrangements, may
be previewed or declined, but cannot be validated. The customer must create a new request with explicit context. The app does
not silently invent a policy or evidence for a historical request.

The customer record, verifier record, lookup result and downloaded JSON receipt all
carry the same saved policy and evidence. The public-verification concept remains
local to the browser. Stored policy metadata does not authenticate a record, establish
professional status or guarantee a statement's truth.

## Before adding a real recipient policy

The next product decision is which real receiving organisation and document to pilot.
For that selected scope, capture authoritative recipient instructions, source URL or
provided document, publication/effective dates and the exact jurisdiction. Resolve
ambiguities with the recipient before implementing a real policy.

A future reviewed policy record should identify its owner and reviewer, approval and
review dates, authoritative source version, effective period, acceptance constraints,
permitted verification methods, required evidence retention and escalation route.
Any change to the attestation or eligibility should have a versioned review and test
matrix. Do not turn the fixture catalogue into production rules by relabelling it.
Authentication, professional-register checks, legal acceptance, cryptographic issuance
and a real manual-review service remain outside this prototype.
