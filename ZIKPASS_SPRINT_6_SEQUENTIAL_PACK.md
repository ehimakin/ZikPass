# ZikPass Sprint 6 sequential execution pack

## The assignment

Build an investor-ready, production-quality vertical slice of **Zik Vault + selective disclosure** on top of `v2-ui-overhaul`.

The same device-held ZikPass must demonstrate:

1. an age-only affiliate check that returns only a Zik-verified over-18 result; and
2. a fictional retail checkout that receives Zik-verified over-18 status plus only the self-entered form fields the user selects.

This pack coordinates one implementation owner and one independent reviewer. The full controlling requirements and acceptance tests are in [`docs/sprint-6/00_MASTER_BRIEF.md`](docs/sprint-6/00_MASTER_BRIEF.md).

## Product truth that neither model may change

- Zik verifies and signs the over-18 claim following an authorised in-person ID check.
- Legal name, delivery address and any contact fields are **self-entered**, encrypted and stored locally in the Vault.
- Zik does not claim to verify or sign the self-entered fields.
- Zik server endpoints, persistence, logs and error reports must not receive vault plaintext.
- A merchant receives only fields requested, selected and explicitly approved for that named transaction.
- The age-only journey must not unlock, decrypt or access the Vault.
- This sprint does not establish public-production readiness, regulatory certification or a genuine zero-knowledge proof protocol. The separate `docs/ZERO_KNOWLEDGE_BRIEF.md` remains future work.

## Baseline

- Repo: `ehimakin/ZikPass`
- Base branch: `v2-ui-overhaul`
- Inspected commit: `4bcb2d3f2863a76f1dc5145c1e0e71d9806cdb01`
- Baseline: 127 Vitest tests pass; lint, TypeScript and Next production build pass.
- Playwright was blocked only in the inspection container by Node's `uv_interface_addresses`; it must be rerun locally/CI.

## Sequence

### Phase 1 — Astra builds

Give GPT-6 Astra this instruction:

> Act as sole implementation owner. Read `docs/sprint-6/00_MASTER_BRIEF.md` and then follow `docs/sprint-6/01_ASTRA_BUILD_PROMPT.md` exactly. Start from the approved sprint documentation branch, create `sprint-6-vault-selective-disclosure`, preserve existing work, implement and test the complete vertical slice, and commit it. Do not merge to main. Record starting/ending SHAs, test evidence, data/claim inventory, limitations and rollback in `docs/sprint-6/HANDOFF.md`.

Required build boundaries:

- versioned AES-256-GCM encrypted local Vault in IndexedDB;
- user-held unlock secret and honest PWA security language;
- field-level `self_entered` provenance;
- runtime-validated, short-lived disclosure requests with registered merchant identity/return/key;
- local hybrid encryption to the merchant public key, with only ciphertext crossing Zik services;
- one-time, atomic merchant redemption;
- age proof through the existing server-verified authorization-code path;
- complete age-only and retail form-fill UI journeys;
- payload/storage inspection tests, negative crypto/protocol tests, accessibility and responsive checks;
- updated architecture, threat model, testing, claims sheet and five-minute demo script.

### Phase 2 — Opus audits without fixing

After Astra commits a green build, give Opus 5 this instruction:

> Perform an independent, adversarial review. Read `docs/sprint-6/00_MASTER_BRIEF.md`, Astra's `HANDOFF.md`, and follow `docs/sprint-6/02_OPUS_AUDIT_PROMPT.md`. Do not edit product code. Inspect the entire diff, run tests, trace real network/storage behavior and attempt negative/replay/concurrency cases. Write only `docs/sprint-6/OPUS_FINDINGS.md`. Grade findings P0–P3 and produce acceptance, field-flow and UI-claim matrices.

Opus must specifically challenge plaintext leakage, provenance confusion, crypto misuse, key substitution, redirect/audience confusion, replay races, browser-forged age success, unsafe fallbacks, XSS implications and claims exceeding evidence.

### Phase 3 — Astra remediates

Give Astra this instruction with the Opus findings available:

> Follow `docs/sprint-6/03_ASTRA_REMEDIATION_PROMPT.md`. Reproduce and fix every valid P0/P1, add regression tests, disposition every finding as FIXED/ACCEPTED RISK/OUT OF SCOPE, and commit remediation separately. P0/P1 may be accepted only with explicit owner approval. Rerun all gates and both demo journeys; update `HANDOFF.md`.

### Phase 4 — Opus gives the gate verdict

Give Opus this instruction:

> Follow `docs/sprint-6/04_OPUS_FINAL_GATE_PROMPT.md` against the exact remediated SHA. Remain read-only for product code. Return/write `FINAL_VERDICT.md` as PASS, PASS WITH KNOWN LIMITATIONS, or FAIL, with evidence. Do not reinterpret an investor-ready vertical slice as public-production approval.

## Release gate

The vertical slice is acceptable only when:

- existing issuance/payment/handoff/affiliate behavior remains green;
- encrypted Vault lifecycle and deletion work without local plaintext persistence;
- age-only flow succeeds without Vault access;
- retail flow discloses exactly the approved fields and retains provenance;
- Zik-bound network bodies contain no vault plaintext;
- tamper, wrong secret, expiry, wrong client/audience/state/nonce, replay and concurrent redemption fail closed;
- merchant results contain no DOB, ID/face data, raw credential, credential ID or persistent holder public key;
- every P0/P1 is fixed and every remaining limitation is documented;
- the five-minute investor demo is repeatable from a clean reset.

## Repository documents

- `docs/sprint-6/00_MASTER_BRIEF.md` — scope, architecture constraints and Definition of Done
- `docs/sprint-6/01_ASTRA_BUILD_PROMPT.md` — implementation prompt
- `docs/sprint-6/02_OPUS_AUDIT_PROMPT.md` — adversarial review prompt
- `docs/sprint-6/03_ASTRA_REMEDIATION_PROMPT.md` — correction prompt
- `docs/sprint-6/04_OPUS_FINAL_GATE_PROMPT.md` — final verdict prompt
- `docs/sprint-6/HANDOFF_TEMPLATE.md` — evidence and audit trail template

