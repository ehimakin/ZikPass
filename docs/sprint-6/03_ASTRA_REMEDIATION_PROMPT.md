# Prompt 3 — GPT-6 Astra remediation

Resume as implementation owner after Opus has produced `docs/sprint-6/OPUS_FINDINGS.md`.

1. Re-read the master brief and verify the implementation branch/head.
2. Reproduce every P0/P1 finding before editing when safely possible.
3. Create a disposition table in `docs/sprint-6/HANDOFF.md` containing every finding ID.
4. Fix every valid P0/P1. Fix P2 items when contained and low-risk. Do not hide or downgrade findings by changing tests or copy alone when the underlying behavior remains.
5. Mark each item `FIXED`, `ACCEPTED RISK` or `OUT OF SCOPE`, with evidence. P0/P1 may be Accepted Risk only with explicit owner approval recorded verbatim.
6. Add a regression test for every defect fixed unless the finding is purely documentary or cannot be automated; explain exceptions.
7. Re-run all gates and manually repeat both investor journeys.
8. Commit remediation separately from the initial implementation and update ending SHA, evidence matrix, residual risks, migration/rollback and demo script.

Do not ask Opus to edit the solution. Do not merge to `main`, force-push or rewrite the audit history.

Return a concise remediation report with links/paths, exact test results and the branch/commit ready for final review.

