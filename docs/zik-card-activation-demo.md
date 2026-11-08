# Physical Zik Card activation demo

This development-only flow is separate from pass issuance, purchase sales and payments. It creates no credential, no real verification attestation and no cryptographic device binding.

## Routes

- `/verify`: authenticated clerk entry, **Activate Zik Card**.
- `/verify/card`: store/session-bound scanner and activation controls. Unauthenticated clerks go through the existing `/store` login and return here.
- `/card/pair`: customer companion. Enter the private pairing code, or open the QR containing a fragment token. The token is removed from the address bar after reading it.
- `POST /api/demo/card-activation`: demo adapter endpoint. Clerk actions use the existing signed, HTTP-only operator cookie, never a client-supplied store ID. Cross-origin writes are rejected.

All new pages, service actions and endpoints are excluded when `NODE_ENV=production` (even `ZIK_ENV=demo`), or when `ZIK_ENV=live`. Production builds have no simulation fallback. The existing application's broader demo gate is intentionally not used here.

## Complete demo on two devices

1. Run `npm run dev -- --hostname 0.0.0.0`. Use the same development-server origin for both devices. For example, both can visit `http://192.168.1.20:3000`; the QR uses the clerk's current origin, so do not use localhost on the clerk if the customer is another device.
2. Log in at `/store`, select a store, use the configured `ZIK_CLERK_LOGIN_CODE` (default demo code `8640`), and select **Activate Zik Card**.
3. Enter `ZKC-DEMO-000001`. Cards `000001` through `000100` are eligible mock inventory. A QR or Code128/Code39 barcode may encode either that serial or `ZIKCARD:1:ZKC-DEMO-000001`. Nothing scans or navigates arbitrary URLs.
4. The clerk can explicitly start camera scanning. Browser-native BarcodeDetector support is required; unsupported browsers offer manual serial entry. Camera access requires HTTPS, or localhost. For actual phone camera scanning, use a trusted HTTPS development origin. On HTTP LAN, manual serial entry and the companion pairing screen still work; the mock identifier has no security properties. No hardware identifiers are collected.
5. Scanning the card opens **Additional document services**. Eligible demo inventory assumes the Zik Pass age check and payment already occurred at purchase. This is a server-side mock flag, not confirmation against a real till record.
6. The placeholder reserves a future step for additional in-person document verification and its **separate payment gateway**. It collects no documents or payment data, performs no verification and charges nothing. Press **Continue to customer QR** to skip that unimplemented service and reveal the private pairing QR/code.
7. The customer opens the QR or enters the code at `/card/pair`, then presses **Connect this demo device**. Both screens show **Device connected — confirm binding**. Merely scanning, pairing or reconnecting does not complete activation.
8. The customer presses **Bind verification to this device (demo)**. This explicitly completes the mock association of the purchased card's pre-existing verification to the demo device. Both screens show **Completed**. There is no repeat clerk age check, Zik Pass payment or final clerk activation button.
9. Without a second device, after displaying the QR use **Simulate customer pairing (development only)** followed by **Simulate customer binding confirmation**. These remain separate, clearly labelled demo actions.

The customer stores a random `demo-public-key:<UUID>` identifier in sessionStorage. It is deliberately not a public key, keypair, proof of possession or hardware identifier. Refresh in the same tab preserves it; reconnect with the same pairing token and identifier cannot advance activation. A different identifier is rejected after the first connection. Losing storage does not authorize transferring the connection; cancel an unfinished session through its original clerk login and start anew.

## Lifecycle and failure cases

- Five-minute sessions; status polls expose expiry. Expired/cancelled sessions cannot pair or activate. A new session has new secrets.
- Repeated scans return the same live session to the same signed clerk login. A different login or store sees unavailable.
- Repeated customer binding confirmations are idempotent. A completed serial cannot be activated again or transferred.
- The clerk tab remembers only its session ID. Polls/reconnects never activate anything.
- Previous-version unfinished demo sessions are cancelled rather than silently adopting this changed flow. Completed bindings are preserved.
- Completed same-device customer reconnects display completion. No new association is created.
- Fixtures: `ZKC-DEMO-999998` = already activated; `ZKC-DEMO-999999` = unavailable; `ZKC-DEMO-123456` = unknown. URLs and malformed strings = invalid.
- Camera tracks stop on stop, successful scan, scanner unmount, page departure, hidden tab, errors, and late permission resolution after cancellation. No images are uploaded or retained.
- No animation is required, so reduced-motion users get the same interface. Manual inputs, explicit labels, keyboard actions and live status messages are provided.

## Adapter and storage

`CardDemoAdapter.transact` is the replaceable persistence boundary in `lib/server/card-activation-demo.ts`. The default adapter serializes mutations within a single Node process, writing an atomic JSON file `card-activation-demo.json` in the existing runtime data directory (`ZIK_RUNTIME_DATA_DIR` override supported). State survives reload/server restart. It must not be used across multiple processes or instances. Tests inject isolated in-memory adapters.

Only fictional demo serials, clerk/store references, session expiry, pairing secrets, a mock purchase-verified-and-paid flag and a mock association are stored. No IMEI, hardware serial, ID image, face data, payment or production credential is stored. Demo pairing secrets are plaintext in this development-only file; keep the development server private. Stop the server and remove only this file to reset demo activations.

## Verification

`npx vitest run tests/card-activation-demo.test.ts` checks parsing, registry states, prerequisites, duplicate scans/activation, original-store ownership, device transfer prevention, cancellation/expiry and production endpoint exclusion. `ZIK_NEXT_DIST_DIR=.next-sprint6-card-demo ZIK_E2E_BASE_URL=http://localhost:3012 ZIK_RUNTIME_DATA_DIR=/tmp/zik-card-fresh-run npx playwright test e2e/card-activation.spec.ts` exercises separate clerk/customer browser contexts; use a fresh isolated development server/runtime directory because successful card activations persist (choose a new runtime directory on reruns). The two browser tests cover the complete separate-context journey and a stubbed camera start/stop/scan lifecycle. Real camera decoding and permissions on physical phones still need manual testing. ESLint and `npx tsc --noEmit` cover the new routes/components.

## Before production

Replace mock inventory with authenticated card provisioning and purchased-card eligibility, including trusted records of the prior in-person age check and payment. Design the additional document-verification service and its independent pricing/payment gateway separately from Zik Pass. Use transactional database locks/unique constraints, multi-instance-safe state, protected audit events with named clerk identities, rate limits and brute-force controls, hashed/rotatable pairing secrets, idempotency keys and reviewed CSRF/origin/proxy policy. Define ID acceptance/age checks, staff training, revocation, replacement/recovery and device-transfer policy. Replace the UUID with a device-generated public key plus proof-of-possession challenge, binding the card and genuine clerk verification event under a reviewed trust model. Audit privacy, retention, accessibility, barcode support and real-device camera cleanup. Secure binding, identity verification and credential issuance require separate security design and implementation; none is implied by this demo.
