# ZikPass testing guide

Use the automated checks first, then use the manual flows below when changing customer, clerk, wallet, or mobile behavior.

## Automated checks

```bash
npm test          # Vitest service tests (JSON runtime store)
npm run lint
npx tsc --noEmit
npm run e2e        # Playwright journeys; reuses a dev server on :3000, resets demo state per test
npm run build      # do NOT run while `npm run dev` owns .next
```

Vitest tests use the JSON runtime store and may modify the runtime state directory during a run; do not point `ZIK_RUNTIME_DATA_DIR` at data you need to keep. Playwright (`e2e/`, `playwright.config.ts`) drives the real dev server and calls `POST /api/demo/reset` in each `beforeEach`, so keep `ZIK_ENV=demo` on the target.

Coverage highlights:

- `tests/affiliate-verifier.test.ts` + `affiliate-demo-session.test.ts` + `affiliate-external-client.test.ts` cover the affiliate flow end to end with real signed credentials: minimal result shape, every denial path, unregistered redirect URIs, hostile `state`, cookie tampering / expiry capped by pass expiry, replay rejection, and external-client bearer auth.
- `tests/purchase-sale.test.ts` covers ID/payment ordering, wrong-store and unauthorised access, full issuance, parallel idempotent claims, second-device rejection, generic-endpoint bypass prevention, rejected sales, expired-QR rotation.
- `tests/physical-flow.test.ts` covers multi-store operator scoping (a non-Oxford store completes; a cross-store clerk is rejected).
- `e2e/`: self-directed journey, clerk-first purchase sale (one till payment, customer activates from the QR), payment decline → retry, delete-pass → empty state, cross-store rejection, location-denied fallback, branded 404, affiliate no-pass + approve.

## Basic local run

```bash
cp .env.example .env
npm run dev
```

Open `http://localhost:3000` (redirects to `/home`). Use `localhost`, not a LAN IP over plain HTTP — an insecure origin disables Web Crypto / WebAuthn in many browsers. Use the **Reset demo data** button on `/help` (or `curl -X POST localhost:3000/api/demo/reset`) between manual runs.

## Manual physical flow (self-directed)

1. `/find` → search a postcode (e.g. `EC1`) or "Use my location" → open a store → **Choose this store**.
2. On `/get-pass`, tap **Start**. Note the 6-character code (and QR).
3. Open `/verify` in a second window. Set **This terminal** to the store you picked. Enter the code → **Find session**.
   - Check: the wrong terminal store → "not authorised for the requested store session"; malformed/unknown codes leave the form usable.
4. **Confirm 18+** as the clerk.
5. Back on the customer device: the device check runs automatically. Then the **payment** step unlocks. Pay via **Zik demo checkout** (try **Simulate a declined card** first — the sheet stays open with a retry), or **Cash or card at the till** (the clerk confirms it on `/verify`).
6. Confirm the flow reaches **Your pass is ready** and `/pass` shows an active pass with a `zp_…` id.

Server-side order: physical session usable → clerk lookup/verification → device authentication → confirmed `pass_issuance` payment → issuance.

## Manual clerk-first purchase sale

The customer brings a Zik purchase card to the till with no phone interaction.

1. `/verify/purchase` (also linked from `/verify`). Select the terminal store → **Start sale**.
2. **ID checked — confirm 18+** (or **Cannot verify** → stops, no payment).
3. **Payment received — show QR** (cash or card at the till).
4. The activation QR appears only now. Open it on the customer device (`/card#activate=…`) → **Save my Zik Pass** → the device check runs. No store pick, no repeat ID check, no in-app payment.
5. `GET /api/payments/<enrollmentId>` should show exactly one confirmed `pass_issuance` payment (`cash_in_store` or `retail_till`).
6. Clerk: **Check customer progress** → **Next customer**.

See [`docs/PURCHASE_SALE_FLOW.md`](PURCHASE_SALE_FLOW.md) for recovery / QR-rotation details.

## PWA handoff and interruption recovery

