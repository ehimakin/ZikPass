# Zik Pass — Code Review & Security Audit

> Historical snapshot: this audit was performed against commit `f9434d8` on 2026-08-17. The
> current `v2-ui-overhaul` head has advanced to `c64216d` and now includes additional physical
> journey, payment, device-binding, error-recovery, and PWA handoff work. Treat the findings
> below as historical review context and re-check them against the current code before using
> them as release criteria.

**Date:** 2026-08-17
**Branch:** `v2-ui-overhaul` (commit `f9434d8`)
**Scope:** Full repository — `app/`, `lib/`, `components/`, `tests/`, config
**Standard applied:** Production-readiness gap analysis. Findings are rated for a system that
issues age-assurance credentials to the public, not for a demo. Where a gap is clearly an
intentional prototype shortcut, it is still listed — with that noted — because it must be closed
before any real deployment.

---

## Verification performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean, exit 0 |
| `npx eslint .` | Clean, no findings |
| `npx vitest run` | **Could not execute** — `node_modules` holds macOS-arm64 binaries; the Linux sandbox cannot load `@rollup/rollup-linux-arm64-gnu`. Run `npm test` locally. |
| `npm audit` | **Could not execute** — registry audit endpoint blocked by sandbox network policy. Run `npm audit` locally. |
| Installed versions | next 15.5.14, react 19.2.4, typescript 5.9.3, vitest 2.1.9 — all current, no known-vulnerable versions identified |
| Secrets in git history | `.env` correctly ignored; `data/issuer-keypair.json` correctly ignored; **no key material committed** |

---

## Summary

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 8 |
| Medium | 9 |
| Low / quality | 10 |

The architecture is sound in its bones — Ed25519 via WebCrypto, canonical JSON before signing,
CSPRNG-backed codes, real holder-key binding, clean provider/risk/orchestration separation, strict
TypeScript with zero `any`. The gap is that **none of the trust boundaries are actually enforced**.
Every API route is unauthenticated, the one authorisation check that exists compares against a
secret that is hardcoded in the client bundle, and the verification decision is computed in the
holder's own browser and returned unsigned.

For a product whose entire value proposition is "this person is over 18", the first thing to fix is
that a determined 15-year-old can currently issue themselves an `in_person_verified` pass from their
own laptop without visiting a store.

---

## Critical

### C1 — The retail verifier token is public, so the in-store ID check can be self-approved

`lib/server/retail-verifier.ts:9-19` gates the in-person lane behind a bearer token:

```ts
const DEMO_RETAIL_VERIFIER_TOKEN =
  process.env.ZIK_DEMO_RETAIL_VERIFIER_TOKEN ?? "demo-retail-terminal";

export function authenticateRetailVerifier(token: string | undefined) {
  if (!token || token !== DEMO_RETAIL_VERIFIER_TOKEN) {
    throw new Error("An authorised retail verifier session is required.");
  }
  return { verifier_id: "demo-clerk-terminal-001", retailer_id: "zik-london-001", ... };
}
```

That exact string is hardcoded into two client components, which means it ships in the JavaScript
bundle served to every visitor:

- `components/retail-verification-screen.tsx:14` — `const demoRetailVerifierToken = "demo-retail-terminal";`
- `components/store-session-dashboard.tsx:17` — same

**Impact.** Anyone can `POST /api/physical/sessions/verify` with
`x-zik-retailer-token: demo-retail-terminal` and a user code, and the server will record a verified
physical ID check attributed to a real clerk and retailer. `verifyPhysicalIdCheck`
(`lib/server/enrollment-service.ts:404-462`) then writes a `PhysicalVerificationAttestation` that
`credential-issuer.ts:26-34` embeds into the signed credential as
`assurance_level: "in_person_verified"`. The strongest assurance tier in the system is obtainable
with a copy-pasted header.

Note also that setting `ZIK_DEMO_RETAIL_VERIFIER_TOKEN` in production would *break* the client,
since the client hardcodes the literal — so there is currently no supported way to run this securely.

