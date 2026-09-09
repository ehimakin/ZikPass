# ZikPass architecture

This document describes the implementation at the current `v2-ui-overhaul` head. It is the practical map for frontend, backend, and UI/UX contributors.

## Runtime shape

ZikPass is one Next.js App Router application. Pages, API handlers, browser clients, server services, shared types, and tests live in the same repository. The UI is React with Tailwind CSS. Domain services are TypeScript modules under `lib/server`; they should remain usable without rendering React.

```text
Browser page
  -> client component
  -> /api route handler
  -> lib/server service
  -> lib/server/storage.ts
  -> JSON runtime state
```

Cryptographic helpers and domain contracts shared by browser and server code live under `lib/shared`.

## Page ownership

### Customer surface (`components/customer/*`)

| Page | Main component | Notes |
| --- | --- | --- |
| `/home` | `HomeScreen` | Landing. `/` redirects here. Fixed scroll-over hero. |
| `/find` | `StoreFinder` | Postcode/area search, geolocation, schematic map + list. |
| `/get-pass` | `OnboardingFlow` | Physical-only onboarding state machine over the existing APIs. Also renders a claimed purchase-sale enrolment (`initialEnrollment`). |
| `/pass` | `PassScreen` | Wallet states + delete, `PwaInstallButton`, PWA-launch handoff claim. `/wallet` redirects here (PWA/handoff params preserved). |
| `/card` | `PurchaseActivation` | Activate a physical card bought at a till (printed-card QR target). |
| `/help` | `HelpScreen` | Accepted ID, FAQ, "Reset demo data" (demo only). |
| `/about` | about page | Longer explanation for customers/stores/sites. |
| `/offline` | `StatusPage` | Served by the service worker. `not-found.tsx` + `error.tsx` share `StatusPage`. |

`CustomerShell` owns the sticky header (`ZikLogoMark`, env badge, native-dialog menu with focus return), the `OfflineBanner`, the fixed bottom tab bar (Home / Find a store / My pass / Help), and (desktop ≥1360px) `AffiliateLogoRails`.

### Operator surface (`components/operator/*`)

| Page | Main component | Notes |
| --- | --- | --- |
| `/verify` | `ClerkVerify` → `RetailVerificationScreen` | Terminal binds to a store; sends `x-zik-store-id`; cross-store codes rejected. |
| `/verify/purchase` | `PurchaseSale` | Clerk-first sale: ID → record till payment → private activation QR. |

`OperatorShell` owns a plain staff header + a store-terminal selector (`useOperatorStore`, persisted in `localStorage`).

### Legacy / dev (older `AppShell`, kept for regression)

| Page | Main component | Notes |
| --- | --- | --- |
| `/onboarding` | `WalletSurface` (onboarding mode) | Original flow; app-led + affiliate context; older mocked remote/bank pipeline. |
| `/wallet?flow=physical…` | `WalletSurface` | Legacy physical handoff link. Bare `/wallet` redirects to `/pass`. |
| `/store` | - | Retired - `redirect("/verify")`. |
| `/issuer` | issuer UI components | Enrollment/error inspection for development. |
| `/verify/zik` | verifier demo component | Hosted relying-party verification demo (`postMessage`-era; not reused by the affiliate flow). |
| `/affiliate-demo` (+ `/confirm`, `/callback`, `/continue`) | `JerkMeatSite` / `AffiliateConfirmScreen` / `AffiliateCallbackScreen` | See the affiliate protocol section. |
| `/app/handoff` | `PwaInstallButton` + fallback | Native deep-link fallback and web-wallet installation. |
| `/ZikParental` | placeholder | Unlinked. |

## API surface

### Enrollment and issuance

- `POST /api/enrollment/start` starts remote or physical enrollment.
- `GET /api/enrollment/[id]` returns the current enrollment snapshot.
- `POST /api/enrollment/verify-possession` confirms the legacy remote possession code.
- `POST /api/enrollment/retry` retries the legacy mocked provider pipeline.
- `POST /api/enrollment/advance-cooling-off` advances demo state for the legacy flow.
- `POST /api/enrollment/issue` attempts issuance after all applicable policy gates are satisfied.
- `GET /api/issuer/sessions` returns every enrollment plus the issuer public key, for the `/issuer` development view.

