# Affiliate customer experience

Start the integration preview at `/affiliate-demo`.

- Before verification: **Verify with Zik** starts a server-created request and redirects to the existing Zik approval screen.
- Approval: the customer's device presents its existing pass. Zik returns a single-use authorization code.
- Return: the demo affiliate backend validates the browser's HttpOnly pending-state cookie and exchanges the code. Only a successful over-18 result creates an age session.
- Verified: the gate shows a gold checkmark and **Age verified with Zik**, then the affiliate-styled **Continue / Log in** button.
- Returning visitor: a valid signed age-session cookie restores that state without visiting Zik. The session lasts up to 30 minutes and never beyond the pass expiry. This is a prototype policy, not a regulatory retention or re-verification determination.
- Expiry: the gate offers verification again. The continue endpoint rechecks the cookie on the server, so changing client state or guessing the URL does not grant access.
- Cancellation/denial: return to the gate with a retry message and no newly granted session.

The demo is styled as **JerkMeat**, an independent, food-only parody with original AI-generated jerk-meat photography. Search, category filters and saved favourites work on desktop and mobile. `/affiliate-demo/continue` is a server-protected gallery where visitors can open photo details; it is not an implemented account system. The existing `nightfall-demo` client ID and cookie names remain unchanged to preserve integration compatibility.

## Prototype boundaries

The preview hosts Zik and the demo affiliate on the same origin. It represents server-to-server exchange by calling the exchange service inside the demo backend. A real affiliate must host its own callback and session, authenticate to the production verifier, and enforce the age policy on its actual content/API routes.

The demo cookie is HttpOnly, SameSite=Lax and Secure in production. It contains an audience, age flag, issue/expiry times and a random nonce, signed with the existing issuer key under a distinct message prefix. Real affiliates should use their own session keys/session infrastructure; this shared prototype arrangement is not a production integration contract. Sessions have bounded expiry but no immediate revocation lookup or logout mechanism yet. Pass deletion or loss does not immediately invalidate an already granted affiliate session.

This change does not add ZKP cryptography, transfer a pass between devices, or authenticate an affiliate account.

## Validation

23 targeted affiliate-verifier/session tests passed, including missing/tampered cookies, expiry capped by pass expiry, callback state binding, replay rejection and failed-result handling. Browser walkthrough verified the initial button, Zik approval, gold confirmation, session reuse on reload, and protected continue page. TypeScript and targeted lint also passed.

## Standalone JerkMeat (9 September 2026)

JerkMeat has been extracted to the sibling repository `../jerkmeat`, running locally on port 3001. The embedded `/affiliate-demo` remains available for compatibility. The independent application uses authenticated HTTP calls to `/api/affiliate/authorize` and `/api/affiliate/token`, handles its own callback, and signs its own age-session cookie with an independent secret. It imports no Zik internals or issuer keys.

Register the exact callback using `ZIK_JERKMEAT_REDIRECT_URI` (locally `http://localhost:3001/api/zik/callback`) and set `ZIK_JERKMEAT_CLIENT_SECRET` to match JerkMeat's server-only `ZIK_CLIENT_SECRET`. Both are configured in the local ignored environment files. The external client ID is `jerkmeat`; absent configuration fails closed. Existing `nightfall-demo` behavior remains prototype-only and unchanged. See the extracted README for setup, HTTP contract, separate HTTPS deployment and limitations.
