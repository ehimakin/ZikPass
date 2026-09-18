# ZikPass

ZikPass ("Zik Pass" in the UI) is a privacy-first age-assurance prototype. It demonstrates an in-person identity check, device authentication, a signed over-18 credential, a browser wallet, an OAuth-style affiliate age check, and a path towards a native wallet. The current implementation is a working prototype, not a production identity, payments, or compliance service.

Active branch: `v2-ui-overhaul` (aligned with `origin/v2-ui-overhaul`). `main` and `dev` are older parallel branches and are intentionally not merged for routine local setup.

## Product direction

This repository implements **Zik Pass**, the first product in the wider **Zik** platform:
£1.99 one-off, with no Vault or subscription requirement. **ZikVault** (planned £0.99/month)
and **Zik ID** (planned £2.99 one-off) are future products. See the
[product source of truth](docs/PRODUCT_DIRECTION.md).

**ZikVault now works on the device**: documents the user picks are stored encrypted in
the browser and read there with on-device OCR, producing suggestions the user reviews.
Nothing is uploaded, and nothing it reads is a check that a document is genuine.
**Zik ID** can be applied for but not issued — Zik has not defined the identity checks
or the issuer, so an application stops at `pending_onboarding`. See
[ADR 007](docs/decisions/007-vault-v2-local-analysis.md),
[the analysis capability and results](docs/VAULT_LOCAL_ANALYSIS.md) and
[the onboarding decisions still needed](docs/ZIK_ID_ONBOARDING_DEPENDENCIES.md).
Planned prices are illustrative and cannot be charged here.

## Surfaces

The product now has two distinct surfaces plus a small set of legacy/dev screens.

**Customer** (`components/customer/*`, mobile-first, bottom tab bar):

| Route | Purpose |
| --- | --- |
| `/home` | Landing. One primary "Get Zik Pass" action + returning-user "Open my pass". `/` redirects here. |
| `/find` | Store finder: postcode/area search, "Use my location", schematic map + accessible list, open/closed + distance. |
| `/get-pass` | Onboarding. Physical-only: 6-char code + QR, live checklist, device check, payment, issuance.  |
| `/pass` | The wallet. Empty / pending / activating / active / expired, plus delete, PWA install, and PWA-launch handoff claim. `/wallet` redirects here. |
| `/card` | Activate a physical Zik Pass card bought at a till (the printed-card QR target). |
| `/help` | Accepted ID, common failure recoveries, "about this build", and (demo only) a **Reset demo data** button. |
| `/ecosystem` | Read-only Zik product ladder, planned local-first credentials and illustrative selective sharing. |
| `/about` | Longer explanation for customers, stores and participating sites. |
| `/offline` | Branded offline page served by the service worker. Branded `404` and error pages also exist. |

**Operator** (`components/operator/*`, staff-facing, no bottom nav):

| Route | Purpose |
| --- | --- |
| `/verify` | Clerk verification: bind the terminal to a store, look up the customer's 6-char code, confirm or reject the in-person ID check. Sends `x-zik-store-id` so a code from another store is rejected. |
| `/verify/purchase` | Clerk-first sale: the customer brings the purchase card to the till without starting on their phone. Clerk checks ID, records the till payment, then shows a private activation QR. See [`docs/PURCHASE_SALE_FLOW.md`](docs/PURCHASE_SALE_FLOW.md). |
| `/store` | Retired - redirects to `/verify`. The customer store finder + `/verify/purchase` cover its old roles. |
| `/issuer` | Demo issuer/enrollment and error-report view (still on the older shell). |

**Legacy / dev** (kept as regression paths, not in any navigation):

- `/onboarding`, `/wallet?flow=physical…` — the original 4,285-line `WalletSurface`. Still exercises the same issuance state machine and the older mocked remote/bank pipeline.
- `/verify/zik` — hosted relying-party verifier demo (validates a presentation locally).
- `/ZikParental` — an unlinked placeholder.

## Customer onboarding (physical)

1. Pick a store on `/find`. (Or, for the clerk-first sale, the customer just brings a purchase card to the till - see `/verify/purchase`.)
2. `/get-pass` reserves a store session and starts a physical enrollment, which produces a short customer code + QR.
3. The customer shows the code to a clerk; the clerk looks it up on `/verify` and confirms the in-person ID check. The customer's ID is inspected visually and handed back — never scanned, photographed or stored.
4. The customer's device completes device authentication. WebAuthn is used where the browser exposes it; `demo_device_check` is the prototype fallback.
5. Issuance is gated by a **confirmed payment record**. Options: cash/card at the till (clerk confirms), or the clearly labelled **Zik demo checkout** simulator (deterministic success / decline). In the clerk-first `/verify/purchase` flow the clerk records the till payment before showing the activation QR, so the customer is never asked to pay in-app. If the configured price is `0`, a free flow replaces the payment step.
6. The signed pass is stored on the device and shown on `/pass`.

The older non-physical enrollment pipeline (`/onboarding` remote lane) remains for regression only. It uses mocked provider responses and is not a live financial or identity integration.

### Affiliate age verification (demo)

