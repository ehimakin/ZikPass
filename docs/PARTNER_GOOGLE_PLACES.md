# Partner store Google lookup

`/partner_stores` offers optional Google Places search. Selecting a branch fills
its name and full address into editable application fields. The application includes the
Google Place ID for follow-up; it does not verify ownership or activate a store.
Contact name and work email are entered by the applicant.

## Setup

1. Enable billing, Maps JavaScript API and Places API (New) in Google Cloud.
2. Create a browser API key restricted to those APIs and your production HTTP
   referrers (plus localhost referrers for development).
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and rebuild/restart Next.js. This is an
   intentionally public browser key; never use a server credential here.
4. Check the deployed domain can search and select an actual business. Configure
   usage quotas and billing alerts in Google Cloud.

Without a key, or if Google fails, the manual application form remains available.
Google is loaded only after the applicant clicks Search with Google. The widget
provides Google's predictions and attribution. No Google login is required.

Implementation follows Google's Place Autocomplete widget documentation:
https://developers.google.com/maps/documentation/javascript/place-autocomplete-new

## Verification

Run the Playwright spec on a fresh server with a placeholder key; Google is mocked
and no billed requests are made:

```sh
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=test-key ZIK_E2E_BASE_URL=http://localhost:3018 npx playwright test e2e/partner-stores.spec.ts
```

The spec covers application submission/retry, dashboard resume, demo review and
setup, Google selection and editing, manual fallback and navigation policies. A real configured key is still needed for
a live Google smoke test.

## Local development credential

For local development, `npm run dev` reads the browser key from
`DELETE_BEFORE_PRODUCTION_CREDENTIALS/google-maps.env` if the environment variable
is not already set. This folder is Git-excluded; the credential file is readable
only by its owner. Production builds do not read this folder. Delete it before
production and configure a separate production key with production referrers.
The public key is necessarily included in development browser bundles and caches.

The development key allows `http://localhost:3000/*`. Use the actual route
`http://localhost:3000/partner_stores`; the asterisk is a key restriction pattern,
not a page URL. Restart the dev server after replacing the credential file.

The partner page permits Google Maps/Places connections and Google attribution
images in its CSP, and sends only the origin on cross-origin requests so Google's
HTTP referrer key restriction can work. Links into the page use a full document
navigation to apply these headers. Other document responses keep their existing
policies. Google's widget is rendered with a light color scheme to match the form.

A live autocomplete selection was verified on localhost: business name and full
address populated successfully. No enquiry was submitted during this smoke test.


## Dedicated application prototype

Local development now uses a four-step application (store, contact, services,
review), followed by a private partner workspace. No support ticket is created.
`/api/partners/applications` owns application creation, retrieval and setup updates.

Applications are saved separately in `partner-applications.json` under the runtime
data directory. Files use owner-only permissions and atomic replacement with a
cross-process writer lock. Access keys are hashed on the server; a per-tab session
holds the key and reference so a reload can resume. Access expires after 30 days;
records are not automatically deleted. Use synthetic applicant data in development.
There is no email delivery or cross-device account recovery in this prototype.

The demo review button moves an application from submitted to setup. Completing
all three preparation tasks produces a demo-ready status; unchecking a task returns
to setup. No action creates a live store, staff credential, commercial agreement,
or public directory entry. The API and guided flow fail closed outside development
and test environments. Production onboarding needs staff review, durable storage,
verified account access and an agreed retention policy before enabling it.

Validation: `npx vitest run tests/partner-applications.test.ts` covers persistence,
retry idempotency, bearer access, same-origin checks, setup transitions, validation,
rate limits and production gating. Browser coverage lives in the partner spec.
