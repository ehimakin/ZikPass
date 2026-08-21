# ZikPass testing guide

Use the automated checks first, then use the manual flows below when changing customer, clerk, wallet, or mobile behavior.

## Automated checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Tests are Vitest-based and use the JSON runtime store. They may modify the runtime state directory during a run; do not point `ZIK_RUNTIME_DATA_DIR` at a directory containing data you need to preserve.

`tests/affiliate-verifier.test.ts` covers the affiliate demo end to end using real signed credentials (not mocks): a successful verification with the exact minimal response shape, every denial path (no pass, expired pass, invalid signature, wrong audience/nonce/state, malformed challenge, replayed challenge, replayed/expired authorization code, cancellation), unregistered redirect URIs, oversized/hostile `state` values, redaction of the returned fields, and idempotent duplicate authorization requests.

## Basic local run

```bash
cp .env.example .env
npm run dev
```

Use `http://localhost:3000` for Web Crypto/WebAuthn behavior. A LAN IP over plain HTTP is an insecure origin in many mobile browsers and can disable signing or device-auth APIs. HTTPS or localhost is required for the browser capabilities used by the prototype.

## Manual physical flow

1. Open `/store` and create a demo store session.
2. Open the customer onboarding URL supplied by the session, or open `/onboarding` for an app-led flow.
3. Start the physical flow and note the short customer code.
4. Open `/verify` in a second browser window/device and enter the code.
5. Confirm that malformed or unknown codes produce an error state and leave the form usable.
6. Confirm the physical ID check as the clerk.
7. Return to the customer device and complete device authentication. Use `demo_device_check` when testing without a platform authenticator; use WebAuthn where available.
8. Choose a payment method. Cash/card remains pending until the clerk confirms it. The digital-wallet option is a clearly labelled demo confirmation.
9. Confirm the enrollment reaches issuance and the pass appears in the wallet.
10. Tap `Done` and verify navigation to `/wallet`.

The expected server-side order is: physical session usable -> clerk lookup/verification -> device authentication -> confirmed pass-issuance payment -> credential issuance.

## PWA handoff and interruption recovery

1. Complete issuance in the browser wallet.
2. Tap `Install ZikPass on this device`.
3. On iPhone, use Share -> Add to Home Screen. On Android, use Install app/Add to Home Screen.
4. Open the installed web app. The URL may first include `source=pwa` and a one-time `handoff_token`; the wallet should claim it and then settle on `/wallet?source=pwa`.
5. Confirm the same logical Pass ID is visible after the handoff.
6. To test an interrupted handoff, stop before launching the installed app or simulate a lost refresh, then reopen the PWA. `/api/pwa/handoff/recover` should recover the latest unclaimed handoff for the client address and issue a replacement token.

The handoff is short-lived and single-use, but a repeated claim with the same holder key is idempotent. A different device key is subject to the device-binding limit and payment policy.

## Device extension

1. With a pass already in `/wallet`, expand the pass card.
2. Choose `Extend pass` and generate the device handoff.
3. Claim it from another browser/device.
4. The first two active device bindings should be authorized under the default configuration.
5. Attempt a third device. It should show `payment_required` and offer the demo extension payment path.
6. Confirm the demo extension payment, retry the handoff, and verify the third device is linked.
7. Repeat the payment or claim request to verify it does not create duplicate bindings or consume the same entitlement twice.

## Affiliate age verification demo

1. Open `/affiliate-demo` and confirm the "Demo environment" label, the restrained non-explicit copy, and that no explicit branding or copyrighted content is shown.
2. Click `Use ZikPass to confirm I am 18+`. You should land on `/affiliate-demo/confirm`.
3. With no pass on the device, the confirm screen should report no active pass and offer `Open Zik wallet` and `Return to Nightfall`. Choosing `Return to Nightfall` should redirect to `/affiliate-demo/callback`, which shows the single generic denial sentence — never an internal reason, stack trace, or raw token.
4. Complete onboarding in the same browser to obtain a real pass, then repeat from step 1. Approving on the confirm screen should redirect to `/affiliate-demo/callback` with a `code` and `state` in the URL; the callback screen exchanges it server-to-server and shows only the minimal result (age over threshold, assurance, verified/expiry timestamps, verification ID) — no name, date of birth, or other identity data.
5. Reload `/affiliate-demo/callback` with the same URL (same `code`) to confirm a replayed code is rejected with the generic denial message rather than being honored twice.
6. Confirm `GET /api/affiliate/result/[id]` only includes the `challenge` field while the request is still pending, and that `POST /api/affiliate/token` never returns anything but the generic message on failure, regardless of the underlying reason.

## Error and recovery checks

Exercise at least one failure from each category:

- malformed or unknown clerk code
- expired physical session or customer code
- expired/replayed handoff token
- failed demo payment followed by retry
- device limit reached without payment
- lost customer heartbeat during a clerk session
- browser without Web Crypto/WebAuthn support

The UI should preserve the latest known state, show a clear recovery action, and offer user reporting where the error cannot be recovered locally. Reports are redacted before persistence and return a reference for issuer/support inspection.

## Regression checklist for UI work

- Homepage splash appears on first visit and is suppressed for the configured time window on refresh.
- Header navigation remains reachable during scroll and does not overlap page content.
- Status footer is present and collapsed by default where configured.
- Onboarding and final-pass modal content stays within a narrow mobile viewport.
- Payment, recovery, and handoff states announce changes to assistive technology.
- Desktop layout does not rely on a scrollbar appearing/disappearing to align tab content.
