# Affiliate dashboard demo

Open `/affiliates/dashboard-demo` directly (local server: http://localhost:3000/affiliates/dashboard-demo). This public, fictional preview does not read affiliate sessions or customer data. It follows the public affiliate-area convention; production account authentication and authorization remain separate future integration work.

## Scope and assumptions

Every amount, activity count, reporting period and settlement status is an example. No tracking, backend endpoints, persistence, export, payments or payout actions were added. Client state only drives the sliders and reset button.

The example latest completed window is 1–14 September 2026, with £10,000 eligible Card/Pass gross revenue. The proposed 40% Zik / 60% participants split, followed by 45% store / 55% pool within participants, gives £4,000 Zik, £2,700 store and £3,300 pool. Founding weight 2 divided by total eligible weight 200 gives a 1% share and £33 illustrative allocation. Added affiliates have example weight 1. Weights are not eligibility rules. Revenue can be varied independently, including zero; values display rounded to pennies without asserting a settlement rounding policy.

Historical fixtures use their own network totals: £26.40 for the second window and £24.75 for the third. Low-volume activity is combined and withheld without inventing a final privacy threshold. Multi-day batching reduces linkability, not guarantees anonymity. All six product prices are provisional, and no other product contributions enter the calculation.

## New files

- `app/affiliates/dashboard-demo/page.tsx`: route, metadata and no-index instruction.
- `app/affiliates/dashboard-demo/dashboard.tsx`: isolated client presentation and simulation controls.
- `app/affiliates/dashboard-demo/dashboard.module.css`: scoped layout, responsive styles and focus/reduced-motion behavior.
- `lib/demo/affiliate-dashboard.ts`: fictional fixtures, formatting and pure calculation helpers.
- `tests/affiliate-dashboard-demo.test.ts`: allocation, dilution, zero revenue, history and invalid-input checks.
- `e2e/affiliate-dashboard-demo.spec.ts`: desktop/mobile layout, demo labels, keyboard sliders, reset and screenshot checks; no runtime-state reset or mutation.
- `docs/AFFILIATE_DASHBOARD_DEMO.md`: this handoff.

## Validation

- Targeted Vitest: 4 tests passed.
- Targeted ESLint: passed.
- TypeScript `tsc --noEmit --incremental false`: passed across the current checkout.
- Chromium Playwright: passed against the existing local server; checked 1280px desktop and 390px mobile, no page-level horizontal overflow, keyboard controls, skip link and reduced-motion preference. Desktop and mobile screenshots visually reviewed. Wide tables have keyboard-focusable scroll regions.
- The initial sandboxed browser run could not access/start the local server (EPERM). The authorized rerun against the existing server passed. No application failure was observed in these checks. The full repository suite/build was not run, to avoid unrelated state-mutating tests and shared build output during concurrent work.

## Deferred shared integration and production decisions

Existing affiliate onboarding, paired sessions and the customer shell had work in progress on arrival. The existing `/affiliate-demo` is a separate age-verification demo. No files in those flows, shared navigation, global CSS, dependencies, configuration or live product catalogue were edited, staged or committed. The existing logo component and semantic tokens are reused read-only. No AGENTS.md files were found in the repository or checked ancestor locations.

Before production: define eligibility and exclusions; final weights and founding terms; published milestones and future rate changes; tax basis, refunds, rounding and settlement; online sales with no store; reporting cadence, suppression thresholds and privacy assessment; authenticated account access; any per-visitor programme; other product contributions; pioneer phase cap; Vault+ storage allowance. None are guaranteed here.