**Fix.** Retail terminals need real authentication: a per-terminal credential (mTLS client cert,
device-bound key, or an OIDC session for a store-staff identity provider) exchanged for a short-lived
session token, issued server-side and never present in client source. The verifier's
`retailer_id`/`location_id` must come from that authenticated identity, not from a lookup table
keyed off a shared string. Compare tokens with `crypto.timingSafeEqual`. Rate-limit and log every
verification decision with the acting staff identity.

---

### C2 — Every API route is unauthenticated; enrollment PII is world-readable

No route under `app/api/` performs any authentication or authorisation, and there is no
`middleware.ts`. Three routes are directly exploitable:

| Route | Exposure |
|---|---|
| `app/api/issuer/sessions/route.ts:5-12` | `GET` returns **every enrollment record** — including `application.identity_match` with first name, last name, date of birth, and current home address |
| `app/api/physical/sessions/route.ts:5-15` | `GET` returns **every store session**, including live `user_code` values before they are consumed |
| `app/api/enrollment/[id]/route.ts:4-18` | `GET` returns a full enrollment record for any ID, with no ownership check (classic IDOR) |

The `app/issuer/page.tsx` and `app/verifier/page.tsx` UI pages are deleted in the working tree, but
the APIs behind them remain live and public.

**Impact.** Bulk PII disclosure — names, DOBs, home addresses of every applicant. Under UK GDPR this
is a notifiable personal data breach, and DOB + address is a strong identity-theft starting kit.
Leaking live `user_code`s also feeds C1: an attacker enumerates active in-store codes from one
endpoint and approves them at another.

**Fix.**
- Add `middleware.ts` that denies by default and requires an authenticated principal for everything
  except genuinely public routes (`/api/config/public-key`).
- The issuer dashboard needs an operator identity with RBAC, not just "not logged out".
- `GET /api/enrollment/[id]` must require proof that the caller owns the enrollment — bind it to the
  holder key registered at `startEnrollment` and require a signature over a server nonce.
- Never return `user_code` from a list endpoint; scope session listing to the authenticated retailer.
- Return a redacted projection of `EnrollmentRecord` to the client. The wallet does not need
  `application.identity_match`, `bank_verification.code`, or `provider_execution.raw_response`.

---

### C3 — Anyone who knows an enrollment ID can force issuance and skip cooling-off

Three state-changing routes accept nothing but an `enrollmentId`:

- `app/api/enrollment/issue/route.ts:6-7`
- `app/api/enrollment/advance-cooling-off/route.ts:6-7`
- `app/api/enrollment/retry/route.ts:6-7`

`advanceCoolingOff` (`lib/server/enrollment-service.ts:257`) exists to let the demo skip the waiting
period. In production it removes the cooling-off control entirely — the single mechanism the README
describes as the defence against a freshly issued pass being used immediately.

This compounds with **L7**: `randomId()` (`lib/shared/utils.ts:27-29`) truncates a UUID to 8 hex
characters — 32 bits of entropy — so enrollment IDs are enumerable, and C2 hands them out in bulk
anyway.

**Fix.** Every mutation must be authorised against the enrollment's holder key. Delete
`advance-cooling-off` or hard-gate it behind an operator role plus `NODE_ENV !== "production"`.
Widen `randomId` to a full UUIDv4 or 128 bits of base64url.

---

### C4 — The physical device-auth step can be completed by anyone, with no device proof

`POST /api/physical/device-auth/start` takes only `enrollmentId`. `POST .../complete`
(`lib/server/enrollment-service.ts:586-650`) takes the returned `challengeId` and a `method`. When
`method` is `"demo_device_check"`, **no verification of any kind occurs** — the `webauthn` branch at
line 615 is the only path that validates anything, and the caller chooses which branch to take.

Chained with C1 and C2, the full bypass is:

1. `GET /api/physical/sessions` → harvest an active `user_code` (C2)
2. `POST /api/physical/sessions/verify` with the public token → clerk ID check "confirmed" (C1)
3. `POST /api/physical/device-auth/start` → get a challenge
4. `POST /api/physical/device-auth/complete` with `method: "demo_device_check"` → device "verified"
5. `POST /api/enrollment/issue` → signed `in_person_verified` credential (C3)