1. Complete issuance in the browser wallet.
2. `/pass` → **Add to another device** → **Install on this device**.
3. On iPhone, Share → Add to Home Screen. On Android, Install app / Add to Home Screen.
4. Open the installed app. The URL may include `source=pwa` and a one-time `handoff_token`; `/pass` should claim it and settle on `/pass?source=pwa`. Bare `/wallet?source=pwa` links are redirected across.
5. Confirm the same logical Pass ID after the handoff.
6. To test an interrupted handoff, stop before launching the installed app (or simulate a lost refresh), then reopen the PWA. `/api/pwa/handoff/recover` recovers the latest unclaimed handoff and issues a replacement token.

The handoff is short-lived and single-use; a repeated claim with the same holder key is idempotent. A different device key is subject to the device-binding limit and payment policy.

## Device extension

The self-service `ExtendPassPanel` is currently wired only into the legacy `/wallet` surface (`/wallet?flow=physical`… enters `WalletSurface`).

1. With a pass already issued, open the legacy wallet and expand the pass card.
2. Choose `Extend pass` and generate the device handoff.
3. Claim it from another browser/device. The first two active bindings authorize under the default config.
4. A third device shows `payment_required` and offers the demo extension payment path.
5. Confirm the demo extension payment, retry the handoff, verify the third device is linked.
6. Repeat the payment or claim to verify no duplicate bindings and no double-consumed entitlement.

## Affiliate age verification demo

1. Open `/affiliate-demo` (the **JerkMeat** demo site). Confirm the demo label, the food-only parody content, and no explicit or real branding.
2. Click **Verify with Zik** → you land on `/affiliate-demo/confirm`.
3. With no pass on the device, the confirm screen reports no active pass and offers **Open my pass** and a way back. The return path shows the single generic denial sentence — never an internal reason, stack trace, or raw token.
4. Complete onboarding in the same browser to get a real pass, then repeat from step 1. Approving redirects to `/affiliate-demo/callback` with `code` and `state`; the demo backend exchanges it server-to-server and the callback shows only the minimal result (age over threshold, assurance, verified/expiry timestamps, verification id) and sets a signed HttpOnly age-session cookie. `/affiliate-demo/continue` should now open.
5. Reload with the same `code` → replay rejected with the generic message. Reload `/affiliate-demo` with a valid session cookie → the gate restores the verified state without visiting Zik; delete the cookie or wait past expiry → it asks again.
6. Confirm `GET /api/affiliate/result/[id]` only includes `challenge` while `status === "pending"`, and `POST /api/affiliate/token` only ever returns the generic message on failure.

The standalone JerkMeat app (`../jerkmeat`, port 3001) exercises the same protocol as a separately authenticated external client; see its own README.

## Error and recovery checks

Exercise at least one failure from each category:

- malformed or unknown clerk code; wrong-store terminal
- expired physical session or customer code
- expired/replayed handoff token; expired paid purchase-sale QR
- simulated declined payment followed by retry (sheet stays open); cancellation is not treated as failure
- device limit reached without payment
- lost customer heartbeat during a clerk session
- browser without Web Crypto/WebAuthn support
- offline: load a previously-visited customer page (works), then `/find` or `/get-pass` (shows `/offline`); the offline banner appears

The UI should preserve the latest known state, show a clear recovery action, and offer user reporting where the error cannot be recovered locally. Reports are redacted before persistence and return a reference.

## Responsive / a11y checklist for UI work

- Check 320 / 390 / 768 / 1440. Fixed bottom nav and header must not overlap content; content column stays centred.
- Keyboard: skip link focusable first; logical tab order; the menu `<dialog>` traps focus and returns it to the hamburger on Escape/close.
- Payment, recovery, handoff and clerk-lookup states announce to assistive tech (`aria-live`).
- `prefers-reduced-motion`: the logo float, hero fade and Zignature draw stop.
- Homepage splash appears on first visit and is suppressed for the configured window on refresh.
- No horizontal body scroll; the schematic map and any wide content scroll inside their own container.

## Physical-device testing (still required)

Chromium automation and the in-app preview browser do **not** register service workers and cannot present a real Apple Pay sheet. On a physical iPhone/Safari, still verify: install to home screen, PWA launch + handoff claim, offline shell, reduced-motion, safe-area insets, and — if/when Stripe is configured — a real Apple Pay test transaction.
