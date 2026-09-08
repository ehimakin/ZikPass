# Prompt: complete the ZikPass prototype overhaul

You are the lead product engineer and designer for ZikPass. Implement the overhaul in this repository. Read `docs/PROTOTYPE_OVERHAUL_PLAN.md` as the detailed brief, then README, docs/ARCHITECTURE.md, docs/TESTING.md and applicable repository instructions. Treat AUDIT.md and zik_pass_mvp.md as historical context and recheck findings against current code.

## Outcome

Deliver a complete, distinctive, production-quality web/PWA prototype with the clarity and continuity of Uber or Deliveroo. Retain ZikPass's own identity: navy/ink, warm off-white, controlled lime, confident typography and a calm privacy-first voice. Do not copy another company's branding. Polish must span actual journeys, not just the landing page.

Scope includes customer discovery/onboarding, store lookup, payment, wallet, installation/recovery, affiliate consent/result, and store/operator flows. Keep native Expo compatible; native production delivery and real identity-service launch are separate work. Retain cryptography, server-authoritative issuance, device limits, signed affiliate challenges and replay protections.

## Working method

1. Inspect current source, git status, documentation and assets. Preserve existing user changes, runtime data and keys. Capture rendered before screenshots and establish tests/build baseline in an isolated runtime directory.
2. Maintain a brief phased implementation checklist and a decision/blocker log. Execute the plan through implementation and verification; don't stop after proposing designs. Make reasonable, documented choices for reversible details.
3. Extract the oversized WalletSurface into focused journey modules incrementally. Reuse shared service/type boundaries. Keep thin routes and idempotent mutations; no gratuitous framework rewrite.
4. Work in reviewable phases. Validate each complete journey and fix regressions before expanding. Do not deploy, enable live payments or register paid services without explicit authorization.
5. If credentials or physical-device access are missing, finish independent work and integration code. Record exact setup requirements and unverified criteria. Never pretend the fallback proves the external integration works.

## Required product work

- Create semantic design tokens and accessible shared controls, forms, dialogs, sheets, loading/error/success states. Apply consistently to all exposed screens.
- Separate customer navigation from operator/developer surfaces. Customer priorities: get a pass, find a store, open my pass, get help.
- Simplify first-time onboarding into focused steps with clear price, accepted-ID guidance, selected-store context, progress, back/resume and next action. Preserve both retail-card/prepaid and self-directed semantics.
- Give returning customers direct wallet access. Complete empty/active/expired/device-limit states, install/handoff, extension and recovery.
- Finish affiliate consent/result while preserving minimal disclosure and generic denials.
- Remove placeholder/legacy features from primary navigation, update MVP metadata, add branded 404/offline/error pages, and ensure every visible action has a useful outcome.
- Keep restrained demo/test disclosure. Do not claim real biometrics for simulated checks, zero-knowledge proofs, certified compliance, live settlement or hardware-backed browser keys.

## Location integration

Replace the decorative CSS map and component-local store list with a shared coordinate-backed fixture catalog and provider boundary. Build interactive map/list discovery, postcode/area search, store details, selection, approximate distance and open/closed states. Fixture data must be deterministic, fictional and labelled as demo locations.

Offer explicit “Use my location” through browser geolocation, with permission-denied, timeout and unavailable states. Manual search/list must always work. Provide a useful fallback when map services are unavailable and preserve required tile attribution. Don't invent walking times or imply fixture stores are real partners. Avoid persisting precise customer coordinates.

Carry the selected store into server session creation. Fix the current mismatch between three selectable stores and a verifier identity fixed to Oxford Street: create matching store-scoped demo operator sessions, and enforce scope on the server.

## Apple Pay: actual integration, not another dummy button

Implement Stripe Express Checkout Element in test mode as the default provider route, checking current official documentation first. The target is the actual Apple Pay button opening the actual payment sheet and completing a provider test transaction with a dummy GBP price. Do not build a CSS imitation of the Apple sheet or label a generic confirm button Apple Pay.

Use server-created provider payment sessions/intents with trusted price/currency/purpose/enrollment, ownership and eligibility checks, stable idempotency, verified provider confirmation and reconciliation. Verify webhook signatures and match amount, currency, environment and linked payment. Browser callbacks cannot authorize issuance. Handle duplicate/delayed/out-of-order events, cancellation, decline, timeout, refresh and lost callbacks.

Use explicit adapters for provider-test and demo-simulator modes. The simulator must be labelled, ZikPass-branded and deterministic. Never silently fall back from a failed provider transaction to simulated success. Detect available wallets and display their official individual controls. Unsupported devices get a useful fallback. Google Pay is optional when supported; do not display a combined branded button.

Preserve cash/card-at-till and prepaid retail-card behavior. No double charging. Extension payments must consume one entitlement once. Allow payment-method changes without reusing an incompatible pending provider attempt. Use a configurable nonzero test price; if the configured price is zero, present a free flow instead of a wallet charge.

Document test keys, registered HTTPS payment domain, webhook configuration and supported device/wallet prerequisites. Follow the selected provider's testing instructions: direct Apple sandbox setup and processor testing are not interchangeable. Without this setup, report real Apple Pay as blocked/unverified even if all simulator tests pass. No live keys or real charges.

## Trust and reliability

- Explicit environment-gated demo endpoints; production build mode alone must not select live behavior.
- Server-side customer ownership and store/operator authorization, including cash confirmation, enrollment reads, issuer/session lists and demo simulation. UI hiding is insufficient.
- Remove reliance on a shared clerk secret bundled into customer JavaScript. A chosen retail-card URL/entry mode cannot prove a trusted real till sale.
- Preserve real credential signing, issuance/payment gates, replay prevention, logical pass identity and device limits.
- Repair offline shell behavior with deliberate cache population and invalidation. Do not cache sensitive API responses or token-bearing handoff URLs. Do not fabricate successful offline payment/verification.
- Keep secrets, identity data and tokens out of logs and customer errors. Keep synthetic demo data isolated and safely resettable.

## Verification and definition of done

Run existing tests, lint, TypeScript and production build. Add focused service tests for new boundaries plus Playwright end-to-end coverage for:

- Self-directed discovery -> correct store -> clerk check -> device check -> payment -> pass.
- Prepaid retail-card flow without another payment.
- Actual provider Apple Pay test success, cancel, decline and recovery; mark hardware-only checks separately.
- Location denied/no results/map unavailable with successful manual fallback.
- Refresh/back/resume, expired code/session, delayed payment result and duplicate webhook.
- Wallet install/handoff, device extension, third-device rejection and retry.
- Affiliate success, no pass, expiry, cancellation and replay.
- Unauthorized and cross-store access rejection.

Review rendered mobile and desktop layouts at 320/390/768/1440px, keyboard navigation, focus trapping/return, live announcements, contrast, zoom, safe areas and reduced motion. Capture after screenshots. Test Safari/iPhone/PWA and actual Apple Pay where available; a Chromium mock does not satisfy that criterion. Measure performance and lazy-load maps/provider SDKs. Check native types if shared contracts changed.

Update README, ARCHITECTURE, TESTING and .env.example. Deliver a five-minute demo script, repeatable fixture setup/reset, payment setup guide, before/after screenshots, test results, known limitations and the separate public-launch backlog. Report implemented, verified and externally blocked work distinctly. The target is a coherent finished prototype, with no placeholder primary actions and no falsely claimed integration readiness.