No store visit, no ID, no device.

**Fix.** Remove `demo_device_check` from the production build — make the method server-decided, not
client-supplied. Complete the WebAuthn implementation: `validateWebAuthnClientData`
(`lib/server/enrollment-service.ts:1679-1702`) correctly checks the challenge and `type`, but does
**not** verify `clientData.origin`, the authenticator data (RP ID hash, UP/UV flags, sign counter),
or the attestation signature — so the "WebAuthn" path is currently also unverified. Use a maintained
library (`@simplewebauthn/server`) rather than hand-rolling this.

---

## High

### H1 — Misconfigured environment variables fail open

`lib/shared/config.ts:13-25` coerces every setting with bare `Number()`:

```ts
minOldestAccountMonths: Number(process.env.ZIK_MIN_OLDEST_ACCOUNT_MONTHS ?? 12),
```

`Number("twelve")` is `NaN`. In `lib/server/proof-evaluator.ts:11`:

```ts
if (proof.signals.oldest_account_age_months < runtimeConfig.minOldestAccountMonths) {
```

`n < NaN` is always `false`, so no rejection reason is pushed and `approved` becomes `true` for
every applicant. A typo in a deployment variable silently disables the adulthood rule. The same
pattern makes every TTL (`physicalSessionTtlSeconds`, `physicalUserCodeTtlSeconds`,
`physicalDeviceAuthChallengeTtlSeconds`) `NaN`, which collapses the expiry comparisons too.

**Fix.** Parse and validate config at boot with a schema (zod or equivalent), enforce sane
min/max bounds, and **throw on startup** rather than degrading. Security-relevant thresholds should
fail closed.

### H2 — Issuer signing key is plaintext on local disk and silently regenerated

`lib/server/issuer-keys.ts:13-24` reads the private JWK from `data/issuer-keypair.json`, and on
*any* failure — missing file, permissions error, corrupt JSON — generates a brand-new keypair and
writes it out. There is no HSM/KMS, no rotation, no `kid` in the credential, and no error surfaced.

`lib/server/runtime-paths.ts:19-28` routes the key to `os.tmpdir()` on Vercel/Lambda, so on those
platforms **every cold start mints a new issuer identity** and instantly invalidates every
previously issued credential. The current file is mode `0600`, which is right, but that is the only
protection.

**Fix.** Move signing to a KMS/HSM (AWS KMS, GCP KMS, or a cloud HSM) so the private key never
exists in application memory. Add a `kid` to `AgeCredential` and publish a JWKS endpoint so
rotation is possible without mass revocation. Never auto-generate: if the key cannot be loaded, fail
to start.

### H3 — No rate limiting anywhere

There is no throttling on any route. The two brute-forceable secrets:

- **In-store `user_code`** — 6 characters from a 32-symbol alphabet (`randomAlphaNumericCode`,
  `lib/shared/utils.ts:36-40`), ~2^30 space, but **no attempt counter at all** on
  `/api/physical/sessions/lookup` or `/api/physical/sessions/verify`. Since only a handful of codes
  are live at once, this is closer to enumeration of a small active set than a 2^30 search.
- **Bank possession code** — 6 numeric digits, capped at 3 attempts per enrollment
  (`bankVerificationMaxAttempts`), but nothing prevents starting unlimited fresh enrollments.

**Fix.** Per-IP and per-principal rate limits at the edge, plus per-resource lockout with
exponential backoff. Alert on repeated `code_invalid`. Cap concurrent enrollments per fingerprint.

### H4 — `postMessage` target origin is attacker-controlled

`app/verify/zik/page.tsx:15` builds the session from the query string:

```ts
vendor_origin: getParam(params.origin) ?? "http://localhost:3000",
```

and `components/zik-hosted-verification.tsx:361-372` uses it verbatim:

```ts
const targetOrigin = session.vendor_origin || window.location.origin;
window.parent.postMessage(message, targetOrigin);
window.opener.postMessage(message, targetOrigin);
```