- `/affiliate-demo` is a local-only demonstration of a third-party 18+ site integrating with Zik Pass using a genuine OAuth-style authorization-code protocol, not the older `postMessage`-based verifier. The demo site is styled as **JerkMeat**, an original food-only parody (no explicit content, no real branding).
- The visible "Verify with Zik" control only starts a server-tracked authorization request; the actual decision is a server-validated, one-time cryptographic challenge signed by the wallet's holder key, never a browser-only `verified: true` flag.
- `/affiliate-demo/confirm` is the Zik-hosted confirmation step. It reuses the existing wallet/presentation-bundle machinery to sign the server-issued challenge, then redirects back to the affiliate with a short-lived, single-use authorization code (or no code, on denial).
- `/affiliate-demo/callback` simulates the affiliate's backend exchanging that code (`POST /api/affiliate/token`, server-to-server). The affiliate never trusts the browser directly. On success it sets its own signed, HttpOnly age-session cookie (≤30 min, capped by pass expiry); `/affiliate-demo/continue` re-checks that cookie server-side.
- A successful exchange returns only `{ age_over, threshold, assurance, verified_at, expires_at, verification_id }`. No name, date of birth, address, government ID, selfie/biometric data, raw credential payload, holder private key, or reusable Zik Pass identifier is ever included.
- Every denial path (no pass, expired pass, replay, wrong audience/nonce/state, expired challenge/code, cancellation, unsupported device, server error) surfaces as the same calm, generic message: no stack traces, internal reasons, or raw tokens are shown or logged.
- A fully **standalone** JerkMeat app lives in the sibling repo `../jerkmeat` (port 3001). It authenticates to Zik's `authorize`/`token` endpoints as a separately registered `jerkmeat` client (`ZIK_JERKMEAT_*`), owns its own callback and session signing, and imports no Zik internals. Absent config fails closed. See [`docs/AFFILIATE_CUSTOMER_FLOW.md`](docs/AFFILIATE_CUSTOMER_FLOW.md).
- See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the challenge/code lifecycle and [`docs/TESTING.md`](docs/TESTING.md) for the manual walkthrough.

### Device delivery

- The browser wallet stores the holder key and credential in browser storage (IndexedDB) for this prototype.
- **My pass → Add to another device** creates a short-lived handoff and supports PWA installation/recovery. The PWA `start_url` is `/pass?source=pwa`; `/pass` runs the handoff-claim + `/api/pwa/handoff/recover` logic on load.
- The native scaffold lives in `mobile/`. Native handoff URLs use `zik://handoff?token=...`, but the Expo app is not yet the production wallet.
- A handoff claim is idempotent for the same holder key. A different device key can be bound to the same logical credential when the device policy allows it.

### Wallet device policy

- Each issued pass has a persisted device-binding ledger.
- The default included device limit is two.
- A further device requires a confirmed `device_extension` payment. Payment and device authorization are serialized and idempotent.
- Adding a device does not mint a new logical pass ID. In the current customer UI this is described as done in store; the `ExtendPassPanel` self-service flow is still wired only into the legacy `/wallet` surface.

The full page/API route list and request ownership is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Design system

The customer and operator surfaces share one token system (`app/globals.css` `--zk-*` variables, scoped by `.zk-surface`), the Manrope typeface (`next/font`), a single icon family, and shared primitives in `components/customer/ui.tsx` (`Button`, `Card`, `Alert`, `Sheet`, `StatusBadge`, …). `CustomerShell` and `OperatorShell` own the header, navigation, offline banner, and layout. Reuse `ZikLogoMark` and these primitives before introducing new visual language.

## Repository layout

```text
app/                 Next.js App Router pages and API route handlers
components/customer/  New customer surface: shell, screens, onboarding, UI primitives
components/operator/  Staff surface: shell, clerk verify, purchase sale
components/           Legacy WalletSurface, affiliate/issuer screens, shared marks
lib/client/          Browser key, wallet, PWA, and error-reporting clients
lib/server/          Enrollment, physical journey, purchase sale, payment, binding, storage, crypto, affiliate
lib/shared/          Types, config, stores catalogue, demo-environment, payment-config, crypto, journey helpers
mobile/              Expo native-wallet scaffold, not yet the primary delivery path
tests/               Vitest unit and integration-style service tests
e2e/                 Playwright end-to-end journeys (customer / clerk / affiliate)
data/                Seed state and example issuer key material only
docs/                Architecture, testing, flow docs, demo script, sprint status
```

## Local setup

Requirements: Node.js compatible with the installed Next.js toolchain and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (it redirects to `/home`). Use `npm run dev -- --port 3001` for another port. HTTPS or `localhost` is required for the Web Crypto / WebAuthn APIs the wallet uses.

Useful commands:

```bash
npm run lint
npm test          # Vitest service tests
npm run e2e       # Playwright journeys (reuses a dev server on :3000)
npm run build
```

### Demo environment

`ZIK_ENV` (`demo` | `test` | `live`), not `NODE_ENV`, gates demo tooling. It defaults to `demo`; `live` is never selected implicitly and no live payment path ships in this milestone. `POST /api/demo/reset` (demo only) clears all transient runtime state — there is a **Reset demo data** button on `/help`. A five-minute walkthrough is in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

