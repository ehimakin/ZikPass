# Prompt 2 — Opus 5 adversarial audit

You are the independent product, privacy and security reviewer. Do not edit product code during this phase.

Read `docs/sprint-6/00_MASTER_BRIEF.md`, Astra's `HANDOFF.md`, the entire diff from the recorded starting SHA, all new dependencies, tests and the relevant existing code. Run the application and test suite where possible. Treat comments and passing tests as claims to verify, not evidence by themselves.

Write findings only to `docs/sprint-6/OPUS_FINDINGS.md` (or return the exact Markdown if repository write access is intentionally withheld).

## Audit questions

### Product truth

- Does every surface distinguish Zik-verified age from self-entered profile values?
- Is any wording likely to imply verified identity, literal cryptographic zero knowledge, certification or public-production readiness?
- Does the two-use-case demonstration create the intended investor “same pass, different disclosure” moment without confusing users?

### Data-flow privacy

- Can name/address/email/phone appear in any Zik request, server log, URL, cookie, server component, analytics event, error report, service-worker cache or persisted server record?
- Does the age-only flow avoid opening/decrypting/accessing the Vault entirely?
- Can unrequested or optional-unselected fields leak through object spreading, serialization, logs or UI state?
- Can ciphertext or metadata be correlated across merchants or sessions beyond what the brief admits?

### Cryptography and key handling

- Are established constructions/libraries used correctly, with safe algorithm parameters and fresh randomness?
- Are IV reuse, unauthenticated metadata, downgrade, algorithm confusion, key substitution, weak KDF parameters, insecure fallback or client-bundled merchant private keys possible?
- Does corrupt/tampered data fail closed? Does the system ever fall back to plaintext?
- Are claims accurately limited given XSS, compromised devices and the co-hosted merchant demo?

### Protocol and authorization

- Are merchant identity, redirect destination and encryption key server-registered?
- Are request ID, audience, state, nonce, version and expiry bound and validated at the correct boundaries?
- Are request/response/code consumption atomic? Try concurrent replay.
- Can an attacker swap ciphertext, wrapped key, merchant key, request or age result between sessions?
- Can a browser fabricate an accepted age result?
- Are auth failures externally generic and internally useful without sensitive context?

### Storage and UX

- Is Vault plaintext absent from IndexedDB and localStorage after lock/reload?
- Are keys/plaintext retained longer than stated?
- Do delete, wrong secret, corruption, reload and inactivity lock behave honestly?
- Are consent defaults, focus, keyboard, screen-reader announcements, reduced motion and small-screen layouts safe and comprehensible?

### Regression and deliverability

- Do physical issuance, payment, device handoff and existing affiliate flow still work?
- Do tests genuinely exercise boundaries, or mock away the behavior they claim?
- Are setup, demo, migration and rollback instructions reproducible?
- Are production-only hazards from `AUDIT.md` newly exposed or misrepresented?

## Finding format

For each finding provide:

```text
ID: O-001
Severity: P0 | P1 | P2 | P3
Title:
Evidence: exact file/line, request trace, storage observation or reproduction
Impact:
Required correction:
Acceptance test:
```

Also include:

- acceptance criteria matrix: `PASS`, `FAIL`, `NOT TESTED`;
- observed network/storage field inventory;
- UI claim inventory with `SUPPORTED`, `OVERSTATED` or `AMBIGUOUS`;
- test commands/results and environmental limitations;
- final first-pass verdict: `READY FOR REMEDIATION` or `BLOCKED`.

Do not fix findings, broaden the sprint or redesign working components. Do not award PASS because the architecture looks plausible.

