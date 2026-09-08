# ZikPass production-quality prototype overhaul

Review date: 6 September 2026. Baseline: commit `675a050`.

## Recommended target

Make ZikPass a complete, distinctive, mobile-first web/PWA experience: discover a verification point, understand the price and ID requirements, complete an in-person check, pay, activate a pass, and use it with an affiliate. Uber/Deliveroo are references for clarity, continuity, feedback and confidence—not branding to copy.

Keep the existing signed credential and server state machinery. Finish the product around it. The deliverable is a convincing, repeatable prototype with genuine test integrations, not certification for public identity verification or live financial settlement. Native-wallet production work is a separate milestone.

## Evidence from this repository

| Area | Current state | Implication |
| --- | --- | --- |
| Stack | Next.js 15 / React 19 / TypeScript / Tailwind; Expo companion | Evolve web/PWA first; avoid a platform rewrite. |
| Documentation | README, ARCHITECTURE and TESTING describe current flows; AUDIT and Sprint 1 MVP explicitly describe historical snapshots | Use current code as authority; do not turn every historical finding into an assumed current defect. |
| Business logic | Physical verification, device authentication, payment-gated issuance, device ledger, handoff, error reporting and affiliate challenge/code exchange exist | Preserve these boundaries and regression coverage. |
| Automated baseline | 16 Vitest files, 102 tests pass; lint, `tsc --noEmit`, and production build pass | Solid service baseline, but not evidence of complete browser journeys or Apple Pay operation. Tests used an isolated temporary runtime directory. |
| Frontend structure | `components/wallet-surface.tsx` is 4,285 lines, mixing homepage, onboarding, legacy flow, store selection and UI helpers | Extract journey modules incrementally; prevent redesign work from changing issuance semantics accidentally. |
| Brand | Existing Zik mark, navy/lime palette, imagery, animated hero and custom typography fallbacks | There is a brand foundation; consolidate it rather than introducing an unrelated generic dashboard theme. |
| Navigation | `app-shell.tsx` mixes customer wallet with Retail verify and Store demo | Give customers and operators distinct navigation and task contexts. |
| Payment | `pass-payment-choice.tsx` labels an ordinary button “Apple Pay / Google Pay”, creates a payment, then calls `confirm-online-demo` directly | No actual wallet SDK or payment sheet exists. Replace the integration, not just the button styling. |
| Pricing | `.env.example` sets issuance to 0 minor units; device extension to 299 GBP minor units | Choose a nonzero test price for real payment testing; support a separate explicit free flow. Never charge twice for a till purchase. |
| Locations | Three hardcoded London stores, CSS percentage pins and decorative background in `AffiliateStoreSelector` | No coordinate-based map, postcode service, distance calculation or browser geolocation was found in the inspected flow. |
| Store consistency | Store selector offers three IDs; `retail-verifier.ts` returns only Oxford Street/front-desk; lookup enforces store/location match | All advertised stores need a matching operator fixture/session or a customer may select a store the demo clerk cannot service. |
| Retail purchase | `retail_card` flow records an already-confirmed till purchase through `recordRetailTillPurchase` | Preserve prepaid behavior; make the demo sale explicit and later require trusted proof of sale rather than client-selected entry mode. |
| Security boundaries | Public issuer/session listing handlers; browser-bundled shared clerk token; cash/demo confirmation handlers accept payment references without caller authorization | A polished public deployment would still expose serious trust gaps. These were rechecked in current code. |
| PWA | Install/handoff exists; service worker falls back to cached `/wallet` but contains no corresponding cache population | Implement and test an honest offline experience; do not promise offline verification merely because installation works. |
| Unfinished surface | `ZikParental` is explicitly a placeholder; metadata still says MVP/sprint one | Remove unfinished features from primary navigation and update product metadata. |
| Native | Expo scaffold and exportable SecureStore-backed key path documented | Keep compatible; do not claim hardware-backed signing, production native delivery or Apple Wallet pass integration. |

Review scope: source, principal Markdown documentation, configuration and automated checks. This is not a fresh penetration test or a rendered visual/accessibility audit. The PDF/image concept references and all real-device journeys still need visual review during implementation. Existing untracked `public/mapp.png` and `public/flow1-purchase-card-qr.png` were left untouched.

## Product and brand direction

Recommended identity: calm, confident, private, fast. Consistently use “ZikPass”. Retain navy/ink, warm off-white and a controlled lime accent. Use a licensed, consistently delivered font, a small type scale, shared spacing/radius tokens, one icon family and restrained transitions. Reserve strong emphasis for the primary next action; avoid filling every screen with glass cards, decorative metrics or hero content.

A first-time customer should understand what the pass does, where to get it, what ID to bring, what it costs and what data a site receives. A returning customer should reach their pass immediately. Never describe the current credential design as zero knowledge or claim verified compliance or hardware-backed protection.