Any website can frame or `window.open` `/verify/zik?origin=https://evil.example&vendor=Anything` and
receive the user's verification result — `verified`, `over18`, `assurance_level`, `session_id` —
directly. The page has no framing protection (see M5).

**Fix.** Maintain a server-side registry of onboarded vendors keyed by `session_id`; resolve the
origin from that registry, never from the URL. Reject any `origin` not on the allowlist. Add
`frame-ancestors` limited to registered vendor origins.

### H5 — The verification result is unsigned and computed on the holder's own device

`components/zik-hosted-verification.tsx:90-120` calls `createPresentationBundle` and
`verifyPresentationBundle` **in the wallet's browser**, then posts a plain
`VendorVerificationResult` object (`lib/shared/vendor-verification.ts:26-35`) to the vendor. That
object carries no signature, no nonce, and no issuer attestation.

A vendor receiving `{ verified: true, over18: true }` has no cryptographic basis for trusting it.
Any script on any page can forge the same message. `components/verifier-demo.tsx:34` checks
`event.origin !== window.location.origin`, which only holds because the demo vendor is same-origin;
a real vendor on a different domain has nothing to check.

**Fix.** The vendor must receive the `PresentationBundle` and verify it itself (that is what
`lib/shared/verifier-sdk.ts` is for), or Zik must return a signed, short-lived, audience-bound
assertion (a JWT signed by the issuer key with `aud`, `nonce`, `exp`) that the vendor validates
server-side. Client-side `postMessage` of a boolean is not an authentication protocol.

### H6 — No replay protection, audience binding, or revocation in verification

`lib/shared/verifier-sdk.ts:5-31` verifies the issuer signature, the holder signature over
`bundle.challenge`, activation, expiry, and the `over18` claim. It does not check:

- that the challenge was issued by *this* verifier (no audience binding) — a bundle captured at
  vendor A is valid at vendor B
- that the challenge is fresh or single-use (no nonce store, no time window) — bundles replay
  indefinitely
- credential status — there is no revocation list, status list, or issuer callback anywhere in the
  codebase, so a credential issued in error is unrevokable for its full lifetime (see H8)

**Fix.** Verifier-generated single-use nonces with a short TTL and server-side consumption; include
the verifier's identity in the signed challenge; implement a status mechanism (W3C Bitstring Status
List, or a signed short-lived status endpoint) and check it before `allow`.

### H7 — Internal error messages are returned verbatim to clients

Every route follows this pattern:

```ts
return NextResponse.json(
  { error: error instanceof Error ? error.message : "..." },
  { status: 400 }
);
```

Those messages are internal invariants — *"That session has already been confirmed by staff."*,
*"This verifier is not authorised for the requested store session."*, *"Staff must confirm the
in-person ID check before device authentication."* They let an unauthenticated attacker map exact
state-machine position and distinguish "code exists but wrong state" from "code does not exist",
which is an enumeration oracle for H3.

**Fix.** Map internal errors to a small set of generic client-facing codes. Log full detail
server-side with a correlation ID and return only the ID.

### H8 — Credentials live for a year with no revocation

`.env` sets `ZIK_CREDENTIAL_TTL_HOURS=8760` and `lib/shared/config.ts:22` defaults to `24 * 365`.
Combined with H6 (no status list), a credential issued through any of the C1–C4 bypasses — or to a
user whose circumstances change — is valid and unstoppable for twelve months.

**Fix.** Shorten credential lifetime substantially (days to weeks) with silent background renewal,
and ship a revocation mechanism before launch. These two go together: short TTLs make revocation
latency tolerable.

---

## Medium

### M1 — Read-modify-write race in the storage layer

`lib/server/storage.ts:117-145`: `upsertEnrollment` and `upsertPhysicalSession` each call
`readStore()`, mutate the in-memory array, then `writeStore()` — rewriting the entire file. Two
concurrent requests silently discard one another's changes. `writeJsonAtomic` (:440-448) does
`write-temp` + `rename`, which is atomic at the filesystem level but provides no mutual exclusion,
and the temp suffix uses `Math.random()` (:446-448) rather than a CSPRNG.