### Physical verification

- `POST /api/physical/sessions` creates a store session.
- `GET /api/physical/sessions` lists sessions.
- `GET /api/physical/sessions/[id]` reads one session.
- `POST /api/physical/sessions/lookup` resolves a customer code for the clerk.
- `POST /api/physical/sessions/verify` records the clerk's physical-ID confirmation.
- `POST /api/physical/sessions/heartbeat` records customer/clerk activity.
- `POST /api/physical/device-auth/start` creates a device-auth challenge.
- `POST /api/physical/device-auth/complete` completes WebAuthn or the explicit demo device check.

The lookup and verify routes take an optional `x-zik-store-id` header. When set, `authenticateRetailVerifier(token, storeId)` derives the clerk identity from `lib/shared/stores.ts` and a session for a different store is rejected. Physical journey status is derived in `lib/shared/physical-journey.ts`; do not duplicate status rules in a page component.

### Purchase sale (clerk-first)

- `POST /api/purchase-sale` creates / advances a till sale (`lib/server/purchase-sale.ts`): start, confirm ID, record payment, issue a private activation token. Withheld until ID **and** payment are confirmed. The server stores a SHA-256 hash of the token; the raw token lives only in the clerk browser and the QR fragment.
- `POST /api/purchase-sale/claim` — the customer's device exchanges the activation token + holder public key for the linked enrollment. The claim commits enrollment + confirmed payment together under the storage transaction lock. Same token + same key is idempotent; a different key is rejected. A generic enrollment cannot claim a sale by guessing its id.

### Demo tooling

- `POST /api/demo/reset` — gated on `isDemoEnvironment` (`lib/shared/demo-environment.ts`, `ZIK_ENV`, never `NODE_ENV`). Clears enrolments, sessions, payments, handoffs, device bindings, affiliate requests/codes, error reports. Keeps the issuer keypair and store plans.

### Payments and plans

- `POST /api/payments/create` creates or reuses a pending payment record.
- `GET /api/payments/[enrollmentId]` returns payment state for an enrollment.
- `POST /api/payments/confirm-cash` confirms a cash/card-at-till demo payment (clerk).
- `POST /api/payments/confirm-online-demo` confirms the labelled online demo payment; `simulateFailure` produces a deterministic decline.

