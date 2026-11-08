# Sprint 6 master brief — Zik Vault + selective disclosure

## Outcome

Turn the current ZikPass prototype into an investor-ready, production-quality vertical slice that demonstrates one device-held wallet performing two materially different transactions:

1. **Age-only:** an adult-content-style affiliate receives only a valid over-18 result.
2. **Retail checkout:** a fictional merchant receives an over-18 result plus only the self-entered form fields the user explicitly approves.

The decisive product moment is the consent screen: the user sees who is asking, why, which fields are required or optional, which claims are Zik-verified, which values are self-entered, and which data will not be shared.

This is not authorization for a public release or a claim of regulatory certification. It is an honest, polished vertical slice suitable for investor demonstrations and technical diligence.

## Repository baseline

- Repository: `ehimakin/ZikPass`
- Base branch: `v2-ui-overhaul`
- Inspected base commit: `4bcb2d3f2863a76f1dc5145c1e0e71d9806cdb01`
- Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind, Vitest, Playwright; Expo native scaffold under `mobile/`
- Existing primary surfaces: customer PWA, store operator, physical issuance, device handoff, payment demo and affiliate authorization-code demo
- Existing security review: `AUDIT.md`
- Separate future cryptography brief: `docs/ZERO_KNOWLEDGE_BRIEF.md`

Baseline observed on 12 September 2026:

- `npm test`: 21 files, 127 tests passed
- `npm run lint`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed
- `npm run e2e`: runner could not start in the inspection container because Node 24 returned `uv_interface_addresses` while Next.js was starting; rerun on an ordinary development machine and in CI

Before implementation, re-check the branch head and record any drift from the commit above. Preserve later user work.

## Product truth model — non-negotiable

| Attribute or event | Status shown to user/merchant | Where it lives | Who attests it |
| --- | --- | --- | --- |
| `age_over_18 = true` | **Zik verified** | Signed age credential on device; minimum operational state server-side | Zik, following the in-person store event |
| Physical ID checked in person | **Zik verified** | Credential assurance/method and operational audit record | Authorised store verifier + Zik issuance policy |
| Legal name | **Self-entered** | Encrypted local vault only, except when user releases it to a named merchant | User; not Zik-verified |
| Delivery address | **Self-entered** | Encrypted local vault only, except when user releases it to a named merchant | User; not Zik-verified |
| Email/phone, if implemented | **Self-entered** | Same as above | User; not Zik-verified |

Do not imply that Zik verified, certified, signed or checked self-entered fields. Do not put name, address, DOB, face, ID image or ID number into Zik's age credential, enrollment record, logs, analytics or error reports.

The client application must process vault plaintext to display and release it, but **Zik servers must not receive or store vault plaintext**. Use the precise phrase “Zik servers cannot read your vault” only when the implementation and network inspection support it. Avoid the metaphysical claim that “Zik can never see anything” because client code, compromised devices and user-authorised recipients are distinct threat boundaries.

## Scope

### 1. Local encrypted Zik Vault

Add a customer Vault surface within the approved centred mobile-width design system. It must support:

- create, view, edit and delete a minimal profile containing legal name and one UK-style delivery address;
- optional email and telephone only if they do not jeopardise the core flow;
- field-level provenance (`self_entered`) and last-updated metadata;
- a versioned storage schema and migration path;
- encrypted-at-rest storage in IndexedDB using browser Web Crypto (AES-256-GCM with fresh IVs and authenticated version/context data);
- a user-held unlock secret from which the encryption key is derived using an accepted password KDF available in the selected runtime; salt and KDF parameters are stored, the derived key and plaintext are not persisted;
- lock on reload and after a short inactivity period; explicit Lock and Delete Vault actions;
- safe handling of wrong unlock secret, corrupt ciphertext, interrupted writes and unavailable Web Crypto/IndexedDB;
- no vault values in URLs, server actions, API bodies, React server-component props, cookies, telemetry, console logs, error reports or service-worker caches.

Do not present a browser PIN as equivalent to Secure Enclave or hardware-backed biometric storage. If a PIN is allowed for demo usability, label its security limitation and apply a local retry delay; do not claim the delay resists an attacker who can copy the ciphertext. Prefer a passphrase for the PWA. Native SecureStore/biometric parity is a stretch deliverable, not a reason to leave the primary PWA path incomplete.

### 2. Versioned disclosure request and consent

Create a shared, runtime-validated v1 contract for:

- relying-party/client identifier and registered display name;
- exact allowlisted return destination;
- fresh request ID, state and nonce;
- issued and expiry timestamps with a short TTL;
- purpose text;
- requested fields, with required/optional status;
- protocol version and requested age threshold.

Allow only a fixed field vocabulary. Reject unknown fields, duplicate fields, unregistered clients, bad return destinations, wrong audience/state/nonce, expired requests and replay. Server-controlled merchant registration must determine display name, return URL and encryption key; do not trust those values from browser input.

The consent UI must:

- identify the requesting merchant;
- distinguish `Zik verified` from `Self-entered` visually and in accessible text;
- show required and optional data separately;
- default optional fields to not shared;
- list high-sensitivity fields that are not requested/not shared where this improves comprehension;
- support Approve and Cancel without dark patterns;
- require an unlocked vault before exposing field values;
- announce async states and restore focus correctly.

### 3. Disclosure transport

The age assertion continues through the existing server-verified affiliate authorization-code flow. Never let a merchant trust a browser-computed `verified: true` boolean.

Self-entered fields must be released without Zik server plaintext access. Implement a reviewable hybrid-encryption envelope:

- generate a random AES-256-GCM content key and fresh IV in the wallet;
- encrypt the approved field payload locally, binding request ID, audience, nonce, protocol version and expiry as authenticated data;
- wrap the content key to the registered merchant's public encryption key using a well-supported Web Crypto construction;
- submit/store only ciphertext, wrapped key and non-secret routing metadata through Zik;
- allow only the merchant-side demo boundary to unwrap/decrypt;
- expire and consume the response once; prevent two concurrent redemptions from succeeding;
- never silently fall back to plaintext or the legacy unsafe `postMessage` verifier.

The embedded fictional merchant is a co-hosted demo boundary, not proof of real infrastructure separation. Keep its private decryption key out of client bundles and out of Zik domain modules. Document how a real merchant would host that private key on its own backend.

If a maintained JOSE implementation is selected instead of hand-assembling an envelope, use a published standard construction, document the exact algorithms, pin the dependency and add interoperability vectors. Do not invent cryptography.

### 4. Two complete demonstrations

**Age-only demo:** preserve and polish the existing affiliate flow. The request asks only for `age_over_18`. The Vault must remain locked/unread and no self-entered field may appear in the request, network exchange or result.

**Retail form-fill demo:** add a tasteful fictional retail checkout. It requests:

- required: legal name, delivery address, `age_over_18`;
- optional: email or phone only if that field exists in the Vault.

The user selects **Fill with Zik**, reviews the consent sheet, unlocks if needed, approves the required data and any chosen optional field, and returns to an accurately populated checkout. Each received value retains a provenance label. The merchant receives no DOB, photo, government-ID data, credential ID, persistent holder key or unrequested vault field.

### 5. Privacy evidence and operational controls

Add:

- a data-flow/threat-model document covering device compromise, XSS, malicious relying party, replay, confused deputy, Zik server compromise, merchant compromise and issuer/merchant collusion;
- a field-by-field data inventory showing plaintext and ciphertext recipients;
- privacy-safe structured error handling;
- security headers appropriate to the deployed demo, including a restrictive CSP compatible with the app;
- input validation at every new route boundary;
- rate/abuse limits appropriate to short-lived disclosure requests and redemption;
- a demo reset that removes vault data only through the local UI and clears server-side demo requests/ciphertext without touching issuer keys;
- explicit feature flag/kill switch for v1 disclosure, failing closed when disabled.

### 6. Documentation and demo readiness

Update README/architecture/testing documentation and provide:

- a five-minute investor script covering issuance, Vault, age-only proof and retail form-fill;
- a one-page “claims we can and cannot make” sheet;
- setup, migration, rollback and known-limit notes;
- screenshots or a short recording only after the real build is working;
- a completed evidence matrix mapping each acceptance criterion to a test, inspection or manual check.

## Explicitly out of scope

- claiming public-production readiness, Ofcom approval, ACCS certification or regulatory compliance;
- claiming name/address are verified;
- storing ID images, faces, biometrics, DOB, passport/driving-licence numbers or address on Zik servers;
- a full password manager or general browser extension;
- cloud sync, account recovery or cross-device vault recovery;
- real Uber Eats, Deliveroo, gambling, adult-site or retailer integrations;
- silently removing the existing age credential/device lifecycle;
- inventing a zero-knowledge proof scheme;
- completing the separate BBS/ZKP research-and-implementation brief in `docs/ZERO_KNOWLEDGE_BRIEF.md`.

## Definition of done

The sprint is done only when all of the following are evidenced:

1. A fresh in-person flow issues a valid age credential and leaves the existing 127-test baseline non-regressed.
2. Vault creation/edit/reload/lock/unlock/delete work, and IndexedDB contains no vault plaintext.
3. Wrong secrets and tampered ciphertext fail closed without destroying recoverable state.
4. Age-only approval succeeds while the Vault stays locked and no profile data is accessed or transmitted.
5. Retail form-fill sends exactly the approved fields and age result; optional-unselected and unrequested fields are absent.
6. Network capture shows Zik endpoints receive no vault plaintext.
7. The fictional merchant can decrypt the encrypted disclosure once; replay, expiry, audience/state/nonce mismatch, tampering and concurrent double redemption fail.
8. The merchant result contains no DOB, face, ID data, raw signed credential, credential ID or persistent holder public key.
9. Consent copy and returned field badges preserve verified versus self-entered provenance.
10. Delete Vault removes local encrypted data and in-memory key/plaintext state.
11. `npm test`, lint, TypeScript, build and Playwright journeys pass in a supported environment.
12. Manual checks pass at 320, 390, 768 and 1440 px, keyboard-only, reduced motion and a real iPhone Safari/PWA where available.
13. The evidence matrix is complete, all P0/P1 review findings are resolved, and every remaining limitation is visible in the handoff.

## Change and review protocol

- Implementation branch: create `sprint-6-vault-selective-disclosure` from the documentation branch/base chosen by the owner.
- One model edits product code at a time.
- Astra is the implementation owner. Opus is read-only during the first audit and writes only `docs/sprint-6/OPUS_FINDINGS.md` after review.
- Do not rewrite history, force-push, delete user branches or alter unrelated work.
- Make coherent commits with tests. Record commit SHAs at each handoff.
- Do not push to `main` or merge. The owner decides when to open/merge a PR.
- Findings use `P0` (unsafe/unusable), `P1` (must fix before investor demo), `P2` (important follow-up), `P3` (polish).
- Astra must disposition every finding as `FIXED`, `ACCEPTED RISK` or `OUT OF SCOPE`, with evidence and rationale. P0/P1 cannot remain Accepted Risk without owner approval.