The `readStateJson` retry at :429-438 (parse, and on failure re-read and parse again) is a symptom
of exactly this race being observed in practice.

**Fix.** Move to a real database with transactions and row-level concurrency control. If the JSON
store must persist short-term, put every mutation behind a single in-process async mutex and use
`crypto.randomUUID()` for temp names — but be explicit that this does not survive multiple instances.

### M2 — Storage is O(n) on every operation and rewrites the whole dataset per write

Every read (`getEnrollment`, `findPhysicalSessionByUserCode`, `checkDuplicateApplication`) parses the
full JSON file and does a linear scan; every write serialises the entire dataset with
`JSON.stringify(value, null, 2)`. `runtime-state.json` is already 34 KB after a handful of test
enrollments. `checkDuplicateApplication` (`lib/server/application-guard.ts:43-51`) scans all
enrollments on every application start.

**Fix.** PostgreSQL with indexes on `id`, `application_fingerprint`, `user_code`, and `status`. This
is the single change that also resolves M1 and most of M6.

### M3 — Secrets compared with `!==` (non-constant-time)

- `lib/server/retail-verifier.ts:17` — verifier token
- `lib/server/services/providers/bank-verification/provider.ts:177` — possession code
- `lib/server/enrollment-service.ts:606` — device-auth challenge ID
- `lib/server/enrollment-service.ts:1695` — WebAuthn challenge

Timing side channels over a network are hard to exploit but trivially avoided.

**Fix.** `crypto.timingSafeEqual` on equal-length buffers for every secret comparison.

### M4 — No request-body validation; client-controlled test hooks reach the risk engine

Every route casts the parsed body with `as` and trusts it:

```ts
const body = (await request.json()) as { enrollmentId: string };
```

Two concrete consequences:

- `app/api/enrollment/start/route.ts:30` accepts an arbitrary `holderPublicKey: JsonWebKey` with no
  validation of `kty`, `crv`, or key length. That unvalidated JWK is persisted and embedded into a
  signed credential as `subject_public_key`. A malformed key produces a credential that no verifier
  can ever validate; a substituted key breaks device binding.