Customer navigation: Home, Find a store, My pass, Help. Operator navigation: store queue, verify customer, payment status, support. Developer controls belong in a gated demo console. Keep a discreet environment indicator and context-specific “test payment/no charge” disclosure without burying the action in engineering terminology.

## Delivery sequence

### 1. Establish boundaries and baseline

- Inventory current screens, routes, assets and primary journey states; capture mobile and desktop screenshots before editing.
- Document retail-card/prepaid and self-directed flows separately. Preserve the server's actual state dependencies; don't impose a new ordering from UI copy alone.
- Introduce explicit demo/test environment configuration independent of `NODE_ENV`. A deployed demo often runs a production build.
- Create deterministic fictional fixtures, reset tooling limited to the demo environment and store-scoped operator sessions. Keep all real runtime data and keys intact.
- Separate customer ownership, operator authorization and demo simulation permissions at the service/API boundary. Hiding links is not access control.
- Extract store discovery, onboarding steps, payment, completion and shared UI primitives from WalletSurface in small, tested changes.

Exit: documented flow matrix, repeatable fixtures, no new authorization bypass, existing service tests pass.

### 2. Establish the design system and customer shell

- Define semantic colour/type/spacing/motion tokens and accessible buttons, form controls, alerts, progress, dialogs, sheets and skeletons.
- Implement separate customer/operator shells; give every customer page a clear heading, next action and back/resume behavior.
- Redesign homepage around one primary “Get ZikPass” action and returning-user wallet access. Remove forced recurring splash interruption.
- Add coherent Help, privacy explanation, accepted-ID guidance and receipt/status views. Draft policy copy must not invent operational guarantees or accepted-ID policy.
- Hide parental controls and legacy financial onboarding from the main journey while preserving their regression paths.

Exit: consistent Home, store finder, onboarding, wallet and help designs at 320/390/768/1440px; keyboard and reduced-motion behavior verified.

### 3. Build believable store discovery

- Replace percentage-position markers with coordinate-backed stores and an interactive map/list. Use one shared store catalog on client and server.
- Provide deterministic fictional London fixtures with IDs, coordinates, addresses, opening hours/timezone, accepted services and availability. Clearly identify demo locations; do not imply real retailer partnerships.
- Implement postcode/area search, map/list selection synchronization, estimated straight-line distance, open/closed display and store details with “Choose this store”. Do not call distances walking times without routing data.
- Make location a provider boundary: fixture location/search for demos; optional browser geolocation after “Use my location”; optional external map/geocoding provider later.
- Support denied permission, timeout, unavailable position, no results and map failure. The accessible list and manual search must remain usable.
- If map tiles require external services, provide attribution and documented configuration; keep a clearly labelled offline schematic/list fallback. Do not scrape tiles or claim a static image is a working map.
- Persist selected store across refresh/back navigation and into the server session; staff identity must match that store. Avoid storing precise customer location by default.

Exit: every selectable store completes a demo verification; no location permission is required to obtain a pass.

### 4. Replace dummy payments with an actual test integration

