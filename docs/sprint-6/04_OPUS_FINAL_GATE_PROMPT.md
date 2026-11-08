# Prompt 4 — Opus 5 final acceptance gate

Perform a clean final review of the remediated Sprint 6 head. Remain read-only for product code.

Verify:

- every first-pass finding and Astra disposition;
- every definition-of-done item in the master brief;
- the actual network/storage disclosure boundary;
- exact merchant result fields and provenance;
- negative/replay/concurrency behavior;
- all automated checks and the two manual investor journeys;
- documentation, rollback and claim accuracy.

Write/return `docs/sprint-6/FINAL_VERDICT.md` with exactly one outcome:

- `PASS` — all acceptance criteria and P0/P1 findings are resolved; remaining limitations are accurately documented;
- `PASS WITH KNOWN LIMITATIONS` — no unresolved P0/P1, but clearly enumerated P2/manual/environment limitations remain;
- `FAIL` — at least one acceptance criterion or P0/P1 remains unresolved.

For a PASS, include the reviewed commit SHA and an immutable evidence summary. For a qualified pass/fail, list each blocker or limitation with evidence and the smallest required next action. Never translate “investor-ready vertical slice” into public-production approval.