- `app/api/enrollment/start/route.ts:32,59` passes a client-supplied `demoScenario` straight into
  `application.demo_scenario`, which steers the provider simulators
  (`lib/server/services/providers/simulator-utils.ts:4-8` and each provider's scenario switch). A
  client selecting its own risk-evaluation outcome is a test hook that must not exist in production.
- `validateIdentityMatchInput` (`start/route.ts:11-24`) calls `.trim()` on fields that may be
  `undefined`, throwing `TypeError` rather than a clean validation error.

**Fix.** Define zod schemas for every request body and parse (not cast) at the route boundary.
Validate the holder JWK explicitly (`kty === "OKP"`, `crv === "Ed25519"`, correct `x` length) and
attempt `importKey` before accepting it. Strip `demoScenario` unless an explicit demo-mode flag is
set server-side.

### M5 — No security headers or CSP

`next.config.ts` contains only `typedRoutes: true`. Missing: `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and
`frame-ancestors`/`X-Frame-Options`. The last one directly enables H4 — `/verify/zik` is framable by
any site.

**Fix.** Add a `headers()` block in `next.config.ts` (or set them in middleware). A strict CSP
matters more than usual here because an XSS also exfiltrates the holder private key (M7).

### M6 — PII stored unencrypted with no retention or deletion path

`application.identity_match` — first name, last name, date of birth, current home address, and
optionally previous address (`lib/shared/types.ts`) — is written to `data/runtime-state.json` in
plaintext and never removed. There is no deletion endpoint, no retention job, no encryption at rest,
and no access log.

Credit to the design: `lib/server/enrollment-service.ts:1440-1460` does minimise completed *physical*
sessions (clears `user_code`, sets `minimized_at`). That pattern needs extending to the remote lane's
identity data, which is the sensitive part.

For a UK age-verification service this is a data-protection problem, not just a security one:
Article 5(1)(e) storage limitation, Article 17 erasure, and Article 32 security of processing all
apply, and the ICO's age-assurance guidance expects identity data to be discarded once the assurance
decision is made.

**Fix.** Discard `identity_match` as soon as the fingerprint and risk decision are computed — the
SHA-256 fingerprint in `application-guard.ts:18-28` is sufficient for duplicate detection and does
not require retaining the plaintext. Encrypt any residual PII at rest with an envelope key. Add a
retention job and a subject-erasure endpoint. Write a DPIA before launch.

### M7 — Holder private key is stored extractable in IndexedDB

`lib/shared/crypto/ed25519.ts:10` generates the keypair with `extractable = true` and exports both
halves to JWK. `lib/client/wallet-client.ts:29-39` persists that JWK — private key included — into
IndexedDB as ordinary structured data. Any XSS on the origin reads the key and the credential and
clones the pass onto an attacker's device.

The code acknowledges this (`wallet-client.ts:174`: *"Future mobile wallets should swap this browser
storage for secure device-backed key storage"*), so it is a known shortcut — but it is the shortcut
that voids device binding, which is the whole point of the holder key.

**Fix.** Generate with `extractable: false` and store the non-extractable `CryptoKey` object directly
in IndexedDB (structured-clonable, and the private key material stays inside the browser's crypto
implementation). Only the public JWK should ever be exported. Longer term, move to a native wallet
with Secure Enclave / StrongBox and WebAuthn-backed keys.

### M8 — Development endpoint hands out a server-generated private key

`app/api/wallet/holder-key/route.ts` generates an Ed25519 keypair server-side and returns **both
halves** to the caller. It is gated on `process.env.NODE_ENV === "production"`.

Two problems: the private key traverses the network and briefly exists in server memory, defeating
device binding by construction; and `NODE_ENV` is a weak gate — preview, staging, and any build not
explicitly set to `production` will expose it.

**Fix.** Delete the route and handle the underlying problem (some mobile browsers lack Ed25519) with
a WebCrypto polyfill or an ECDSA P-256 fallback generated client-side. If it must stay, gate it on an
explicit `ZIK_ENABLE_DEV_KEY_FALLBACK === "true"` opt-in, never on `NODE_ENV`.

### M9 — Repository hygiene

- `tsconfig.tsbuildinfo` is committed and shows as modified on every build — churns diffs.
- `.DS_Store` appears in the tree root, `app/`, `app/api/`, `app/api/enrollment/`, and `public/`.
  `.gitignore` covers it, but the existing files should be removed.
- `data/state.json` is committed as a seed (currently `{"enrollments": []}`) while runtime data goes
  to `data/runtime-state.json` — the README (line 15) still documents `data/state.json` as the
  persistence layer.
- `.env` and `.env.example` are byte-identical, so `.env.example` documents only 3 of the 9 variables
  `lib/shared/config.ts` actually reads, and omits `ZIK_DEMO_RETAIL_VERIFIER_TOKEN` entirely.

**Fix.** `git rm --cached tsconfig.tsbuildinfo` and add it to `.gitignore`; remove the `.DS_Store`
files; document all nine variables in `.env.example` with their security implications.

---

## Low / code quality

### L1 — Two files carry most of the complexity

`components/wallet-surface.tsx` is **3,866 lines** with 24 `useState`, 11 `useEffect`, 8
`useCallback`, and 4 polling intervals in one component. `lib/server/enrollment-service.ts` is
**1,702 lines** mixing routing logic, state machine transitions, provider orchestration, physical
session lifecycle, and WebAuthn validation.

Both are past the point where a reviewer can hold the control flow in their head, which is how
issues like C4 survive. Split `wallet-surface` by flow stage (onboarding / enrollment / wallet /
presentation) with state in a reducer or a small store; split `enrollment-service` into
`enrollment/remote.ts`, `enrollment/physical.ts`, `enrollment/device-auth.ts`, and a shared
transitions module.

### L2 — Test coverage misses everything security-relevant

Twelve test files cover pure functions (`zignature`, `wallet-state`, `verifier-sdk`,
`physical-flow`, risk engine, provider simulators). There are **zero** tests for:

- any API route handler
- `lib/server/storage.ts` (including concurrent writes)
- `lib/server/issuer-keys.ts` and `credential-issuer.ts`
- `lib/server/retail-verifier.ts` — the one authorisation function in the codebase
- `validateWebAuthnClientData`

`tests/verifier-sdk.test.ts` is well constructed and does test the negative cases; that approach
should be extended to the authorisation paths. Add integration tests that assert each route
**rejects** unauthenticated and cross-tenant requests — those tests are what would catch C1–C4
regressions.

### L3 — Polling without backoff or visibility awareness

`setInterval` loops in `components/wallet-surface.tsx:597, 620, 634, 647`,
`components/issuer-dashboard.tsx:35`, `components/retail-verification-screen.tsx:193`, and a 1 Hz
clock in `components/wallet-page-surface.tsx:50`. None pause on `document.hidden`, none back off on
error, and the endpoints send no `ETag`/`Cache-Control` so every poll is a full JSON payload.

**Fix.** Server-Sent Events for enrollment state transitions; failing that, pause on
`visibilitychange`, add exponential backoff, and return `ETag` with `304` support.

### L4 — ~200 lines of legacy migration code

`lib/server/storage.ts:147-341` (`normalizeEnrollment`) reconstructs records from a pre-Sprint-6
schema, fabricating a `"Legacy Applicant"` / `"1990-01-01"` / `"Legacy address"` identity and a
default *approved* proof (`has_primary_credit_account: true, oldest_account_age_months: 24`) for any
record missing those fields.

If no legacy data exists, this is dead weight on every read. If it does, it silently manufactures an
approval. Either way it should be a one-off migration script, not a hot-path function.

### L5 — Unused assets in `public/`

`homepage-device-bg copy.svg`, `homepage-device-bg_old.svg`, `homepage-device-bg_old1.svg`,
`Zik Branded Hero_old.png`, `Zik Branded Hero_oldB.png`, `free-background-images-featured.jpg`,
`hero-placeholder.svg`. Note the filename with a space, and confirm the licence on
`free-background-images-featured.jpg` before shipping. Also: no `next/image` usage found — raw
`<img>`/CSS backgrounds skip Next's optimisation pipeline.

### L6 — No audit log

There is no persistent, append-only record of who verified what and when. `NotificationRecord`
(`lib/server/notifications.ts`) is user-facing messaging, and `orchestration.events` lives inside the
mutable enrollment record — it can be overwritten by the same read-modify-write cycle as everything
else.

An age-assurance provider needs a tamper-evident log of issuance and verification decisions, with
the acting identity, for both incident response and regulatory evidence.

### L7 — 32-bit identifiers

`lib/shared/utils.ts:27-29`:

```ts
return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
```

8 hex characters = 32 bits. Used for `credential_id`, enrollment IDs, session IDs, and challenge IDs.
Birthday collisions become likely around ~77,000 records, and the small space makes IDs guessable —
which is what makes C2 and C3 practically exploitable rather than theoretical.

**Fix.** Use the full UUID, or `bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)))`.

### L8 — Lint config is defaults only

`eslint.config.mjs` extends `next/core-web-vitals` and `next/typescript` with no additional rules.
Worth adding: `typescript-eslint` type-aware linting with `no-floating-promises` (the codebase uses
`void (async () => {...})()` in many places, which the rule would catch properly),
`no-unnecessary-condition`, and an import-order rule. Consider `eslint-plugin-security` and a
`no-restricted-syntax` rule banning `as` casts on `request.json()` results once M4 is addressed.

### L9 — Dependency and supply-chain checks not run

`npm audit` was blocked by the sandbox network policy. Installed versions are current and no
known-vulnerable release was identified by inspection, but this needs confirming locally.

**Fix.** Run `npm audit` and `npm outdated`. Add Dependabot or Renovate, enable
`npm ci --ignore-scripts` in CI, and commit a lockfile-integrity check. The `qrcode` package is the
only non-framework runtime dependency — worth confirming it is still actively maintained.

### L10 — Documentation drift

`README.md` describes the single-lane remote flow and `data/state.json` persistence; the code has a
two-lane model (remote financial + physical in-store) with a different storage path. The two
architecture documents in the repo root (`Zik_Two_Lane_Assurance_Model.pdf`, the model PNG) are not
referenced from the README. `zik_pass_mvp.md` predates the current design.

---

## What is already right

Worth stating plainly, because the foundations are good and the fixes above are mostly about
enforcement rather than redesign:

- **Ed25519 via WebCrypto** — correct algorithm choice, no hand-rolled crypto, no vulnerable
  library.
- **Canonical serialisation before signing** — `stableStringify` (`lib/shared/utils.ts:1-17`)
  recursively sorts object keys, so signatures are stable across serialisation order. This is a
  detail many implementations get wrong.
- **CSPRNG everywhere it matters** — `crypto.getRandomValues` for codes and challenges,
  `crypto.randomUUID` for IDs. `Math.random` appears only in a temp filename.
- **Genuine holder-key binding** — `subject_public_key` is embedded in the signed credential and
  checked at verification, so the design is device-bound even though the storage (M7) undermines it.
- **No XSS sinks** — zero occurrences of `dangerouslySetInnerHTML`, `eval`, `innerHTML`, or
  `new Function` across `app/`, `components/`, and `lib/`.
- **Strict TypeScript, honoured** — `strict: true`, zero `as any` casts, and `tsc --noEmit` passes
  cleanly.
- **Clean layering** — provider adapters, risk engine, and orchestration are properly separated
  behind interfaces (`ApplicationRiskEngine`, the provider contracts in
  `lib/shared/provider-contracts.ts`), which will make swapping simulators for real providers
  straightforward.
- **Deliberate PII minimisation exists** — completed physical sessions clear `user_code` and set
  `minimized_at` (`enrollment-service.ts:1440-1460`). The pattern is there; it needs extending.
- **WebAuthn challenge validation is present** — incomplete (C4), but the challenge and `type`
  checks are correct as far as they go.

---

## Suggested order of work

**Before any deployment reachable from the internet**

1. C1 — replace the shared retail token with real terminal authentication
2. C2 — add `middleware.ts` with deny-by-default auth; redact `EnrollmentRecord` responses
3. C4 — remove `demo_device_check`; complete WebAuthn verification with `@simplewebauthn/server`
4. C3 — bind all mutations to the holder key; remove `advance-cooling-off`
5. M8 — delete `/api/wallet/holder-key`

**Before handling any real user data**

6. H1 — validated config with fail-closed startup
7. M4 — zod schemas at every route boundary; validate the holder JWK; strip `demoScenario`
8. H3 — rate limiting and lockout
9. M6 — discard `identity_match` post-decision; encrypt residual PII; DPIA
10. H7 — generic client errors, detailed server logs
11. M5 — security headers and CSP
12. H4 — vendor origin allowlist

**Before launch**

13. H2 — KMS-backed issuer key with `kid` and JWKS
14. H5 / H6 — signed audience-bound assertions, nonce replay protection
15. H8 — short credential TTL plus a revocation/status mechanism
16. M1 / M2 — PostgreSQL with transactions
17. M7 — non-extractable holder keys
18. L6 — tamper-evident audit log
19. L2 — authorisation integration tests for every route
20. L7 — full-entropy identifiers

**Ongoing**

21. L1 — decompose `wallet-surface.tsx` and `enrollment-service.ts`
22. L3 — SSE or backoff-aware polling
23. L4, L5, L8, L9, L10, M9 — cleanup, tooling, docs

---

*Static review plus type-check and lint execution. Test suite and dependency audit could not be run
in the review sandbox — see Verification performed. No dynamic testing or penetration testing was
carried out; the exploit chains described in C1–C4 are derived from source reading and should be
confirmed against a running instance.*
