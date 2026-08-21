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

| Page | Main component | Notes |
| --- | --- | --- |
| `/` | `WalletSurface` in homepage mode | Physical-first customer entry and splash animation |
| `/onboarding` | `WalletSurface` in onboarding mode | Customer flow; supports app-led and affiliate context |
| `/wallet` | `WalletPageSurface` | Saved pass and wallet actions; physical query context renders the onboarding surface |
| `/verify` | `RetailVerificationScreen` | Clerk code lookup and physical-ID confirmation |
| `/store` | `StoreSessionDashboard` | Demo store/session creation and monitoring |
| `/issuer` | issuer UI components | Enrollment/error inspection for development |
| `/verify/zik` | verifier demo component | Hosted relying-party verification demo |
| `/app/handoff` | `PwaInstallButton` plus fallback UI | Native deep-link fallback and web-wallet installation |

`AppShell` owns the shared header, navigation, fixed status footer, and page-level visual treatment. A page should use the shell unless it is deliberately rendering a direct physical flow variant.

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

Physical journey status is derived in `lib/shared/physical-journey.ts`. Do not duplicate status rules in a page component.

### Payments and plans

- `POST /api/payments/create` creates or reuses a pending payment record.
- `GET /api/payments/[enrollmentId]` returns payment state for an enrollment.
- `POST /api/payments/confirm-cash` confirms a cash/card-at-till demo payment.
- `POST /api/payments/confirm-online-demo` confirms the explicitly labelled online demo payment.

Payment records have a purpose: `pass_issuance` or `device_extension`. The server rechecks issuance after a confirmed pass-issuance payment. Store-specific plan overrides are resolved by `lib/server/payments.ts` over global runtime defaults.

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

### Credential and device semantics

The current handoff implementation intentionally reuses the logical `credential_id`. If the claimant presents the same holder public key, the claim is idempotent. If the claimant presents a different valid Ed25519 public key, the issuer re-signs the existing credential payload for that subject key. The device-binding ledger is the policy gate around that operation; it does not create a second logical pass or replace the cryptographic credential model.

The default included limit is two devices. A third device requires a confirmed `device_extension` payment. The authorization transaction checks active bindings, consumes an eligible payment, and inserts the binding atomically through the JSON mutation queue.

## Storage and environment

`lib/server/storage.ts` loads seed data, normalizes legacy records, and writes runtime state atomically. Mutations are serialized within a process. This protects prototype retry/idempotency behavior but is not a distributed lock.

Runtime paths are resolved in `lib/server/runtime-paths.ts`:

- `ZIK_RUNTIME_DATA_DIR`, when set, wins.
- Vercel/Lambda-shaped environments use a temporary `zik-pass-data` directory.
- Local development defaults to `data/`.

Configuration is centralized in `lib/shared/config.ts`; use `.env.example` as the maintained list of names and defaults.

## UI and accessibility conventions

- Reuse `AppShell`, existing panel/button styles, and shared status helpers before adding a new visual language.
- Keep recovery messages actionable: users should see whether to retry, resume, restart, or report.
- Preserve `aria-live` announcements in asynchronous payment, handoff, and clerk lookup states.
- Keep fixed navigation and status footer content usable at narrow mobile widths; test overflow at both 320px-class mobile and desktop sizes.
- Do not expose raw IDs, holder keys, handoff tokens, or provider payloads in customer-facing UI.
- Treat demo payment/device-auth labels as part of the trust UX; do not imply that a demo check is a real biometric or that a demo payment has settled.

## Extension guidance

When adding a capability:

1. Add or update a shared type and a server service boundary.
2. Persist durable state through `storage.ts` rather than module globals.
3. Make repeated requests safe where a user can retry after a network loss.
4. Add a focused test for the state transition and one adverse/retry path.
5. Keep the route handler thin and update `README.md`, this document, and `docs/TESTING.md` if the user-visible flow changes.
