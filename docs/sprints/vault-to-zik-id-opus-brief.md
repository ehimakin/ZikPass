# Claude Opus sprint brief: working Zik Vault → Zik ID application

Prepared 18 September 2026 against the current ZikPass repository. This is an implementation brief, not a certification assessment. Read the live repository and applicable AGENTS.md before changing code; repository details can change after this brief.

## Mission and intended outcome

Finish the functional prototype of Zik Vault: users choose documents on their device, give explicit consent to local analysis, extract meaningful details, compare them with their self-entered profile, and retain the documents and evidence securely. When sufficient reviewed evidence is available, offer a Zik ID application.

Deliver a working end-to-end flow with actual files and actual OCR. Do not substitute hardcoded matches, simulated scanning, or a polished mock for the required implementation. Preserve the existing anonymous Zik Pass journey and current visual design.

The product sequence is:

1. Zik Pass: anonymous adult-status credential, available independently of Vault and ID.
2. Zik Vault: private document storage and a source-linked collection of claims.
3. Zik ID: an application and, after a separate approved onboarding process, an identity presentation assembled from appropriate claims.

The central privacy premise is that Zik does not require users to upload their face or identity documents to Zik or an AI provider. “Import into Vault” means local browser/device storage, not a server upload. This sprint must not introduce cloud OCR, remote facial recognition, or a central identity-document database.

The owner will supply the final Zik ID onboarding process later. Implement application readiness, a persistent draft, and an explicit onboarding adapter boundary now. Do not invent a production approval process or automatically issue an accepted ID when the OCR gate passes. Existing ID presentation code can be exercised in a clearly separate demo mode.

## Current code to understand first

| Area | Current implementation / starting point |
| --- | --- |
| Product story | `app/ecosystem/page.tsx`, `lib/shared/product-catalogue.ts`, `components/customer/product-family.tsx` |
| Main Vault | `components/customer/vault-entry.tsx`, `vault-signup.tsx`, `vault-workspace.tsx`, `vault-entry.module.css` |
| Discovery UI | `components/customer/vault-search.tsx`: consent interface and sample results; no actual search/OCR |
| Existing storage | `lib/client/vault-adapter.ts`, `lib/shared/vault.ts`: encrypted profile in separate IndexedDB, passphrase-based Web Crypto |
| Current document gap | Workspace stores filenames and designations in React state; they disappear on lock/refresh |
| Claim gap | Profile v1 contains self-entered name/address/email and optional designated selfie; no DOB, document repository or evidence graph |
| Wallet | `app/wallet/page.tsx`, `components/customer/wallet-screen.tsx`; `/pass` remains the age-pass presentation |
| Existing ID demo | `components/customer/zik-id-screen.tsx`, `components/zik-id-verifier.tsx`, `lib/client/zik-id-peer.ts`, `lib/shared/zik-id.ts`, `lib/server/zik-id-sessions.ts` |
| Privacy decisions | `docs/decisions/006-vault-disclosure.md`; preserve provenance and existing age-verification boundaries |
| Reset | `lib/client/demo-reset.ts`, `app/api/demo/reset/route.ts`; extend to every new store/object |
| Test starting points | `tests/vault.test.ts`, disclosure/ID tests; `e2e/vault-preview.spec.ts`, `vault-disclosure.spec.ts`, `wallet.spec.ts`, `demo-reset.spec.ts` |

The main application is Next.js/React/TypeScript. No OCR or PDF extraction library is currently declared in the root package. A separate Expo project exists under `mobile/`; do not assume it provides working document discovery or biometric identity verification. Some documentation and `/ecosystem` copy are stale compared with current code. Resolve these inconsistencies as part of delivery.

## Non-negotiable distinction: extraction, corroboration and verification

Keep separate facts rather than one misleading “verified” boolean:

- User assertion: a value typed or corrected by the user.
- Extraction: text read from a document, with location and method.
- User review: the user accepted or rejected that extraction.
- Corroboration: reviewed evidence agrees with a particular claim value.
- Authenticity/holder verification: a separate check by a suitably authorised verifier, with method, issuer and scope.

OCR confidence measures recognition quality, not document authenticity. MRZ checksums are consistency checks, not proof of a genuine passport. Two documents agreeing does not prove they are genuine, independent or owned by the uploader. A valid Zik Pass proves the signed age claim under its existing rules; it does not prove the name extracted from a new passport scan is that holder's name.