See [`docs/TESTING.md`](docs/TESTING.md) for predictable manual flows, including the clerk lookup, payment gate, PWA handoff, device extension, and recovery paths.

## Persistence and configuration

The prototype uses JSON-backed state with a serialized mutation queue. By default, runtime state and the generated issuer key are written under `data/`. Set `ZIK_RUNTIME_DATA_DIR` to point at another writable directory. In serverless-looking environments, the implementation falls back to a temporary directory, so persistence is not durable.

- Seed state: [`data/state.json`](data/state.json)
- Runtime state: `runtime-state.json` in the configured runtime data directory
- Issuer key: `issuer-keypair.json` in the configured runtime data directory
- Browser wallet: IndexedDB/local browser storage, depending on the wallet client path

All supported environment variables are documented in [`.env.example`](.env.example). Never commit `.env`, runtime state, or generated issuer keys.

## Prototype boundaries

- Provider, bank, identity, and payment integrations are mocked.
- **Payment is test-only.** The "Zik demo checkout" is a clearly labelled deterministic simulator; a clerk "payment received" is an asserted till payment, not settlement evidence. No card details are collected or charged. **Real Apple Pay is not wired** — the Stripe Express Checkout route only appears when `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set, and a verified Apple Pay test additionally needs a registered HTTPS payment domain, a webhook secret, and an Apple Pay-capable device. Until then, treat Apple Pay as unverified regardless of simulator results.
- Store plans, platform shares, and payment settlement records are shaped for demonstration and are not connected to a payment processor or accounting system.
- The JSON store is not suitable for multi-instance production deployment or concurrent processes on separate hosts.
- Retail verification, purchase-sale, store and issuer surfaces are demo screens using one shared clerk token; production needs authenticated staff sessions, per-terminal credentials, RBAC, audit controls, rate limits, and abuse monitoring.
- `demo_device_check` is not equivalent to a platform biometric assertion.
- Browser-held keys are not hardware-backed. The native scaffold is the future path for stronger key protection.
- The cryptographic design is a prototype and has not received a production security review. It is **not** a zero-knowledge proof and must not be described as one.
- The store finder uses a fictional, coordinate-backed London catalogue and a labelled *schematic* map, not real map tiles or a real geocoder. All demo stores and affiliate sites are invented.
- The service worker offers an honest offline shell only (previously-viewed pages + a branded `/offline`). Age verification, payment and clerk actions require connectivity and are never cached. Real Safari/iPhone/PWA behaviour and the offline shell still need testing on a physical device.
- The embedded affiliate demo registers one hardcoded client (`nightfall-demo`, allowlisted redirect URI, no per-client secret). The standalone JerkMeat client (`jerkmeat`) uses a bearer secret but is still a prototype arrangement, not a production affiliate-onboarding contract. An already-granted affiliate age-session is not revoked when the pass is deleted.
- The separate public-launch backlog (durable DB + distributed transactions, real staff auth/RBAC, secure recovery, rate limits, audited key custody/rotation, processor settlement/refunds, monitoring, retention/privacy review) is unchanged. Revalidate `AUDIT.md` against the final implementation.

## Working agreements for contributors

- Keep product ownership and final architecture decisions with the project owner.
- Prefer existing shared types and service boundaries over adding route-local state models.
- Keep API handlers thin: validate input, call a server service, and return a stable response shape.
- Preserve idempotency for retryable operations such as handoff claims, payment confirmation, and device authorization.
- Do not log raw identity data, private keys, handoff tokens, or payment details.
- Add or update a focused Vitest test when changing a shared service or state transition.
- Check mobile and desktop states for user-facing changes, especially recovery, modal overflow, and fixed navigation.

For the system map and extension points, start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), then [`docs/TESTING.md`](docs/TESTING.md).

## Zik Vault documents and selective disclosure

`/vault` is a working device Vault: import from the file picker, camera or a chosen
folder, consent separately to storing and to reading, real local OCR, review of what
was found, and a Zik ID application that stops at pending onboarding. Run
`npm run fixtures` for synthetic test documents and `npm run measure:ocr` to reproduce
the measured extraction results.

`/retail-demo` selective disclosure is separate and still gated: enable explicitly
with `ZIK_DISCLOSURE_V1=true`; the default is off. Name/address/email are self-entered,
separate from the signed age pass. Zik disclosure endpoints receive only encrypted
profile fields; the co-hosted demo merchant is the decryption boundary.

See [demo/setup/reset](docs/sprint-6/DEMO.md), [data and threat model](docs/sprint-6/SECURITY_AND_DATA.md),
[claims](docs/sprint-6/CLAIMS.md), and [handoff/evidence](docs/sprint-6/HANDOFF.md).
Investor-ready vertical slice; not certified or approved for public reliance.

The preserved `/id` and `/verify/id` experiment also contains session and peer-presentation logic. These direct demo routes are outside the new product navigation and are not the planned verified Zik ID product.
