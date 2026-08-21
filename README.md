# ZikPass

ZikPass is a privacy-first age-assurance prototype. It demonstrates an in-person identity check, device authentication, a signed over-18 credential, a browser wallet, and a path towards a native wallet. The current implementation is a working prototype, not a production identity, payments, or compliance service.

This branch is `v2-ui-overhaul`. The branch is currently aligned with `origin/v2-ui-overhaul`; `main` and `dev` are older parallel branches and are intentionally not merged as part of routine local setup.

## Current product flows

### Customer onboarding

- `/` is the customer-facing homepage and physical-first entry point.
- `/onboarding` is the customer onboarding surface. App-led onboarding can begin without a store; affiliate-led onboarding can include store/session context in the URL.
- A physical enrollment creates a short customer code. The customer shows that code to the clerk, the clerk looks it up, and the clerk confirms the physical ID check.
- The customer then completes device authentication. WebAuthn is supported where the browser exposes it; `demo_device_check` is available for prototype testing.
- Issuance is gated by a confirmed payment record. Cash/card-at-till and digital-wallet paths are represented, but digital wallet confirmation is explicitly demo-only.
- `/wallet` displays the saved pass, its status, device storage state, and wallet actions.

The older non-physical enrollment pipeline remains in the codebase for regression and prototype comparison. It uses mocked provider responses and should not be described as a live financial or identity integration.

### Store and clerk flow

- `/store` creates and monitors demo store sessions.
- `/verify` is the clerk-facing verification screen. It accepts a customer code, reports unknown or malformed codes, and advances the associated physical session after a clerk confirmation.
- `/issuer` is a demo operational view for inspecting enrollments and error reports.
- `/verify/zik` is a hosted verifier demo that validates a presentation locally.

### Device delivery

- The browser wallet stores the holder key and credential in browser storage for this prototype.
- `Install ZikPass on this device` creates a short-lived handoff and supports PWA installation/recovery. The PWA route is `/wallet?source=pwa`.
- The native scaffold lives in `mobile/`. Native handoff URLs use `zik://handoff?token=...`, but the Expo app is not yet the production wallet.
- A handoff claim is idempotent for the same holder key. A different device key can be bound to the same logical credential when the device policy allows it.

### Wallet device policy

- Each issued pass has a persisted device-binding ledger.
- The default included device limit is two.
- A further device requires a confirmed `device_extension` payment. Payment and device authorization are serialized and idempotent.
- The wallet calls this action `Extend pass`; it does not mint a new logical pass ID.

## Route map

| Route | Responsibility |
| --- | --- |
| `/` | Homepage and primary customer entry point |
| `/onboarding` | Customer onboarding and physical/app-led flow |
| `/wallet` | Saved-pass wallet; accepts physical query context for direct entry |
| `/verify` | Clerk verification and customer-code lookup |
| `/verify/zik` | Demo relying-party verifier |
| `/store` | Demo store session dashboard |
| `/issuer` | Demo issuer/enrollment and error-report view |
| `/app/handoff` | Native-wallet fallback and web-wallet installation handoff |
| `/ZikParental` | Placeholder product surface for parental controls |

The complete API route list and request ownership are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository layout

```text
app/                 Next.js App Router pages and API route handlers
components/          Customer, clerk, issuer, wallet, recovery, and shared UI
lib/client/          Browser key, wallet, PWA, and error-reporting clients
lib/server/          Enrollment, physical journey, payment, binding, storage, and crypto services
lib/shared/          Types, config, crypto, journey/status helpers, and verifier SDK
mobile/              Expo native-wallet scaffold, not yet the primary delivery path
tests/               Vitest unit and integration-style service tests
data/                Seed state and example issuer key material only
docs/                Current architecture, testing, and contributor guidance
```

## Local setup

Requirements: Node.js compatible with the installed Next.js toolchain and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To use another port:

```bash
npm run dev -- --port 3001
```

Useful commands:

```bash
npm run lint
npm test
npm run build
```

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
- The online wallet payment path is a demo confirmation; no card details are collected or charged.
- Store plans, platform shares, and payment settlement records are shaped for demonstration and are not connected to a payment processor or accounting system.
- The JSON store is not suitable for multi-instance production deployment or concurrent processes on separate hosts.
- Retail verification and issuer surfaces are demo screens; production authentication, authorization, audit controls, rate limits, and abuse monitoring are still required.
- `demo_device_check` is not equivalent to a platform biometric assertion.
- Browser-held keys are not hardware-backed. The native scaffold is the future path for stronger key protection.
- The cryptographic design is a prototype and has not received a production security review.

## Working agreements for contributors

- Keep product ownership and final architecture decisions with the project owner.
- Prefer existing shared types and service boundaries over adding route-local state models.
- Keep API handlers thin: validate input, call a server service, and return a stable response shape.
- Preserve idempotency for retryable operations such as handoff claims, payment confirmation, and device authorization.
- Do not log raw identity data, private keys, handoff tokens, or payment details.
- Add or update a focused Vitest test when changing a shared service or state transition.
- Check mobile and desktop states for user-facing changes, especially recovery, modal overflow, and fixed navigation.

For the system map and extension points, start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), then [`docs/TESTING.md`](docs/TESTING.md).
