# Sprint 6 handoff

**Investor-ready vertical slice; not certified or approved for public reliance.**

## Revisions and preserved baseline

- Initial checkout: `v2-ui-overhaul`, `4bcb2d3f2863a76f1dc5145c1e0e71d9806cdb01`.
- Initial status: clean (no tracked/untracked work); empty diff.
- Approved base: `origin/sprint-6-vault-selective-disclosure-brief`.
- Starting SHA: `6d1d3812457f7b461b555857a0ca30fae9b66a2a`.
- Implementation branch: `sprint-6-vault-selective-disclosure`.
- Commits: `2a91703` Vault/ADR/baseline; `c734446` protocol/merchant/API/tests; final UI and handoff revisions recorded below.
- No applicable AGENTS.md found in repository or parent directories.
- No push, merge, history rewrite or reset of existing issuer keys performed. Existing pass/native lifecycle remains separate from the profile.

## Exact gate commands and results

| Command | Result |
|---|---|
| Baseline `ZIK_RUNTIME_DATA_DIR=/tmp/zik-s6-baseline npm test` | PASS: 21 files, 127 tests; 11.23s |
| Baseline `npm run lint` | PASS |
| Baseline `npx tsc --noEmit` | PASS |
| Baseline `npm run build` | Sandbox failure: ENOTFOUND fonts.googleapis.com, failed to fetch Manrope. Network-enabled rerun passed. |
| Baseline `ZIK_RUNTIME_DATA_DIR=/tmp/zik-s6-e2e ZIK_ENV=demo npm run e2e` | Sandbox failure before tests: listen EPERM 0.0.0.0:3000. Port 3000 was subsequently found occupied; test run stopped before reset and moved to 3106. |
| `ZIK_RUNTIME_DATA_DIR=/tmp/zik-s6-finaltests npm test` | PASS: 25 files, 138 tests; 13.25s |
| `npm run lint` | PASS: no warnings/errors |
| `npx tsc --noEmit` | PASS |
| `ZIK_NEXT_DIST_DIR=.next-sprint6-build ZIK_DISCLOSURE_V1=true npm run build` | PASS: compiled, type/lint validation, page generation and traces |
| `ZIK_E2E_PRODUCTION=true ZIK_E2E_BASE_URL=http://localhost:3106 ZIK_NEXT_DIST_DIR=.next-sprint6-build ZIK_DISCLOSURE_V1=true ZIK_ENV=demo ZIK_RUNTIME_DATA_DIR=/tmp/zik-s6-browser-production npm run e2e` | PASS: 14 tests; 58.0s |
| `git diff --check` | PASS |
| `rg -l -e demo-merchant-private -e decryptAtMerchant -e unwrapKey .next-sprint6-build/static` | No matches (client bundle boundary inspection) |

Test logs are in `evidence/`. Next-generated include-path churn from isolated builds is restored before final commit. No real user runtime directory was used for tests.

## Acceptance/evidence matrix

| # | Acceptance criterion | Evidence / status |
|---|---|---|
| 1 | Fresh in-person issuance; 127-test baseline preserved | PASS: all 138 unit/service tests; physical/purchase/payment browser journeys, including real signed pass issuance. |
| 2 | Vault create/edit/reload/lock/unlock/delete; IndexedDB has no plaintext | PASS: `tests/vault.test.ts`; browser “Vault reload…” reads actual encrypted IndexedDB record and asserts canaries/passphrase absent. |
| 3 | Wrong secrets/tampered ciphertext fail closed, retain recoverable state | PASS: Vault crypto tests (wrong secret, IV/ciphertext/parameter/version changes), failed-write preservation, browser wrong-secret recovery. |
| 4 | Age-only succeeds with Vault locked, no access/transmission | PASS: browser “age-only never opens Vault storage…” replaces IndexedDB open with a throwing sentinel for the Vault DB; inspects all API request bodies. Shared age consent allows only `age_over_18`. |
| 5 | Exactly approved retail fields; optional/unrequested absent | PASS: selection/provenance unit tests; browser omission checks exact returned key set; selected-email browser case verifies explicit inclusion. |
| 6 | Zik endpoints receive no Vault plaintext | PASS: browser captures all API request bodies after profile creation and rejects name/address/email/passphrase canaries; asserts ciphertext/wrapped-key submission. Merchant response is explicitly separate. Server disclosure file inspection contains no profile values. |
| 7 | Merchant decrypts once; replay/expiry/binding/tamper/concurrency denied | PASS: disclosure tests, independent Node RSA-OAEP/AES-GCM interop, all authenticated context mutations, concurrent Promise.allSettled redemption with one success. |
| 8 | No prohibited identity/credential/stable holder data in merchant result | PASS: strict selected-field parser plus exact output assertions, existing minimal affiliate-result tests; merchant route returns only age provenance and selected fields. |
| 9 | Provenance preserved and visible | PASS: strict `self_entered` values, reject forged `zik_verified` profile metadata; actual checkout field badges and verified age result; consent screenshots. |
| 10 | Delete local encrypted data and clear memory references | PASS: session deletion/lock and in-flight unlock invalidation tests; browser reload after delete shows empty Vault. No guaranteed JS erasure claim. |
| 11 | Unit/lint/TypeScript/build/Playwright | Automated gate results above and final result below. |
| 12 | 320/390/768/1440, keyboard, reduced motion, real iPhone where available | Four-width browser overflow checks and screenshots; keyboard cancellation/focus and reduced-motion emulation. Physical iPhone/Safari/PWA NOT RUN: no device available. See DEMO.md checklist. |
| 13 | Evidence complete, P0/P1 review findings resolved, limitations visible | Self-review dispositions below; independent Opus/security review NOT PERFORMED in this implementation task. No known unresolved Sprint 6 P0/P1 implementation finding. Physical-device evidence remains outstanding. |

