# Zik Validate prototype

Zik Validate extends the existing customer shell, semantic tokens, rounded cards,
buttons and shared product catalogue. ZikPass remains the primary homepage product.
No API, authentication or remote document storage was introduced.

## Routes

- `/validate`: customer wizard, request history and verifier view.
- `/validate/verify`: local record lookup and optional real file fingerprint comparison.
- `/customer_validate`: existing concept page retained, with a link to the working prototype.

## Demo

1. From `/home` or `/ecosystem`, choose **Explore Zik Validate →**.
2. Choose **Upload document** and select a dummy PDF, PNG, JPEG or WebP (max 20 MB).
3. Select a fictional receiving organisation, document type and jurisdiction, then
   one validation type. **Not sure** recommends the matched policy’s requirement.
   Try Northstar College + Passport copy + England and Wales for Certified copy.
4. Read the saved requirement, statement and evidence checks, then choose one
   fictional verifier. Matches depend on recipient policy and jurisdiction.
   Unsupported or conflicting requirements show **Requirements need clarification**.
   Check arrangements separately explain whether the example requires an in-person
   appointment. Witnessing requires bringing an unsigned document and observing signing.
5. Continue with that verifier. The request has an ID, hash, timestamp and Awaiting verifier status.
6. **Switch to verifier view**, then **Review document**. The actual local file is previewed.
7. Choose **Validate**, confirm every required evidence check (including simulated appointment completion
   for in-person checks) and separately
   acknowledge the attestation, then **Validate document**. Alternatively choose
   **Cannot validate**, select a reason and **Confirm decline**.
8. **Return to customer** to see the validation seal and record.
9. **View validation**, then **Check validation**. Compare the original file to get
   a fingerprint match; selecting different bytes produces a mismatch.
10. **Download prototype receipt** produces JSON evidence, leaving the original untouched.

Reloading preserves submitted requests and files. Draft wizard state stays in React
memory. Request history allows revisiting earlier requests. Clear browser site data
to delete the prototype records and documents.

## Data and safeguards

`lib/validate/model.ts` stores records and original file blobs in a separate
`zik-validate-prototype` IndexedDB database. Fields: `id`, `documentName`,
`documentHash`, `validationType`, `validationStatement`, `customer`, `verifierId`,
`status`, `createdAt`, optional `validatedAt`, and `file`. New requests also pin
a versioned `policy` snapshot; completed reviews retain `evidence` confirmations,
and declines retain `declineReason` and `declinedAt`.

Types and verifiers use native radio controls and scalar state. The submit guard
prevents repeated clicks, IndexedDB add rejects duplicate IDs, and transactional
status changes prevent concurrent revalidation or modification of completed or
declined requests. Validation requires review, every policy evidence check and
explicit acknowledgement. See [the policy contract](zik-validate-policies.md).
SHA-256 uses Web Crypto over the uploaded bytes. Local file blobs are retained
without encryption in this isolated prototype database, not in the encrypted Vault.

The recommendation, professional status, customer, verifier identities, eligibility
and attestations are simulated. No checks of originals, professional registers,
identity or legal acceptance occur. Local records can be edited by their owner;
ID recognition is not proof of authenticity. The public verification concept only
recognises this browser’s records and never reports document integrity without a
fresh hash comparison.

## Files

Added:
- `app/validate/page.tsx`
- `app/validate/verify/page.tsx`
- `components/validate/validate-screen.tsx`
- `components/validate/verify-screen.tsx`
- `components/validate/validation-record.tsx`
- `components/validate/workflow.tsx`
- `lib/validate/model.ts`
- `lib/validate/policy.ts`
- `components/validate/policy-context.tsx`
- `components/validate/policy-summary.tsx`
- `docs/zik-validate-policies.md`
- `tests/validate.test.ts`
- `e2e/validate.spec.ts`
- `docs/zik-validate-prototype.md`

Modified:
- `lib/shared/product-catalogue.ts` — shared homepage/ecosystem product copy and destination.
- `components/customer/product-family.tsx` — prototype CTA and availability copy.
- `components/customer/customer-shell.tsx` — navigation entry.
- `app/ecosystem/page.tsx` — attestation concept and visual workflow.
- `app/customer_validate/page.tsx` — preserved legacy page with prototype handoff.

## Verification

- `npx tsc --noEmit`
- Targeted ESLint on changed implementation and test files.
- `npx vitest run tests/validate.test.ts`
- `npx playwright test e2e/validate.spec.ts`

Tests cover persistence, SHA-256, acknowledgement, terminal states, duplicate
protection, the full customer/verifier journey, single selection, mobile width,
file rejection, example eligibility, declining, unknown IDs and matching/differing files.

## Next engineering step

The versioned requirement and eligibility contract is now implemented with fictional
policies. Select a real recipient/document pilot and obtain its authoritative
requirements for review before adding any real acceptance rules. See the policy
contract for ownership, versioning and review requirements.