Recommended default: Stripe Express Checkout Element with Apple Pay, using test credentials and a registered HTTPS domain. It supplies the supported wallet UI and reduces direct merchant-validation implementation. Validate current provider requirements before coding. Stripe handles Apple merchant validation for this route; direct Apple Pay JS uses a different setup path. [Stripe domain registration](https://docs.stripe.com/payments/payment-methods/pmd-registration), [Express Checkout](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment).

The requirement is a real Apple Pay button that opens the real system payment sheet and processes a test transaction. Dummy prices are fine; fabricated merchant credentials are not. Direct Apple sandbox testing requires merchant configuration and supported test setup. Follow the chosen provider's specific test-wallet instructions rather than assuming Apple sandbox cards work with every processor. [Apple sandbox setup](https://developer.apple.com/apple-pay/sandbox-testing/).

Implement two explicit adapters:

1. **Provider test adapter:** actual SDK, test transaction, server-created payment intent/session, verified server result.
2. **Demo simulator:** polished ZikPass-branded checkout with deterministic success, decline, cancel and timeout. Clearly labelled simulation; never impersonates an Apple system sheet or silently substitutes for an unavailable Apple Pay integration.

Both use the same payment service and issuance gate. Add provider/session IDs, environment, stable idempotency and reconciliation state. Server calculates price/currency from trusted configuration and validates enrollment ownership and eligibility. Confirm payment from verified provider state (signed webhook and/or authenticated server retrieval), never a client “success” flag. Check amount, currency, purpose, enrollment and environment. Handle duplicate/delayed/out-of-order events without duplicate passes, entitlements or charges.

Show item, price, total, merchant and test indicator before paying. Detect supported payment methods; do not show a combined Apple Pay/Google Pay button. Google Pay can appear separately when supported. Preserve cash/card-at-till, prepaid retail-card and extension payments. Treat cancellation as cancellation, not payment failure; allow switching methods without reusing an incompatible pending attempt. Reconcile a lost callback on resume.

Use a configurable nonzero GBP test price (suggested fixture: £2.99, not a commercial pricing decision). If price is zero, skip the wallet transaction with clear “Free” wording. No live keys, real charges or settlement claims in this milestone.

Exit: actual Apple Pay test payment recorded on a supported device/domain, cancel/decline/retry verified, server gate enforced. Without account/domain setup, ship all integration code and the explicit fallback, but mark real Apple Pay acceptance blocked and list exact owner setup steps. Do not mark it complete from simulator tests.

### 5. Finish onboarding, wallet and operator journeys

- Present focused steps, persistent progress, expiry/countdown where relevant, clear ID instructions, store context and receipt. Resume after refresh and interrupted polling.
- Preserve physical check, authentic device check or explicitly simulated alternative, payment gate and exactly-once logical issuance.
- Finish empty/active/expired/error/device-limit wallet states; install, extension and recovery actions must be understandable and functional.
- Make affiliate consent explain the requesting site and minimal shared data; preserve signed challenge/code flow, generic denials and privacy guarantees already tested.
- Give staff a fast code lookup, matching store identity, confirmed customer state, payment action and completion feedback; prevent duplicate confirmation and cross-store access.
- Add branded 404/error/loading/offline views; make every exposed action work. Do not invent unsupported account recovery or pass revocation features merely to fill menus.
- Repair offline shell caching with a versioned policy. Exclude sensitive responses, handoff URLs/tokens and payment/verification actions; show stale/offline status honestly.

Exit: both purchase journeys and affiliate use complete without developer intervention; interruption recovery works.

### 6. Validate and package

- Add Playwright browser journeys and focused integration tests at new payment/location/auth boundaries. Preserve existing signed credential, replay and device-binding tests.
- Exercise 320/390/768/1440px layouts, mobile safe areas, zoom, keyboard focus, dialog trapping/Escape/return focus, live announcements, contrast and reduced motion.
- Measure representative load and interaction performance; lazy-load maps/provider SDKs and optimize oversized images. Record measured results rather than promising a score.
- Run test, lint, TypeScript and production build; smoke-test Expo types if shared contracts changed. Record real Safari/iPhone/PWA tests separately from browser automation.
- Update README, ARCHITECTURE, TESTING, environment examples and demo runbook. Include a five-minute walkthrough, fixture reset instructions, integration setup and outstanding blockers.

## Acceptance scenarios

| Scenario | Required result |
| --- | --- |
| New customer, manual store search | Correct store survives navigation and is serviceable by matching demo staff. |
| Location permission denied / map unavailable | Manual search and accessible list still allow completion. |
| Retail-card purchase | Existing payment recognized; no second charge requested. |
| Self-directed Apple Pay test | Real provider button and system sheet; verified test result gates issuance. |
| Unsupported wallet or absent credentials | Honest unavailable state and explicit simulator/cash alternative; no fake Apple sheet. |
| Payment cancelled/declined/network lost | No premature issue, state can be resumed, no duplicate payment on retry. |
| Repeated webhook/issue/claim | One logical pass and one entitlement consumption. |
| Third device | Extension required; failed payment preserves existing devices/pass. |
| Pass missing/expired; affiliate denial or replay | Clear recovery or generic denial, no leaked identity/token details. |
| Cross-store or unauthorized payment confirmation | Server rejects, regardless of what UI was used. |
| PWA offline and return online | Useful shell/status; protected actions require connectivity and reconcile on return. |

## What remains before a real public launch

Durable database and distributed transactions, real staff authentication/RBAC and enrollment ownership, secure recovery, rate limits/abuse controls, authenticated device-assertion verification, audited key storage/rotation/revocation, production processor/settlement/refund behavior, operational monitoring, backups and retention/privacy review. Revalidate historical AUDIT findings against the final implementation. Do not claim launch readiness from visual polish or passing prototype tests.

The immediate shared-demo gate should already include server-side authorization, environment-gated simulation, redacted output and trusted payment confirmation. Full identity-service assurance and native hardware-backed key custody remain explicit later work.

## External references

- [Apple Pay implementation](https://developer.apple.com/apple-pay/implementation/) and [sandbox testing](https://developer.apple.com/apple-pay/sandbox-testing/).
- [Stripe Express Checkout](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment) and [domain registration](https://docs.stripe.com/payments/payment-methods/pmd-registration).
- Browser geolocation needs a secure context and permission; request it from an intentional action with manual fallback. [MDN Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).
