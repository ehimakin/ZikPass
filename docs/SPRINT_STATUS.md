# ZikPass overhaul - sprint status

Living status doc for the production-quality prototype overhaul. Keep this
accurate enough that another session can resume without re-deriving context.

Brief: `docs/PROTOTYPE_OVERHAUL_PLAN.md` + `docs/PROTOTYPE_OVERHAUL_PROMPT.md`
Branch: `v2-ui-overhaul` · Baseline commit: `675a050`

---

## Product-positioning milestone — 2026-09-15

Added the agreed Zik → Zik Pass / ZikVault / Zik ID product direction, shared display
catalogue, homepage family section, read-only `/ecosystem`, menu link, About explanation
and active-pass promotion beneath working controls. Pass remains standalone and the only
available product in this presentation; planned prices are display-only.

This is a product-positioning/documentation milestone, not a Vault implementation sprint.
Existing experimental Vault/disclosure and Zik ID code is preserved at the owner's request;
it does not implement the agreed verified-credential products. No credential, API, payment,
issuance, wallet or physical-card logic changes are part of this milestone. See
[PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md) for the boundary and terminology.

### Validation and file-level record — 2026-09-15

- `npm test`: 152 tests passed across 28 files. Corrected an existing flaky operator
  tampering test to change significant signature bits rather than base64 padding bits.
- Customer/clerk/affiliate Playwright suite: 10/10 passed against an isolated production
  server and runtime directory. Updated stale no-pass CTA and pass-seal selectors; no
  production journey changes were needed.
- `npm run lint`: no errors; seven existing warnings in experimental Vault/ID components.
- `npx tsc --noEmit`: passed. Production build: passed (existing font fetch required network).
- Visual review: home, ecosystem, About, menu and active Pass at 320/390/768/1440px.
  No horizontal overflow or browser errors. Planned cards have no acquisition controls;
  example has no inputs. Promo appears only on active Pass, below existing controls,
  with its explanation link reachable above the fixed navigation. Reduced-motion browser
  review and menu Escape/focus return checked. Physical-device PWA testing remains separate.
- Build output and screenshots are temporary review artifacts, not source changes.

Exact changed files for this milestone:

- `lib/shared/product-catalogue.ts` (new)
- `components/customer/product-family.tsx` (new)
- `app/ecosystem/page.tsx` (new)
- `components/customer/home-screen.tsx`
- `components/customer/customer-menu.tsx`
- `components/customer/pass-screen.tsx`
- `app/about/page.tsx`
- `docs/PRODUCT_DIRECTION.md` (new)
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/SPRINT_STATUS.md`
- `docs/DEMO_SCRIPT.md`
- `docs/TESTING.md`
- `zik_pass_mvp.md`
- `tests/operator-session.test.ts`
- `e2e/edge-cases.spec.ts`
- `e2e/journeys.spec.ts`

Product-language ambiguity: the original brief assumed no Vault/ID logic exists, but
this checkout already includes experiments. The owner requested preservation and expansion;
existing code is preserved and accurately distinguished from the planned products.
The desired additional prototype behavior is awaiting clarification; this milestone adds
only product presentation. Commercial availability is also distinct from Pass's working,
demo-payment prototype. Existing expiry, renewal and server price overrides are unchanged.

## Historical overhaul phase

**Post-step-7 cleanup (2026-09-09).** Steps 1-7 done. Then, per the user:
- **`/store` retired** - `app/store/page.tsx` now `redirect("/verify")`;
  `store-session-dashboard.tsx` deleted; "Store demo" nav links removed. It was
  a pre-`/find` session-bootstrap tool that also duplicated `/verify`. The
  `/api/physical/sessions` backbone is kept.
- **`counter-sale` -> `purchase-sale` rename, everything.** Route
  `/verify/counter` -> `/verify/purchase`; `lib/server/counter-sale.ts` ->
  `purchase-sale.ts`; `/api/counter-sale[/claim]` -> `/api/purchase-sale[/claim]`;
  `CounterSale`/`CounterActivation` -> `PurchaseSale`/`PurchaseActivation`;
  `counter_sale` session field -> `purchase_sale` (storage normalisation still
  accepts the old name); `tests/counter-sale.test.ts` -> `purchase-sale.test.ts`;
  `COUNTER_SALE_FLOW.md` -> `PURCHASE_SALE_FLOW.md`.
- **Orphaned `?entry=retail_card` prepaid plumbing removed** from
  `onboarding-flow.tsx`, `store-finder.tsx`, `app/find/page.tsx`,
  `app/get-pass/page.tsx` (nothing linked to it after `/card` became the
  purchase-sale activation screen). Server-side `entry_mode: "retail_card"` +
  `recordRetailTillPurchase` + its `physical-flow.test.ts` case are LEFT intact
  (unused by any UI now; safe to remove in a later pass).
- e2e: the "prepaid retail-card" journey replaced with a "clerk-first purchase
  sale" journey (clerk API -> `/card#activate=` -> claim -> issued -> one
  `cash_in_store` payment).

