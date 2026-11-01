# Sprint 6 — Zik Vault and selective disclosure

This folder is the execution source of truth for the sequential two-model sprint.

## Run order

1. Give `01_ASTRA_BUILD_PROMPT.md` to GPT-6 Astra.
2. When Astra has committed a green build, give `02_OPUS_AUDIT_PROMPT.md` to Opus 5.
3. Save Opus's findings as `OPUS_FINDINGS.md`; do not let Opus edit product code in this phase.
4. Give `03_ASTRA_REMEDIATION_PROMPT.md` to Astra with the findings.
5. Give `04_OPUS_FINAL_GATE_PROMPT.md` to Opus 5.

`00_MASTER_BRIEF.md` controls scope and truth claims. If a model prompt conflicts with it, the master brief wins.

The single-file version for copying or downloading is `ZIKPASS_SPRINT_6_SEQUENTIAL_PACK.md` at the repository root.

