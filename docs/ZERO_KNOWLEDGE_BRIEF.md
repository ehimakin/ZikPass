# Zik Pass: zero-knowledge prototype brief for Claude

Prepared 8 September 2026. Role: project lead. Deliver a working, reviewable cryptographic prototype while preserving the current polished customer experience.

## Objective

Keep the in-person age check. Add genuine zero-knowledge credential presentations so a customer can prove possession of a valid Zik-issued over-18 credential without sending the original credential or a persistent holder identifier to the online verifier. Zik must not need to collect a name, DOB, ID number, or ID image to support this physical issuance flow.

The clerk remains the trusted source of the original age assessment. Cryptography proves possession of an authentic credential; it does not prove the clerk checked the ID correctly or prevent all voluntary credential sharing.

Naming: project ZikPass; organisation Zik; product Zik Pass. Preserve routes, identifiers, stored protocol values, and existing unrelated work.

## Current implementation to inspect

Read docs/ARCHITECTURE.md, docs/SPRINT_STATUS.md and docs/TESTING.md, then trace issuance, storage, presentation, and affiliate redemption end to end.

- lib/server/credential-issuer.ts signs credentials with Ed25519.
- lib/shared/verifier-sdk.ts receives the credential and checks the issuer signature, holder challenge signature, activation, expiry, and over18 claim.
- lib/server/affiliate-verifier.ts checks the presentation and produces a smaller affiliate result.
- The credential contains a stable credential ID, holder public key, dates, and potentially physical attestation metadata. Hiding these from the affiliate alone does not make the presentation zero-knowledge to Zik.

Audit the current state rather than assuming this summary is exhaustive. Inventory every recipient and persisted field, including logs, analytics, mobile handoff, and error reporting.

## Architecture decision first

Write a short decision record comparing an established anonymous-credential/BBS approach with a proof system that privately verifies the existing Ed25519 credential. Prefer maintained implementations, published protocols, test vectors, and documented independent review. Do not invent cryptographic primitives. Verify current library maturity, licensing, browser/mobile support, dependency risks, and security-review scope.

BBS is a candidate, not a preselected solution. Selective disclosure and randomized signature proofs alone do not solve holder binding, expiry predicates, revocation, or application-level tracking. An ordinary signed token, encrypted credential, or selective-disclosure JWT is not by itself a replacement for the requested zero-knowledge protocol.

Specify exactly:

- The public statement, secret witness, disclosed fields, trusted issuers, and security assumptions.
- How the device proves credential possession and holder authorisation without disclosing a stable public key. Explain the limits of hardware key support and resistance to copying or lending.
- How activation and expiry are enforced. If timestamps must be disclosed, justify their granularity and fingerprinting risk; do not claim a hidden range check that the chosen scheme cannot perform.
- How the proof binds cryptographically to a fresh, single-use server challenge, intended site, and protocol version. Merely attaching those fields beside a proof is insufficient.
- Whether verification is direct at the affiliate or mediated by Zik. Explain which parties can observe the site, IP address, cookies, and timing, and what issuer/verifier collusion reveals. Do not equate unlinkable proof bytes with an untrackable service.
- How revocation, key rotation, the existing device allowance, transfer/recovery, and lost devices work. Document any prototype limitation and implement an explicit policy; do not silently drop existing protections.

Keep the credential minimal: an issuer-attested over-18 claim can be sufficient; introducing DOB into the credential is unnecessary. Keep operational clerk/store records separate from online proof material wherever possible.

## Delivery sequence

1. Produce the decision record, threat model, data-flow diagram, dependency assessment, and acceptance-test plan. Identify genuine product tradeoffs needing an owner decision; otherwise proceed autonomously.
2. Build an isolated vertical slice: authorised physical attestation → issuance → device-held credential → fresh proof → verification → affiliate age result. Demonstrate real cryptography, not a simulated proof object.
3. Integrate behind an explicit versioned feature flag. Preserve the existing flow for comparison and rollback, but never silently fall back to ordinary credential disclosure when ZKP verification fails.
4. Cover issuance, presentation, challenge consumption, affiliate redemption, storage, and UI error states with appropriate tests. Maintain current branding and layout.
5. Deliver a reproducible demo, measured device/browser performance, changed-file summary, migration/rollback notes, and a precise statement of achieved properties and remaining gaps.

Do not reinterpret or rename existing signed issuer values as part of this work without an explicit versioned migration. Inspect prior copy changes for accidental protocol-value changes.

## Acceptance criteria

- A legitimate newly issued credential produces an accepted proof; verification does not receive the original credential, credential ID, persistent holder public key, or physical attestation details.
- Tampered proofs, untrusted issuers, invalid age claims, premature/expired credentials, wrong holder authorisation, reused/expired challenges, and wrong-site proofs are rejected. Concurrent replay attempts cannot both succeed.
- Repeated presentations use fresh randomized proofs. Examine disclosed metadata and protocol transcripts for correlation; differing proof bytes alone are not evidence of unlinkability. Explain the protocol's guarantees and their limits.
- Network captures and storage/log inspection demonstrate the intended disclosure boundaries and the absence of identity-document data in the physical issuance/proof flow.
- Tests use upstream vectors where available and include negative and cross-implementation verification where practical. Tests support correctness; they do not establish a mathematical security proof or replace independent review.
- Record proof generation/verification time, payload size, and failure behaviour on representative mobile browsers, including Safari. Report actual results and unresolved device limitations.
- Existing pass lifecycle and affiliate flows still work under the declared policy. No false success states, unsupported security claims, or hidden compatibility downgrade.

## Standards, claims, and UK context

Target a documented zero-knowledge security property, not an unspecified “NIST-compliant ZKP” badge. NIST's description of zero knowledge is not a product certification. Any claimed conformity must name an applicable standard, version, scope, and supporting evidence.

UK age-assurance effectiveness and data-protection duties are separate from the choice of cryptography. ZKP adoption alone does not establish compliance. Record applicability questions for UK specialist review, and assess the whole age-assurance process rather than only the proof component. Arrange independent cryptographic review before production reliance.

Keep prototype copy accurate. Audit “That's zero-knowledge”, “only sharing over 18”, and “anywhere online” against actual disclosure and integration support. Distinguish demonstrable prototype capability from externally reviewed production security.

## Primary references

- NIST, zero-knowledge proof overview: https://csrc.nist.gov/projects/pec/zkproof
- W3C, Data Integrity BBS Cryptosuites: https://www.w3.org/TR/vc-di-bbs/ — describes selective disclosure and unlinkable derived proofs; verify current status and exact supported features before choosing it.
- Ofcom, age-assurance duties: https://www.ofcom.org.uk/online-safety/protecting-children/age-assurance — technical accuracy, robustness, reliability, and fairness concern the full process; also points to UK privacy obligations.

First response requested from Claude: explain the existing flow, recommend a protocol/library with evidence and alternatives, identify the principal privacy/security tradeoffs, and give the implementation milestones. Then continue with the authorised prototype work, escalating only decisions that materially change product scope or security promises.