Remaining open items are listed under "Step 4/5 still to do" below.

---

## Checks (2026-09-09)

| Check | Result | Notes |
| --- | --- | --- |
| `npm test` (Vitest) | 127 passed / 21 files | +23 since the design-system commit (purchase-sale, affiliate session/external-client, physical-session-route, multi-store scoping). |
| `npm run e2e` (Playwright) | 10 passed / 2 files | customer/clerk/affiliate journeys + edge cases; affiliate specs updated for the JerkMeat flow. |
| `npm run lint` | clean | `scripts/**` ignored. |
| `npx tsc --noEmit` | clean | |
| `npm run build` | not re-run | Avoid while `npm run dev` owns `.next`. |

Stack confirmed: Next.js 15.5 / React 19 / TS / Tailwind 3.4, Expo companion in
`mobile/`. `components/wallet-surface.tsx` is 4,285 lines and still owns the
homepage, onboarding, legacy flow and store selection.

### Screens / routes inventory (pre-overhaul)

- `/` homepage (WalletSurface homepageMode) - dark hero, forced splash window
- `/wallet` returning wallet (WalletPageSurface) + physical-entry variant
- `/onboarding` (WalletSurface onboardingMode) - full physical journey
- `/verify` retail clerk tool (RetailVerificationScreen)
- `/store` store session dashboard (staff)
- `/issuer` issuer dashboard (dev/ops)
- `/affiliate-demo` + `/confirm` + `/callback` - OAuth-style age check demo
- `/ZikParental` - explicit placeholder
- `/app/handoff`, `/verify/zik` - PWA + hosted verification

---

## Work completed this sprint

### Foundations
- **`lib/shared/demo-environment.ts`** - explicit `ZIK_ENV` flag (`demo` /
  `test` / `live`), independent of `NODE_ENV`. `isDemoEnvironment`,
  `isLiveEnvironment`, `environmentBadgeLabel()`. Nothing selects `live`
  implicitly. Not yet wired into the existing `process.env.NODE_ENV` gates in
  `wallet-surface.tsx` / `wallet-page-surface.tsx` (follow-up).
- **`lib/shared/stores.ts`** - single coordinate-backed store catalogue
  (5 fictional London demo stores) with lat/lng, postcode, opening hours +
  timezone, per-store services, and a demo operator identity per store.
  Helpers: `straightLineDistanceKm` (haversine), `getStoreOpenState`,
  `resolveAreaAnchor` (offline postcode/area search over `DEMO_AREA_ANCHORS`),
  `formatDistanceKm`. Replaces the 3 hard-coded `affiliateStores` with CSS %
  pins - old list still present in `wallet-surface.tsx` pending migration.

### Design system
- Semantic tokens in `app/globals.css` under `:root` (`--zk-*`): surfaces,
  text roles, lines/focus, accent, status colours, radius scale, elevation,
  font vars. Scoped via `.zk-surface` (also applies reduced-motion + border-box).