Use user-facing labels such as “Self-entered”, “Found in document”, “Matches your details”, “Needs review”, and “Checked by [verifier]” only where the last label has a genuine attestation. Do not label OCR-backed name, DOB or address as legally verified. This distinction is reflected in GPG 45, which treats evidence strength, validity and holder verification separately: [official identity checking guidance](https://www.gov.uk/government/publications/how-to-check-someones-identity-1-0/how-to-check-someones-identity-1-0-pre-release).

## Workstream 1 — real, permission-scoped document discovery

Build these entry points in `/vault`:

- Add files: OS file/photo picker with multiple selection.
- Take a document photo: browser-supported camera capture with ordinary file-picker fallback.
- Find documents in a chosen folder: capability-detected directory selection, recursively scanning only the selected scope, with cancellation and bounded work.
- Search already imported Vault documents by document type, extracted terms and relevant claims while unlocked.

A website cannot silently search the whole device or obtain blanket access to the iPhone photo library because a consent checkbox was selected. Folder access is an enhancement; file/photo selection must provide the full baseline journey on mobile. Clearly say “Search selected files/folder”, not “Search my whole phone”. `showDirectoryPicker` has limited browser availability and requires a user gesture: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker).

Before analysing, show selected source scope, file count, purposes and supported types. Allow selection changes and deselection. Changing analysis scope invalidates the prior consent. Support storage without analysis. Separate consent to store, analyse and subsequently share. For discovery, analyse candidate files only after consent; do not permanently import every scanned item. Persist only what the user selects to keep. No background rescan after permission is withdrawn or the Vault locks.

Required formats: JPEG, PNG, WebP; text PDFs and scanned PDFs. Report HEIC/HEIF and other unsupported formats honestly, with a practical export/reselect path unless a tested local decoder is added. No DOCX parser is required this sprint; contracts/certificates are supported as PDFs or images. Unrecognised documents remain usable as stored files.

Use conservative, configurable initial limits: 20 MB/file, 20 PDF pages/file and 25 files/batch. Inspect image dimensions and bound decoded pixels/render size; reject oversized input before expensive allocation where possible. Show skipped/failed files individually. Never hide a partial batch failure behind “complete”.

## Workstream 2 — actual local analysis

