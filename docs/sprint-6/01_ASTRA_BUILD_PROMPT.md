# Prompt 1 — GPT-6 Astra implementation lead

You are the sole implementation owner for Sprint 6 in `ehimakin/ZikPass`.

Read completely, in this order:

1. `docs/sprint-6/00_MASTER_BRIEF.md`
2. `AGENTS.md` if present anywhere applicable
3. `docs/ARCHITECTURE.md`
4. `docs/TESTING.md`
5. `AUDIT.md`
6. `docs/ZERO_KNOWLEDGE_BRIEF.md` (context only; its ZKP implementation is out of this sprint)
7. Current code along the physical issuance, wallet, affiliate and mobile-handoff paths

Do not assume the prose is current where it conflicts with code. Inspect the branch head, status and diff first. Preserve all pre-existing work.

## Mission

Implement the complete investor vertical slice described in the master brief: encrypted device-local Vault, truthful provenance, versioned selective-disclosure consent, age-only reuse, encrypted retail form-fill, tests, documentation and demo script.

Age is Zik-verified. Name/address are self-entered. Zik servers must not receive vault plaintext.

## Required working method

1. Create/switch to `sprint-6-vault-selective-disclosure` from the approved sprint-doc branch. Never work directly on `main`.
2. Record the starting SHA and baseline status in `docs/sprint-6/HANDOFF.md`.
3. Run the baseline commands. If a failure predates your edits, record it precisely and continue only when it does not invalidate the sprint.
4. Before coding, add a short ADR under `docs/decisions/` covering vault KDF/encryption, disclosure transport, merchant key boundary, replay storage and why the design does not claim genuine ZKP.
5. Implement in small coherent commits. Tests accompany each domain boundary.
6. Do not pause for cosmetic choices. Escalate only if a decision changes the product truth model, sends vault plaintext to Zik, adds identity verification, weakens fail-closed behavior or requires an external paid service.
7. Finish by running every gate and updating the evidence matrix/handoff.

## Engineering priorities

- Keep crypto and domain logic outside React so it can be tested independently.
- Add runtime schemas for every new external input and reject surplus/unknown fields.
- Use a versioned `VaultEnvelopeV1`; use random salts/IVs and authenticated context; zero/clear references to secrets and plaintext on lock where JavaScript permits, without making impossible memory-erasure claims.
- Keep the encrypted profile separate from `WalletState` so existing credential migrations cannot accidentally serialize profile plaintext.
- Never read/decrypt the Vault during the age-only journey.
- Build a registered relying-party configuration. Client input never chooses trusted display name, return URL or public encryption key.
- Bind request ID, audience, state/nonce, protocol version and expiry into both the encrypted disclosure and redemption decision.
- Keep merchant demo private-key/decryption code in an explicit demo relying-party boundary. Prevent it from being imported into client bundles or ordinary Zik service modules.
- Consume responses atomically and test concurrent redemption.
- Preserve generic denial messages externally while retaining privacy-safe internal reason codes.
- Use the existing customer primitives and approved centred layout. Do not create a second design system.
- Do not revive the unsafe legacy `postMessage` verifier or browser-trusted success boolean.

## Required tests

At minimum add focused tests for:

- vault round-trip, distinct ciphertext for identical plaintext, wrong secret, tamper, schema version, migration behavior and deletion;
- disclosure schema allowlist, required/optional selection and provenance preservation;
- client/audience/return allowlist, TTL, state/nonce, single use, replay and concurrent redemption;
- encryption/decryption interop and authenticated-data tampering;
- exact data minimisation for age-only and retail requests;
- no vault access on age-only path (instrument/mock the vault adapter);
- error redaction and feature-flag fail-closed behavior;
- UI journeys for cancel, approve, locked vault, optional field omitted and successful checkout fill;
- regression of issuance, payment, handoff and existing affiliate checks.

Do not assert privacy merely from UI snapshots. Add payload/storage inspection and a development-safe test hook or Playwright interception proving that Zik-bound requests do not contain the profile values.

## Required handoff

Commit the implementation and provide:

- starting and ending SHA;
- concise changed-file map;
- commands and exact results;
- the completed acceptance/evidence matrix;
- known limitations and threat-model residuals;
- migration and rollback steps;
- five-minute demo route and reset instructions;
- explicit copy of every security/privacy claim exposed in UI;
- items needing physical iPhone/Safari verification.

Do not declare the product “production ready.” State: **investor-ready vertical slice; not certified or approved for public reliance**.