- `tailwind.config.ts` exposes the tokens as utilities (`bg-canvas`, `text-zk-soft`,
  `rounded-zk-lg`, `shadow-zk-card`, `font-zk`, status colours). Existing
  `ink`/`mist`/`lime` untouched.
- Licensed font: **Manrope** via `next/font/google` in `app/layout.tsx`
  (`--font-manrope`), self-hosted at build. Fallback stack in `--zk-font-sans`.
- Metadata updated: title `ZikPass` (was "Zik Pass MVP"), new description.

### Shared customer UI
- `components/customer/icons.tsx` - one stroke icon family (24px grid).
- `components/customer/ui.tsx` - `Button`/`ButtonLink` (primary/secondary/ghost/
  danger, 44px+ targets, visible focus ring, loading), `Card`, `StatusBadge`,
  `Alert`, `Skeleton`, `Sheet` (focus trap + Escape + return focus + scroll
  lock), `SectionHeading`.
- `components/customer/customer-shell.tsx` - mobile-first shell: sticky compact
  header (brand or back link), env badge, skip-to-content link, fixed bottom
  tab bar (Home / Find a store / My pass / Help) with safe-area padding,
  max-width 560 content column.

### Customer screens (new preview routes)
- `/home` - `HomeScreen`: one primary "Get ZikPass · <price>" action,
  returning-user "Open my pass", 3-step how-it-works, "what a site receives"
  privacy card (no zero-knowledge / biometric claims).
- `/find` - `StoreFinder`: postcode/area search (offline anchors), "Use my
  location" with denied/timeout/unavailable states, schematic coordinate-plotted
  map synced to an accessible list, open/closed + straight-line distance, store
  detail with accepted-ID note and "Choose this store" -> carries `store_id`
  into `/onboarding?flow=physical`. Labelled demo locations, "not walking times".
- `/pass` - `PassScreen`: empty / pending / activating / active / expired
  states, new ink pass card with Zignature, use-your-pass actions, delete-pass
  disclosure. Reads real `loadWalletState()` + enrollment status.
- `/help` - `HelpScreen`: accepted ID, common questions (new phone, expired
  code, what a site learns), honest "about this build" note.

Existing routes (`/`, `/wallet`, `/onboarding`, `/verify`, `/store`, ...) are
untouched so business logic and current flows still work during review.

---

## Apple Pay - external setup required (delivery step 1 output)

Real Apple Pay is **BLOCKED on account setup the repo owner must do**. Code and
the demo simulator can be built now; a verified Apple Pay test needs:

1. **Stripe account** (test mode is fine) - publishable + secret **test** keys.
   Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. **Payment method domain registration** in Stripe for the exact HTTPS domain
   the demo is served from (Apple Pay will not render on an unregistered
   domain). Localhost is not sufficient; needs a real HTTPS host (e.g. a
   tunnel or preview deployment). Docs:
   https://docs.stripe.com/payments/payment-methods/pmd-registration
3. **Webhook endpoint** + signing secret (`STRIPE_WEBHOOK_SECRET`) for
   `payment_intent.succeeded` / `.payment_failed`, so issuance is gated on
   verified provider state, not a browser success flag.
4. **A device that can actually present Apple Pay**: Safari on iOS/macOS with a
   card in Wallet. Chromium mocks do NOT satisfy the acceptance criterion.
5. Chosen test price: `ZIK_PASS_ISSUANCE_PRICE_MINOR=199` GBP (suggested
   fixture, not a commercial decision). `0` keeps the explicit free flow.

Plan: build Stripe Express Checkout Element route + ZikPass-branded simulator
behind the same payment service and issuance gate. Never fall back from a failed
provider attempt to simulated success. Until items 1-4 exist, mark Apple Pay
acceptance **unverified** regardless of simulator test results.

---

### Multi-store operator scoping (partial - done this sprint)
- `retail-verifier.ts` `authenticateRetailVerifier(token, storeId?)` now derives
  the clerk identity from `stores.ts` for the store in play, so all 5 catalogue
  stores are serviceable (was Oxford-only).
- `createPhysicalStoreSession` fills `store_name` / `location_id` from the
  catalogue when `storeId` is known.
