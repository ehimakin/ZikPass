# Secret protection

Implemented after the local secret audit. No credentials are included in this document.

## Local setup

On macOS, install Gitleaks with `brew install gitleaks`, then run `npm run security:hooks` after cloning. Hooks are active in the current checkout; Git does not activate them automatically in new clones. The installer refuses to overwrite other hooks.

- `npm run security:staged`: scans staged changes and rejects tracked sensitive/generated paths.
- `npm run security:scan`: scans reachable local history (including HEAD) and current tracked/nonignored files.
- `npm run security:test`: exercises synthetic credential detection, private JWK detection, narrow exceptions and forbidden file paths in a disposable repository.

Pre-commit checks staged changes. Pre-push checks local history. Both fail closed if Gitleaks is missing or fails. Reports redact matched credentials. Never bypass a failure without investigating it. Local hooks can be bypassed, so they complement server-side protection.

`.env` variants and Apple `.p8` private keys are ignored throughout the repository; `.env.example` and `.env.*.example` remain eligible for tracking. Examples must contain placeholders only. Generated `mobile/.expo` metadata has been removed from the index and remains on disk. Existing Git history is unchanged.

## GitHub

Verified via the authenticated repository API: `ehimakin/ZikPass` already has secret scanning and secret-scanning push protection enabled. Push protection covers supported patterns, not every possible secret format.

`.github/workflows/secret-scan.yml` adds push, pull-request, manual and weekly scans. It pins checkout to a commit and Gitleaks 8.30.1 to a verified archive checksum. It checks full fetched history and the current checkout, including a supplemental private-JWK rule. Reviewed false-positive exceptions are restricted to specific paths and literal values/type annotations. CI does not upload scan reports or receive deployment secrets.

The workflow starts after these changes are committed and pushed. Scheduled execution requires the workflow on the default branch. No required-status/branch-protection rules were changed. Remote-only/unreachable history and cloud credentials are outside this local scan.

## Google Maps: verification still outstanding

The repository loads Maps JavaScript and Places autocomplete in browser code. Its public key is expected to be visible; source code cannot prove the cloud restrictions. No Google Cloud CLI was available and browser access to Chrome was denied, so actual restrictions and quotas have NOT been verified or changed.

In Google Cloud Console, select the project and open APIs & Services → Credentials → the browser Maps key:

1. Confirm application restrictions use Websites and permit only actual Zik website origins. For the known Vercel deployment, review `https://zikpass.vercel.app` and its `/*` form; add actual custom domains only if used. Do not authorize all Vercel tenants. Use a separate development key for localhost.
2. Confirm API restrictions allow only APIs required by the app. Current code indicates Maps JavaScript API and Places API (New); check usage metrics before removing anything used elsewhere.
3. Review usage, quotas and billing alerts, then test store search and map placement from the real website and mobile webview. A webview loading the website uses web restrictions; a future native Maps SDK needs separately configured credentials.

Follow [Google's official Maps security guidance](https://developers.google.com/maps/api-security-best-practices). To complete verification, share the restrictions screen with the key value hidden, or provide authorized access to that console. Do not paste the key into chat.