## Finding dispositions

| Finding | Severity | Disposition / evidence |
|---|---|---|
| Baseline browser assertions expect “Over 18” while base card already renders “18+ verified” | P2 | FIXED: two assertions in `e2e/journeys.spec.ts`; confirmed via `git show 6d1d381:components/customer/silver-pass-card.tsx`, line 33. First isolated run: 11 passed, 2 failed only for this mismatch. |
| Cancel focus restoration races the remounted trigger | P1 | FIXED: React effect waits for closed/nonbusy state; production keyboard browser test. Intermediate run: 13 passed, 1 focus failure. |
| Homepage/legacy heading claims zero knowledge | P1 | FIXED: accurate signed-age copy, metadata disclosed, self-entered retail distinction; see CLAIMS.md. |
| Async unlock could restore plaintext after a lock | P1 | FIXED: session epoch invalidation, tested pending unlock then lock. |
| Historical public-launch authentication/revocation/key-custody issues in AUDIT.md | Public-launch scope | OUT OF SCOPE: explicitly retained prototype infrastructure, described in SECURITY_AND_DATA.md; this sprint does not close or certify the historical audit. Not an acceptance of those risks for public deployment. |

## Changed-file map

| Area | Files |
|---|---|
| Vault domain/storage/UI | `lib/shared/vault.ts`, `lib/client/vault-adapter.ts`, `components/customer/vault-screen.tsx`, `app/vault/page.tsx`, `tests/vault.test.ts` |
| Disclosure contracts/age consent | `lib/shared/disclosure.ts`, `lib/shared/age-consent.ts`, `lib/server/affiliate-{clients,verifier}.ts`, `components/affiliate-confirm-screen.tsx` |
| Zik service/routes | `lib/server/disclosure-{service,http}.ts`, `app/api/disclosure/{[id],approve,cancel}/route.ts`, demo reset extension |
| Explicit merchant boundary/checkout | `lib/demo-rp/merchant.ts`, `app/api/demo-merchant/{start,redeem}/route.ts`, `components/customer/retail-demo.tsx`, `app/retail-demo/page.tsx` |
| Security and integration | `middleware.ts`, `app/layout.tsx`, `public/sw.js`, `.env.example`, `.gitignore`, ESLint import restriction; menu/home/help/legacy copy |
| Tests/tooling | disclosure/HTTP/age-consent tests, server-only test stub, Vitest config, `e2e/vault-disclosure.spec.ts`, two stale journey assertions, Playwright/Next isolated-output support |
| Documentation/evidence | ADR 006; README/ARCHITECTURE/TESTING; this handoff, SECURITY_AND_DATA, CLAIMS, DEMO, logs and four screenshots |

## Claims, limits, migration and demo

- [Verbatim UI security/privacy claims and nonclaims](CLAIMS.md).
- [Field-by-field recipients and threat residuals](SECURITY_AND_DATA.md).
- [Setup, migration, rollback, five-minute route and local/server reset](DEMO.md).

Principal residuals: one Node process and file-backed replay storage; co-hosted merchant key custody (not independent infrastructure); unlocked browser/XSS/device risk; no recovery/sync; no genuine ZKP or unlinkability; prototype issuer/store authentication and native handoff limitations; no physical iPhone or independent security certification. Expired ciphertext is pruned lazily on successful transactions or reset. A crash during approval may require a fresh request. Use fictional data in controlled demonstrations.

## Final implementation revision

Ending product-code SHA: `b8daa35025a6aeec4bd687e2a28580dca0110511`.
The subsequent documentation/evidence-only commit is the final branch HEAD (reported in the task response); no product changes follow the tested implementation revision.

Production browser gate: **14 passed (58.0s)**. Screenshots at all four widths were visually inspected: centred existing customer layout, legible wrapping and no horizontal overflow. Full-page captures include the fixed navigation at the capture viewport's bottom; content below it is reachable by scrolling. Keyboard cancellation restores the trigger after React commits the closed state. Physical iPhone/PWA and independent audit remain explicitly unverified.