- `verifyPhysicalIdCheck` / `rejectPhysicalIdCheck` / the lookup route take an
  optional `clerkStoreId` (from `x-zik-store-id` header). When set, a session
  for a different store is rejected; when absent, the single shared demo
  terminal serves the session's own store. Oxford `verifierId` kept as
  `demo-clerk-terminal-001` so existing regression tests hold.
- New tests: non-Oxford store completes an ID check; cross-store clerk rejected.
- **Still open:** the clerk UI (`RetailVerificationScreen` / store dashboard)
  does not yet send `x-zik-store-id` or offer a store picker - so cross-store
  rejection is enforceable but not yet exercised from the UI. Single shared
  terminal token remains (AUDIT C1).

## Remaining acceptance criteria (not started / partial)

- [ ] Replace the dummy "Apple Pay / Google Pay" button
      (`components/pass-payment-choice.tsx`) with real Stripe Express Checkout +
      branded simulator adapter; server price/currency from trusted config;
      webhook-verified confirmation; cancel/decline/timeout/lost-callback.
- [ ] Separate customer vs operator vs developer navigation for real (new shell
      only covers the customer surface so far; `/verify` `/store` `/issuer`
      still use the old `AppShell`).
- [ ] Apply the approved design system to onboarding, affiliate consent/result,
      clerk lookup, and operator screens.
- [ ] Remove `/ZikParental` and legacy financial onboarding from primary nav;
      keep regression paths.
- [ ] Branded 404 / error / offline / loading views.
- [ ] Honest offline shell: deliberate cache population + versioned
      invalidation; exclude sensitive/token-bearing responses.
- [ ] Server-side authorization review: public issuer/session list handlers,
      browser-bundled shared clerk token, cash/demo confirm without caller auth.
- [ ] Playwright end-to-end journeys + focused service tests at new boundaries.
- [ ] Responsive/a11y pass at 320/390/768/1440, focus trapping, live regions,
      contrast, reduced motion, safe areas.
- [ ] Docs refresh (README, ARCHITECTURE, TESTING, .env.example) + 5-minute
      demo script + fixture reset tooling.

---

## Review checkpoint - APPROVED 2026-09-06

User reviewed the visual slice (`/home` `/find` `/pass` `/help`) and approved:
- Overall direction: **proceed**.
- Desktop: **keep the centred phone-width column** as-is (no wide/sidebar layout).
- Store map: **keep the schematic** as-is; no real map tiles.
- Pass card: **keep the new flat ink card** (old green-gradient PassPreviewCard retired for the customer surface).

Now executing delivery step 4: apply the system across onboarding, wallet,
payment and affiliate journeys, plus clerk/operator screens.

### Step 4 progress
- **Customer onboarding rebuilt** on the new surface: `/get-pass` +
  `components/customer/onboarding/onboarding-flow.tsx`. Physical-only state
  machine over the existing APIs (`/api/physical/sessions`,
  `/api/enrollment/start`, `/api/physical/device-auth/*`, `/api/enrollment/issue`).
  Intro -> 6-char code + QR -> live checklist -> auto device check -> payment ->
  issued -> `/pass`. Resumes an in-flight enrollment on reload; reconciles a
  lost issuance callback on `/pass`. Verified end-to-end in the browser
  (Oxford + Shoreditch stores, clerk confirm via API, £1.99 sim payment,
  real credential `zp_...` issued and shown Active).