Payment records have a purpose: `pass_issuance` or `device_extension`, and a method: `cash_in_store`, `digital_wallet`, `online_demo`, or `retail_till`. `lib/shared/payment-config.ts` computes the trusted price/currency server-side (`getPassPrice()` — £1.99 fixture, code default; free flow when `0`) and reports which provider is configured (`getServerPaymentProvider()`; `stripe` only when both Stripe keys are present, else `none`). The client never sends an amount. `components/customer/onboarding/payment-panel.tsx` has two explicit adapters — a Stripe Express Checkout route (surfaces only when `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set; not wired this milestone) and the labelled **Zik demo checkout** simulator — plus pay-at-till. It never shows a combined Apple/Google button, never imitates an Apple sheet, and never silently substitutes simulator success for a failed real charge. The server rechecks issuance after a confirmed pass-issuance payment. Store-specific plan overrides are resolved by `lib/server/payments.ts` over global runtime defaults.

### Affiliate age verification (demo)

- `POST /api/affiliate/authorize` creates (or idempotently reuses) an authorization request for a registered `client_id`/`redirect_uri`/`state`, returning a `request_id`, `nonce`, `challenge`, `challenge_expires_at`, and a `confirm_url`.
- `POST /api/affiliate/challenge/complete` either verifies a signed `PresentationBundle` against the stored challenge (approving and issuing a one-time code) or records an explicit client-reported denial reason (e.g. `no_pass`, `cancelled`).
- `POST /api/affiliate/token` is the only endpoint a real affiliate backend would call server-to-server. It exchanges a one-time code for the minimal `AffiliateVerificationResult`. On any failure it returns nothing but the single generic denial message — never the specific internal reason.
- `GET /api/affiliate/result/[id]` returns request status (and, only while `status === "pending"`, the challenge string) for the confirm screen's own UX; it is never a trust source for the affiliate's access decision.

The **embedded** JerkMeat demo backend is thin wrappers over the above: `POST /api/affiliate-demo/start` sets an HttpOnly pending-state cookie and calls `createAffiliateAuthorizationRequest`; `POST /api/affiliate-demo/complete` validates that cookie, exchanges the code, and on a successful over-18 result issues a signed HttpOnly age-session cookie (`lib/server/affiliate-demo-session.ts`, ≤30 min, capped by pass expiry). The **standalone** `../jerkmeat` app instead calls `/api/affiliate/authorize` and `/api/affiliate/token` directly with a registered `jerkmeat` client id + bearer secret (`ZIK_JERKMEAT_*`). See [`docs/AFFILIATE_CUSTOMER_FLOW.md`](AFFILIATE_CUSTOMER_FLOW.md); the protocol below is the shared substrate.

### Wallet, handoff, and errors

- `POST /api/wallet/holder-key` registers the browser holder public key.
- `POST /api/mobile/handoff` creates a short-lived handoff token.
- `POST /api/mobile/handoff/claim` claims a handoff using a native holder public key.
- `POST /api/pwa/handoff/recover` recovers a pending PWA handoff after a lost refresh/battery interruption.
- `GET /api/pwa/manifest` returns an installable manifest tied to a handoff token.
- `POST /api/errors/report` stores a redacted user error report.
- `GET /api/errors` lists reports or returns one by reference.
- `GET /api/config/public-key` exposes the issuer public key needed by verifier clients.

## Domain state

`lib/shared/types.ts` is the contract source of truth. The important records are:

- `EnrollmentRecord`: customer application, lane, status, physical verification, legacy provider state, and optional issued credential.
- `PhysicalStoreSessionRecord`: store/session code, expiry, customer and clerk activity, and completion status.
- `DeviceBindingRecord`: enrollment, holder public key, active/pending/revoked status, primary flag, timestamps, and optional entitlement payment.
- `PaymentRecord`: idempotency key, purpose, method, amount/currency, confirmation, allocation, and settlement state.
- `StorePlanRecord`: optional per-store device limit, extension price, and currency override.
- `NativeAppHandoffRecord`: hashed short-lived handoff token, enrollment, claim state, and the credential returned for the claiming key.
- `ErrorReportRecord`: redacted error reference, operation/route metadata, recovery action, and safe context.
- `AffiliateAuthorizationRequest`: client/redirect/state, nonce, challenge and its expiry, status, and (only once resolved) a denial reason or the minimal `AffiliateVerificationResult`.
- `AffiliateAuthorizationCodeRecord`: hashed one-time code, the owning request, client/redirect binding, expiry, and consumption timestamp — never the raw code.

### Credential and device semantics

The current handoff implementation intentionally reuses the logical `credential_id`. If the claimant presents the same holder public key, the claim is idempotent. If the claimant presents a different valid Ed25519 public key, the issuer re-signs the existing credential payload for that subject key. The device-binding ledger is the policy gate around that operation; it does not create a second logical pass or replace the cryptographic credential model.

The default included limit is two devices. A third device requires a confirmed `device_extension` payment. The authorization transaction checks active bindings, consumes an eligible payment, and inserts the binding atomically through the JSON mutation queue.

## Affiliate verification protocol (demo)

`/affiliate-demo` demonstrates how a third-party site can request an age check without ever seeing the customer's identity, using a real authorization-code protocol rather than the older `postMessage`-based verifier (`lib/shared/vendor-verification.ts`, `components/zik-hosted-verification.tsx`, mounted at `/verify/zik`). That older path is intentionally not reused here: it lets the browser compute and hand over an unsigned `verified: true` result to a client-supplied `postMessage` origin, which `AUDIT.md` flags as H4 (attacker-controlled postMessage target) and H5 (unsigned, client-computed result). The affiliate demo is built instead on the same signed-credential primitives used by the wallet and verifier SDK.

### Flow

1. **Authorize.** The affiliate (browser-side demo) calls `createAffiliateAuthorizationRequest` (`lib/server/affiliate-verifier.ts`) with its registered `client_id`, an allowlisted `redirect_uri`, and a CSRF `state` value it generates and keeps itself. The service validates the client and redirect URI (`lib/server/affiliate-clients.ts`), generates a random `nonce`, and builds a `challenge` string via `buildAffiliateChallenge` (`lib/shared/affiliate-verifier.ts`), which embeds the client ID, request ID, and nonce directly into the string that will be signed. Repeating the same `client_id`/`redirect_uri`/`state` while a request is still pending returns the existing request rather than creating a duplicate (`findPendingAffiliateAuthorizationRequest`).
2. **Confirm.** The customer is sent to `/affiliate-demo/confirm`, a same-origin ZikPass-hosted screen. It fetches the request's status (and challenge) from `GET /api/affiliate/result/[id]`, inspects the local wallet via `getWalletStatusSnapshot`, and — if an active pass is present — signs the challenge locally with the holder key via `createPresentationBundle`, exactly as the existing verifier flow does. The signed bundle is submitted to `POST /api/affiliate/challenge/complete`.
3. **Verify and issue a code.** `completeAffiliateChallenge` runs the entire read-decide-verify-write cycle inside one atomic transaction (`runAffiliateAuthorizationRequestTransaction`, itself backed by the serialized `mutateStore` queue in `lib/server/storage.ts`). It checks the request is still `pending` and unexpired, checks the submitted challenge matches the expected one (`classifyAffiliateChallengeMismatch` attributes a mismatch to wrong audience/nonce/malformed), and calls the real `verifyPresentationBundle`. On success it mints a random one-time authorization code, hashes it (the same `sha256` hashed-bearer-token pattern used for mobile handoff tokens), persists only the hash, and returns the raw code to the confirm screen once.
4. **Redirect back.** The confirm screen redirects the browser to the affiliate's `redirect_uri` with `?code=...&state=...` on approval, or `?state=...` only on denial — real OAuth authorization-code redirect semantics, not `postMessage`.
5. **Exchange server-to-server.** The affiliate's backend (simulated by `/affiliate-demo/callback` calling `POST /api/affiliate/token`) exchanges the code for the result. `exchangeAffiliateAuthorizationCode` hashes the submitted code, atomically looks up and marks it consumed in the same transaction (so a replayed code is rejected even under concurrent exchange attempts), and checks the code's bound `client_id`/`redirect_uri` and the request's `state` match what the affiliate is presenting. Only then is the stored `AffiliateVerificationResult` returned.

### Minimal result shape

A successful exchange returns exactly:

```json
{
  "verification_id": "av_demo_...",
  "age_over": true,
  "threshold": 18,
  "assurance": "in_person_verified",
  "verified_at": "...",
  "expires_at": "..."
}
```

`verification_id` is a fresh demo identifier, not the underlying `credential_id` or any other reusable ZikPass identifier. No name, date of birth, address, government ID, selfie/biometric data, raw credential payload, or holder private key is ever included.

### Denial handling

`denyAffiliateChallenge` and every failure branch of `completeAffiliateChallenge`/`exchangeAffiliateAuthorizationCode` map onto `AffiliateDenialReason` (`lib/shared/types.ts`): `no_pass`, `expired_pass`, `revoked_or_invalid_pass`, `malformed_challenge`, `wrong_audience`, `wrong_nonce`, `wrong_state`, `invalid_signature`, `expired_challenge`, `consumed_challenge`, `expired_code`, `replayed_code`, `cancelled`, `unsupported_device`, `server_error`. Regardless of reason, the customer-facing UI and the `/api/affiliate/token` response always show the same generic sentence (`AFFILIATE_DENIAL_MESSAGE` in `lib/shared/affiliate-verifier.ts`): no stack traces, internal reasons, or raw tokens are exposed. Only a small allowlisted subset of reasons (`isClientReportableDenialReason`) can be supplied by the client itself when reporting its own local state (e.g. no pass on device, cancelled); every other reason is only ever assigned server-side.

### Security properties

- `state` and `nonce` are generated with `crypto.randomUUID()` / a cryptographically random alphanumeric generator, never predictable.
- The challenge has a short server-configured TTL (`affiliateChallengeTtlSeconds`, default 120s) and is single-use: once a request leaves `pending`, resubmission is rejected as `consumed_challenge`.
- The authorization code is single-use, short-lived (`affiliateAuthorizationCodeTtlSeconds`, default 120s), stored only as a hash, and consumed atomically to prevent replay under concurrent redemption attempts.
- `redirect_uri` is validated against a server-side allowlist (`lib/server/affiliate-clients.ts`); it is never taken on trust from the request alone.
- The full verify-and-issue-code cycle happens inside one serialized storage transaction, so there is no window between "verified" and "code issued" that a second request could race.
- The affiliate's own backend never receives the browser's raw verification claim — only the code, which it must exchange itself; the browser cannot forge a `verified: true` result the affiliate would trust.

## Storage and environment

`lib/server/storage.ts` loads seed data, normalizes legacy records, and writes runtime state atomically. Mutations are serialized within a process. This protects prototype retry/idempotency behavior but is not a distributed lock.

Runtime paths are resolved in `lib/server/runtime-paths.ts`:

- `ZIK_RUNTIME_DATA_DIR`, when set, wins.
- Vercel/Lambda-shaped environments use a temporary `zik-pass-data` directory.
- Local development defaults to `data/`.

Configuration is centralized in `lib/shared/config.ts`; use `.env.example` as the maintained list of names and defaults. `lib/shared/demo-environment.ts` (`ZIK_ENV` / `NEXT_PUBLIC_ZIK_ENV`) is a separate switch, independent of `NODE_ENV`, that gates demo tooling and the environment badge.

### Service worker

`public/sw.js` is an honest offline shell. It precaches only `/offline` + icons, serves content-hashed static assets cache-first, and does navigations network-first → a previously-seen copy of that exact page → the branded `/offline`. It never caches `/api/*`, the clerk/affiliate/handoff routes, or any URL carrying a token/handoff/code/session parameter, and it skips non-hashed `/_next/` dev chunks. Bump `SW_VERSION` to roll the caches. Registration is in `PwaRegistration` (`components/pwa-install-button.tsx`).

## UI and accessibility conventions

- The customer/operator surfaces use `CustomerShell` / `OperatorShell`, the `--zk-*` tokens, `ZikLogoMark`, and the primitives in `components/customer/ui.tsx`. Reuse these before adding new visual language. `AppShell` remains only for the legacy/dev screens.
- Keep recovery messages actionable: users should see whether to retry, resume, restart, or report.
- Preserve `aria-live` announcements in asynchronous payment, handoff, and clerk lookup states. The menu is a native `<dialog>` (focus trap + Escape) that returns focus to its trigger on close; the `Sheet` primitive traps focus manually.
- Keep fixed navigation content usable at narrow mobile widths; check 320 / 390 / 768 / 1440. Respect `prefers-reduced-motion` (handled globally under `.zk-surface`).
- Do not expose raw IDs, holder keys, handoff tokens, or provider payloads in customer-facing UI.
- Treat demo payment/device-auth labels as part of the trust UX; do not imply a demo check is a real biometric, that a demo payment has settled, or that the design is a zero-knowledge proof.

## Extension guidance

When adding a capability:

1. Add or update a shared type and a server service boundary.
2. Persist durable state through `storage.ts` rather than module globals.
3. Make repeated requests safe where a user can retry after a network loss.
4. Add a focused test for the state transition and one adverse/retry path.
5. Keep the route handler thin and update `README.md`, this document, and `docs/TESTING.md` if the user-visible flow changes.