Use a browser worker pipeline, preferably PDF.js plus Tesseract.js/WASM, with version-pinned, same-origin worker/core/language assets. Verify package compatibility and current security advisories during implementation. Tesseract.js runs in browsers but does not directly accept PDFs; extract a PDF text layer or render scanned pages first. [Tesseract.js](https://github.com/naptha/tesseract.js), [local asset setup](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md), [PDF.js examples](https://mozilla.github.io/pdf.js/examples/).

Pipeline: validate → orient/downsample → extract text or render pages → OCR where needed → classify → propose fields → user review → save encrypted results.

Required extraction:

| Document | Candidate information |
| --- | --- |
| Passport | Name, DOB, document type, expiry and issuer/country when readable; MRZ parsing and check results when present |
| Driving licence | Name, DOB, address and expiry where present; initially document the supported UK layout(s) |
| Address evidence | Named person, address, issue date, issuer where readable |
| Certificates / contracts | Named subjects/parties, document title/type, dates and issuer/organisation; allow an unknown classification |

Generic contracts/certificates need conservative extraction and review, not a promise of reliable universal understanding. A date is not automatically a DOB; a company address is not automatically the user's address. Passports generally do not supply a current residential address. Multiple names, ambiguous date formats and unclear century values require review. Keep original text alongside normalised proposals. Never fabricate absent values.

Prefer deterministic parsers plus OCR first; an on-device language model is optional only if it demonstrably improves measured results within mobile limits. There must be no cloud fallback. Treat all document text as untrusted data, never as instructions or executable HTML. Do not follow document links or execute PDF scripts/attachments.

Provide per-file/page progress, cancel/retry, rotation correction and understandable errors. Limit concurrency (initially one OCR worker on mobile), reuse workers, release canvases/bitmaps/object URLs and terminate work on lock. Cancelled jobs must not write stale results after reset, document removal or a later unlock. Use generation IDs/epochs and transactional writes.

## Workstream 3 — persistent encrypted Vault and evidence model

Introduce a versioned model and migration from existing v1 profiles. Preserve existing records on migration failure and unknown versions; never wipe and recreate a Vault as a migration strategy.

Recommended logical records:

- Document: local random ID, encrypted source bytes, filename/MIME metadata, local duplicate hash, import time, classification, page count and processing state.
- Observation: document/page ID, bounding box or source excerpt, raw/normalised value, field type, parser/model version, recognition quality and review decision.
- Claim: current selected value, user assertions, linked observations, matching/conflicting evidence and optional trusted attestations.
- Consent: scope, purpose, version, timestamp and withdrawal state.
- Application: random ID, policy version, referenced claim/evidence versions, readiness reasons and application state.

Encrypt document bytes, thumbnails, filenames, extracted text, DOB, searchable index and application details at rest in a dedicated Vault boundary. Do not put profile data into WalletState, localStorage, logs, URLs, analytics or server requests. Non-sensitive technical indexing metadata may remain outside ciphertext only if documented and necessary. Keep plaintext indexes in memory only while unlocked.

Design binary storage for documents rather than expanding the current small JSON envelope into one enormous base64 profile. Retain the reviewed cryptographic primitives; specify a fresh authenticated-encryption nonce per write and authenticated record context. If adopting an envelope/key hierarchy for efficient edits, document key custody, passphrase changes, migration and lock behaviour in an ADR. Do not persist plaintext keys/passphrases or claim browser Face ID encrypts this Vault.

Provide durable import, rename, review, preview, download/export-original and delete flows. Persist added names/designations too. Delete dependent observations, thumbnails and indexes when deleting a document; recompute claim support and readiness. Preserve unrelated user assertions. Handle quota/write failures without claiming success or damaging existing records.

Use storage estimates and request persistence where supported, but explain that browser-local storage is not a guaranteed backup. Persistence requests may be declined: [MDN storage persistence](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist). Include an encrypted Vault export/import for recovery, validated transactionally, or explicitly record it as an unmet completion item rather than claiming the Vault is finished. No plaintext bulk export by default.

## Workstream 4 — review and reconciliation UX

Keep the established Vault safe/unlock experience. Replace the demo file list with the real document library, statuses and previews. Extend Names & details with DOB and source-backed evidence views.

For each proposed field, show what was found, the existing value, document/page evidence and one of: matches / different / missing / uncertain. The user can accept, correct, keep their value or defer. Never silently overwrite a self-entered value. Editing a claim invalidates support for the old value; correction of an OCR candidate remains a user correction, not a new authenticity check.

Normalise spaces, case and date formats carefully, preserving original spellings. Do not merge materially different names, DOBs or addresses through aggressive fuzzy matching. Historical addresses and name changes are explainable states, not automatic fraud findings. Multiple subjects within a document must not be combined into one identity.

Preserve the current design: gold accents and supplied Z artwork; square passive panels; rounded interactive controls/pills; explicit homepage product-card exception. Include mobile, keyboard, screen-reader and reduced-motion states. Analysis is optional and must not block ordinary Vault storage.

## Workstream 5 — explainable Zik ID application readiness

Implement a pure, versioned policy function returning `not_ready | needs_review | ready_to_apply`, plus machine-readable reasons, satisfied requirements and next actions. Do not use “three uploads = verified” or a single opaque confidence score.

Proposed prototype policy v1 (a product default, NOT a regulatory assurance level):

1. An active, usable Zik Pass is present on this device. Its age assertion remains independent of extracted identity details.
2. One supported photo-ID document supplies reviewed legal name and DOB, and a reviewed expiry date that is not past. Ambiguous, unreadable or expired primary evidence requires review.
3. A separate supporting document supplies a reviewed matching name plus matching DOB or an address agreed with the selected profile. Recent address evidence means dated within 90 days for this prototype policy; other evidence categories have their own documented relevance rules.
4. All required proposals are reviewed. Material identity conflicts are unresolved → `needs_review`.
5. Exact duplicates, repeated pages and repeated fields from one source do not count as independent evidence. Group obvious alternative scans of the same document; uncertain independence requires review. Do not claim perfect duplicate detection.

Address is not required merely to prove adulthood; it may support this proposed ID application route. Email, NI number, employment and qualifications never substitute for primary identity evidence. More unrelated documents do not override a missing requirement. Store the policy centrally with testable fixtures so the owner can replace it when onboarding is defined.

This gate answers “is the application evidence prepared?”, not “is this person legally verified?”. A forged-but-readable document can satisfy text matching; call out this limit in the engineering handover, and let the later verification stage decide authenticity and holder binding.

When ready, show “You have enough supporting information to start a Zik ID application”, an explanation and a dismissible “Apply for Zik ID” action. Do not auto-enrol, charge or share anything. Dismissal lasts until a meaningful evidence change. Persist the draft and re-evaluate after edits, deletions, evidence ageing, Pass expiry/replacement, restore and unlock.

## Workstream 6 — Zik ID application and future onboarding boundary

Build a real application screen at `/id` (or a clear nested application route): evidence checklist → review selected claims → explain intended use/disclosure → explicit continue → durable pending-onboarding application. No automatic approved state from local data.

Define an onboarding adapter contract for future authorised identity checks: start, get status, cancel, and receive/verify an issuer-authenticated outcome bound to this application, holder key, claim set/version and evidence snapshot. Mutable local flags must never confer issuance authority. Reject stale approvals following claim or holder changes. The owner has not yet specified the checks; record that dependency and make the pending state clear.

Do not add mandatory remote selfie upload. The existing ID demo's designated selfie is not a verified portrait; the owner must settle the production portrait/holder-check process in the later onboarding brief. Keep any legacy selfie demo explicitly labelled and isolated from readiness/approval.

Update `/wallet` to show an actual application once one exists, and an ID only after valid issuance under the selected environment. A demo issuer may exist only behind the existing explicit demo gate and must produce visibly labelled demo credentials. No unavailable card is needed before application.

Audit the current ID presentation before integrating: the existing signed age presentation does not automatically authenticate its adjacent name/photo fields. A future issued ID must cryptographically bind authorised claims and portrait digest/version to issuer, holder, audience, challenge and expiry; the verifier must validate that binding and replay/status checks. Preserve provenance for any separately shared self-entered data.

The existing WebRTC implementation uses no ICE servers: do not promise cross-network reliability. Keep a controlled same-device/local-network demonstration and document the gap. Broad bar/club/online acceptance, trust-framework certification, production issuance and arbitrary-network transport are separate milestones; do not market them as delivered by this sprint.

## Delivery sequence and stop/go criteria

1. Audit and spike: prove real local OCR of a synthetic passport-style image and a scanned PDF on desktop and mobile-sized browser; measure memory/time and document actual device coverage.
2. Storage foundation: v2 schema, migration, encrypted document repository, cancellation/lock lifecycle and recovery export/import.
3. Import and analysis: real file/folder adapters, consent, PDF/OCR workers, classification and field proposals.
4. Reconciliation: durable claims, conflict handling, source previews and editable details.
5. Application: pure readiness policy, eligibility explanations, persistent draft and pending-onboarding adapter, Wallet integration.
6. Hardening: reset/deletion, network privacy assertions, regression tests, responsive QA, copy/architecture documentation and demo script.

Do not replace a failed technical spike with fake success. If a browser lacks a capability, implement the specified fallback and report the precise remaining limit. Estimate effort after the spike; do not assume a single short sprint can also deliver certification or completed unspecified onboarding.

## Acceptance criteria and release evidence

- Selected real image/PDF fixtures produce extracted values; documents and reviewed claims survive lock/reload and correct-passphrase unlock.
- Storage-only import performs no OCR; declining/withdrawing consent stops analysis; changing scope requires fresh consent.
- User-chosen folder search works where supported; mobile file/photo selection supports the whole core flow without directory APIs.
- Wrong passphrase, tampered ciphertext, unknown version and failed migration preserve existing data and fail closed.
- A wrong OCR DOB, ambiguous date, multiple names, unreadable image, encrypted/corrupt PDF, oversized file and quota failure have useful review/error states.
- Duplicate evidence cannot increase readiness. Deleting support or changing a claim withdraws readiness and marks affected drafts stale.
- A deterministic eligible fixture reaches `ready_to_apply`, and a submitted draft reopens correctly; it never becomes an issued ID through a client-side toggle.
- Network tests inspect fetch/XHR, worker requests, beacons and relevant WebSocket/WebRTC paths: no document bytes, extracted text, filenames, biometric images or personal values leave the device during import/OCR/review. No sensitive text enters logs or telemetry.
- OCR assets can be loaded locally; after assets are available, processing succeeds without network. Authenticated Pass/ID presentation may legitimately require connectivity and must explain that separately.
- Lock/reset cancels workers and invalidates late writes. `/help` reset removes all new encrypted stores, applications and indexes; old content cannot reappear through restore/migration races.
- Zik Pass onboarding, verification, Wallet navigation and existing disclosure tests remain functional.
- Exercise widths 320/390/768/1440, reduced motion and keyboard interaction. Distinguish real iPhone Safari/Android device tests from desktop emulation; never claim hardware coverage from Playwright alone.
- Supply at least 12 synthetic, clearly marked fixtures spanning supported document classes and adverse cases. Record expected fields and measured extraction results; critical clean-fixture name/DOB mismatches must enter review rather than be silently accepted. Report field-level accuracy and end-to-end timing, not invented model-confidence percentages.

Run TypeScript, relevant lint, unit/integration and browser tests, then the production build. Update stale tests and docs with reasons; don't weaken assertions to hide regressions. No real personal documents in fixtures or commits.

## Required handover

Deliver working code, dependency/asset licences, migration/security ADR, browser capability matrix, measured OCR results, test/build report, known limitations and a repeatable demonstration script. Update `/ecosystem`, product catalogue and Vault guide to distinguish functional local features, pending onboarding and future accepted ID. Pricing remains illustrative unless an existing authorised payment flow supports it.

Demo script: create/unlock Vault → choose synthetic files → consent → real extraction → review one match and one conflict → resolve → lock/reopen → see readiness → start application → view pending application in Wallet → delete supporting evidence → see readiness/draft invalidation → reset → confirm fresh Vault/Wallet.

Conclude by listing exactly what the owner must specify for final Zik ID onboarding: authorised checker and checks, portrait acquisition/use, holder binding and recovery, issuer authority, acceptance partners and approval/expiry/revocation policy. These dependencies do not block the real Vault pipeline or the application-preparation milestone described above.