- **Payment**: `components/customer/onboarding/payment-panel.tsx` +
  `lib/shared/payment-config.ts`. Two explicit adapters described in code:
  Stripe Express Checkout (only surfaces when `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  is set - not this build) and a labelled **ZikPass demo checkout** simulator
  with deterministic success / decline, plus pay-at-till. Never shows a
  combined Apple/Google button; never fakes an Apple sheet; never silently
  substitutes sim success for a failed real charge. Server computes the amount
  from `getPassPrice()` (client gets it as a prop, not from a non-public env).
- **Price**: `.env` sets `ZIK_PASS_ISSUANCE_PRICE_MINOR=199` and the code default matches (£1.99
  test fixture). Free flow retained when 0.
- `/` now redirects to `/home` (old splash-window homepage retired from the
  primary path; still reachable logic-wise via `/onboarding` `/wallet`).
- `NEXT_PUBLIC_ZIK_ENV` added so the client env badge / demo gating is correct.

### Step 4 progress (cont.)
- **Affiliate consent reskinned** (`components/affiliate-confirm-screen.tsx`)
  to the ZikPass system: single card, explicit shared / not-shared rows,
  generic denials preserved, all challenge/presentation-bundle logic unchanged.
  Verified in browser: no-pass path and approve path (approve -> Nightfall
  callback shows verified, `in_person_verified`, no identity shared).
  Nightfall's own landing/callback pages keep their distinct third-party brand
  by design.
- **Payment sheet bug fixed**: the 3s status poll was resetting panel state and
  closing the demo-checkout sheet; sheet visibility is now separate state.

### Step 4 progress (cont.)
- **Clerk screen rebuilt** on a new operator shell (`components/operator/`):
  `retail-verification-screen.tsx` reskinned to the ZikPass light system, all
  state-machine logic kept. New **store selector** binds the terminal to a
  catalogue store and sends `x-zik-store-id`. Verified in browser: Oxford
  terminal + Brixton code -> "verifier is not authorised" (real cross-store
  rejection from the UI); switch terminal to Brixton -> confirm 18+ succeeds.
  `clerk-payment-status.tsx` reskinned; "Apple Pay / Google Pay" label removed.
- **`/wallet`** (non-physical) now redirects to `/pass`; legacy physical
  handoff link still resolves through `WalletSurface`.
- **Branded 404 / error pages**: `app/not-found.tsx`, reskinned `app/error.tsx`
  + `app/global-error.tsx` on `components/customer/status-page.tsx`. Restart
  target moved from `/wallet` to `/home`.
- **Demo reset**: `POST /api/demo/reset` (gated on `isDemoEnvironment`) +
  `resetDemoRuntimeState()` in storage. "Reset demo data" button on the Help
  screen. Keeps issuer keypair + store plans; clears enrolments/sessions/
  payments/handoffs/bindings/affiliate/error records. Verified.

### Step 4 progress (cont.) - 2026-09-08
- **Retail-card / prepaid path** on the new onboarding. New `/card` route
  (the printed-card QR target) -> `/find?entry=retail_card` (filtered to
  card-selling stores) -> `/get-pass?entry=retail_card&store_id=X`.
  `OnboardingFlow` reads `entry` / `forcedEntry`, creates the session with
  `entryMode: "retail_card"`, shows a "Card already paid for" intro, drops the
  payment step from the checklist. Server auto-settles via
  `recordRetailTillPurchase` (unchanged). Entry links added on `/home` and the
  `/pass` empty state. Verified end-to-end: one `retail_till` payment,
  confirmed, £1.99, no in-app charge, pass issued.
- Copy fix: `/home` said "That's zero-knowledge. That's Zik." -> the brief
  bans zero-knowledge claims. Changed to "That's minimal disclosure."
- eslint now ignores `scripts/**` (Codex's `.cjs` build script used `require`).

### Step 4 progress (cont.) - 2026-09-08
- **Honest offline shell** rewritten (`public/sw.js` v2): precache only the
  offline page + icons + manifest; static hashed assets cache-first; navigations
  network-first, falling back to a previously-seen copy of that exact page or
  the branded `/offline` page. Runtime-caches only a short allowlist of
  non-PII customer routes. Never caches `/api/*`, `/verify`, `/affiliate-demo`,
  `/app/handoff`, `/issuer`, `/store`, or any URL carrying
  `handoff_token`/`token`/`code`/`request_id`/`session_id`. Versioned via
  `SW_VERSION`; `activate()` deletes non-current caches.
- New `app/offline/page.tsx` (branded, honest - "pages you've already opened
  will still load", no offline-verification claim).
- `OfflineBanner` in `CustomerShell` - shows only when `navigator.onLine` is
  false; states plainly what needs a connection. Verified.
- **PWA launch / handoff fixed**: `start_url` moved `/wallet?source=pwa` ->
  `/pass?source=pwa` (both `manifest.webmanifest` and the dynamic manifest
  route); `PassScreen` now runs the handoff-claim + `/api/pwa/handoff/recover`
  logic on load (ported from the retired `WalletPageSurface`); `/wallet`
  redirect preserves `source=pwa` + `handoff_token`.
- **Cannot verify SW behaviour in this environment** - the in-app preview
  browser refuses service-worker registration ("unknown error ... fetching the
  script"). Needs a real Chrome/Safari + DevTools offline toggle. Code is
  reviewed; runtime unverified.

### Step 4 progress (cont.) - legacy cleanup 2026-09-08
- Deleted dead components: `hero-slideshow.tsx`, `homepage-splash.tsx`,
  `verifier-demo.tsx`, `native-app-handoff-button.tsx` (no remaining imports).
- **Kept for now** (still the working reference impl, will port into `/pass`
  then delete): `wallet-page-surface.tsx` (dead but holds extension/recovery/
  install wiring), `extend-pass-panel.tsx`, `recovery-panel.tsx`.
- `/ZikParental` route left in place: it's an unlinked placeholder, already
  absent from every nav (brief only requires nav removal + metadata, both
  done). `wallet-surface.tsx` legacy onboarding still links to it.
- `app-shell.tsx` still needed by `/onboarding` `/issuer` `/store`
  `/app/handoff` `/ZikParental`.

### Step 6 - Playwright e2e (2026-09-08)
- `@playwright/test` + chromium headless shell installed. `playwright.config.ts`
  (`testDir: e2e`, `reuseExistingServer: true`, single worker, no vitest
  overlap). Scripts: `npm run e2e`, `npm run e2e:report`.
- `e2e/helpers.ts` + 2 specs (9 tests, all green). Each `beforeEach` calls
  `/api/demo/reset`. Coverage:
  - self-directed: find -> store -> Start -> clerk confirm (API) -> sim pay ->
    pass issued, `zp_` credential shown on `/pass`.
  - prepaid retail-card: no payment step, one auto-settled `retail_till`
    payment, pass issued.
  - payment declined -> not issued -> retry succeeds.
  - cross-store clerk lookup rejected (400), correct store still works.
  - location denied / no search match -> manual list still usable.
  - branded 404 -> "Go to home".
  - affiliate: honest no-pass path; approve path -> Nightfall callback shows
    "over 18" + "no identity information was shared".
- Bug fixed along the way: the demo-checkout sheet stayed open (and hid the
  panel) after a simulated decline; the decline message now renders inside the
  sheet so a retry works in place. Added `data-testid="store-card"`.

### Step 6 - polish / demo-rehearsal pass (2026-09-08)
Browser pass at 320 / 390 / 768px + keyboard.
- **Menu dialog focus**: rewrote `customer-menu.tsx` focus handling - opens with
  focus on the first menu link (not the close button); closing (Escape,
  backdrop, item click) returns focus to the hamburger trigger via a
  `setTimeout(0)` (rAF was pausing in backgrounded tabs). Native `<dialog>`
  still provides the trap + Escape.
- **Dead actions fixed on `/pass`**:
  - "Delete pass from this device" had no handler - now a confirm step
    (`Delete` -> `Yes, delete` / `Keep it`) that calls `clearWallet()` and
    drops to the empty state. e2e-covered.
  - "Add to another device" - now wires the real `PwaInstallButton`
    (handoff-token flow) instead of a static description.
  - "Extend to more devices" copy now points to a real path ("Ask staff at
    any Zik store").
- **Copy**: `/home` "That's zero-knowledge" -> "That's minimal disclosure"
  (brief bans ZK claims); `/pass` empty-state install line rewritten to not
  promise a missing button; store-finder map header "Schematic map - central
  London" -> "Schematic map" (was wrapping under the badge at 320px).
- **Logo consistency**: `affiliate-confirm-screen.tsx` was using a plain "Z"
  square - now `ZikLogoMark` like everywhere else.
- **Payment decline UX**: the demo-checkout sheet now stays open after a
  simulated decline, showing the error inline with the retry button (was
  closing and hiding the retry).
- Reduced-motion: `@media (prefers-reduced-motion: reduce)` rule confirmed
  present and scoped to `.zk-surface *`. Keyboard: skip link focusable, tab
  order on `/home` is logical.
- e2e +2 (delete-pass, decline-then-retry). 10 total.

### Step 4/5 still to do
- Full **device extension** (`ExtendPassPanel`) + **recovery panel** wiring
  into `/pass` (delete + install now done), then retire `wallet-page-surface.tsx`.
- `/store` retired (see top). `/issuer` still on the old shell - left for now.
- Real Safari/iPhone/PWA test + SW offline test (preview browser can't).
- `npm run build` not re-run this sprint (dev server live - build corrupts
  `.next`). Run once dev is stopped before any packaging.

### Step 7 - docs (done 2026-09-09)
- **README.md** rewritten: new "Surfaces" tables (customer / operator /
  legacy), physical + prepaid + counter-sale flows, JerkMeat affiliate, design
  system section, demo-environment section, expanded prototype-boundaries /
  known-limitations list.
- **ARCHITECTURE.md**: page-ownership split into customer / operator / legacy;
  added counter-sale + demo-reset APIs, `x-zik-store-id` scoping, the two
  payment adapters + `payment-config.ts`, `demo-environment.ts`, a service-
  worker section, updated UI/a11y conventions (shells, native-dialog menu,
  reduced motion).
- **TESTING.md**: manual flows rewritten for `/find` -> `/get-pass` -> `/verify`
  + prepaid + counter-sale; added `npm run e2e`, coverage highlights, offline
  checks, a responsive/a11y checklist, and a "physical-device testing still
  required" section.
- **`.env.example`**: `NEXT_PUBLIC_ZIK_ENV` active; `ZIK_JERKMEAT_*` and the
  affiliate TTLs documented; Apple Pay block clarified.
- **`docs/DEMO_SCRIPT.md`** added: timed five-minute walkthrough (home ->
  find -> get-pass -> clerk confirm -> decline+pay -> pass -> affiliate),
  pre-demo reset steps, quick-reference URLs, mid-demo recovery notes.
- e2e affiliate specs updated for the JerkMeat gate ("Verify with Zik" ->
  confirm -> bounce back -> "Age verified with Zik" -> `/continue`).
- Not done: before/after screenshots (after-shots exist from the polish pass;
  a matched before-set would need the retired UI).

## Decisions (cont.)

- **Hero image restored** on `/home` (2026-09-07, user request): the old
  lime-green branded product shot (`public/Zik Branded Hero.png` ->
  `public/hero-zikpass.png`). Now a **fixed full-bleed hero** pinned below the
  header that the content scrolls over (matches the old behaviour): new
  `CustomerShell` `hero` slot renders it `position: fixed`; `/home` content
  opens with a transparent spacer then an opaque rounded-top canvas panel that
  rises over it. `HomeHero` export in `home-screen.tsx`.
  - Fixed a latent bug found here: `bg-[var(--zk-canvas)]/92` produced a
    *transparent* header (Tailwind can't alpha-composite a CSS-var colour), so
    the header now uses a solid `bg-[var(--zk-canvas)]` (no backdrop-blur).
  - Image still reads "Zik Pass" (two words) - baked into the art.

## Decisions

- **Preview routes, not in-place edits, for the visual slice.** `/home` `/find`
  `/pass` `/help` are new; existing routes stay working until the direction is
  approved, then the shell + screens replace them.
- **Manrope** as the licensed font (geometric, calm, good weight range).
- **Schematic map, not real tiles.** External map tiles are an optional later
  provider; the schematic plots real coordinates and is honestly labelled. An
  accessible list is always the primary interface.
- **Offline postcode search** via `DEMO_AREA_ANCHORS` rather than shipping a
  geocoding dependency; real geocoding is a later provider boundary.
- **`ZIK_ENV`** is the demo/live switch, never `NODE_ENV`.
- Test price **£1.99** (code default + `.env`); free flow retained when price is 0.

## External blockers

- Apple Pay verification: Stripe account + HTTPS payment domain + webhook +
  Apple Pay-capable device (see section above). Owner action.
- Real Safari/iPhone/PWA testing: needs a physical device; not doable from this
  environment.

## Test evidence

- 2026-09-06: `npm test` 102/102, `npm run lint` clean, `npx tsc --noEmit`
  clean after adding the customer surface. Browser screenshots pending (needs
  dev server).

### Hero layout correction — 2026-09-07
- Replaced `object-cover` banner cropping with full-height, aspect-preserving
  artwork positioned around its right-hand product composition (81% anchor).
- Matched the full-width hero backdrop to the image and softened its side edge.
- Fixed hero and content spacer now share `--zk-home-hero-height`
  (`clamp(260px, 72vw, 340px)`), removing the previous 64px initial overlap.
- Preserved the approved narrow content column, fixed hero and scroll-over panel.
- Verified visually in the local browser at desktop, 390px and 320px widths,
  including scrolling. Targeted ESLint and `tsc --noEmit` passed. No production
  build run while the existing development server owns `.next`.

### Desktop affiliate logo rails — 2026-09-07
- Added `AffiliateLogoRails` to the customer shell: all 22 fictional affiliates,
  11 per side in centred 3 / 4 / 4 rows, fixed 20px above bottom navigation.
- Grayscale, transparent artwork; trimmed desktop SVG derivatives preserve
  original approved coloured assets. 80–100px logo slots with 12px gaps.
- Hidden below 1360px. Navigation height is observed so safe-area/font changes
  cannot make the fixed rails overlap the footer.
- Verified desktop row counts and unchanged bounds on scroll, mobile hiding
  and no mobile horizontal overflow. Targeted ESLint and TypeScript passed.

## Clerk-first counter sale

Added `/verify/counter` and private `/card#activate=…` handoff. Clerk checks ID and records till payment before showing the QR; the customer then claims and completes device setup without selecting a store or paying again. Includes atomic claim/enrollment/payment persistence within the existing runtime store, same-device retry, second-device rejection, and expired paid QR replacement. See `docs/COUNTER_SALE_FLOW.md` for operation, recovery, validation and prototype boundaries.

## Affiliate gate and returning-browser session

Updated `/affiliate-demo` to **Verify with Zik** → gold **Age verified with Zik** → **Continue / Log in**. The demo affiliate backend now creates the request state, exchanges the one-time code, and issues a signed HttpOnly age session valid for at most 30 minutes (capped by pass expiry). Returning visitors reuse it, and `/affiliate-demo/continue` enforces it server-side. The continue page remains a clearly labelled placeholder for the next dummy-affiliate task. See `docs/AFFILIATE_CUSTOMER_FLOW.md` for validation and production boundaries.

## JerkMeat affiliate demonstration

Replaced the affiliate placeholder with a responsive food-only parody: navy, pink and cyan styling, original food photography, search, categories, saved favourites and photo-detail dialogs. Preserved the existing Zik approval, signed returning-browser session and server-protected continue route. Verified desktop/mobile layouts and the complete approval-to-gallery journey; 23 affiliate tests, TypeScript and targeted ESLint passed. Fixed stale development service-worker caching that could hydrate obsolete affiliate UI; production PWA registration remains enabled.

## Independent JerkMeat repository

Extracted JerkMeat to `../jerkmeat`, with its own Next.js app, assets, dependencies, configuration, tests and Git repository. Its backend calls Zik over HTTP using a separately registered `jerkmeat` client and bearer secret; JerkMeat owns state validation and signed sessions. Added exact callback registration and external-client authentication to Zik's existing authorize/token endpoints. Preserved the embedded demo. Standalone build, TypeScript and lint pass; 10 extracted integration tests and 26 Zik affiliate tests pass.
