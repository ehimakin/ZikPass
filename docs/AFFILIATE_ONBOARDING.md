# Zik Pass development integration

This integration targets Next.js 15+ App Router, a root app/ directory and the @/* path alias. No package is downloaded by the installer. For other frameworks, implement the API contract below.

1. Open /affiliates on the local Zik server. Enter your site and exact callback URL (normally /api/zik/callback). Save the private setup link; it expires after seven days. Sharing it grants control of this development registration.
2. Generate credentials and copy the environment settings to the affiliate server's .env.local. Never expose the secret through NEXT_PUBLIC_, browser code or source control. A replacement secret immediately invalidates the previous one and clears verification evidence.
3. Download zik-next-setup.mjs and inspect its embedded source. Run `node zik-next-setup.mjs` for a preview, then `node zik-next-setup.mjs --install`. The installer refuses to overwrite existing files. Copy the generated ZIK_SESSION_SECRET from .env.zik-session.local into .env.local. Keep both files ignored by Git. Restart the affiliate server.
4. Render `<ZikVerifyButton />` from components/zik-verify-button.tsx. In every protected server page call `await requireAge()` from lib/zikpass/require-age.ts before rendering. In protected API routes call `await ageSession()` and return HTTP 403 when absent. A verified button alone does not protect content. Publicly served assets cannot be protected by a page guard.
5. Run `node --env-file=.env.local zik-next-setup.mjs --check`. From the affiliate site, complete verification using a valid development pass. Refresh the setup checks in Zik and activate the development integration.

Pomography and JerkMeat already implement steps 3–4. Set ZIK_CLIENT_ID and ZIK_REDIRECT_URI alongside their existing ZIK_CLIENT_SECRET, keep their existing site-specific session secret and origin, restart them, and use `npm run zik:check`.

## Server API contract

All calls use JSON and `Authorization: Bearer <server client secret>`. Keep redirect_uri identical to the registered callback. Never exchange codes from a browser.

- POST /api/affiliate/connection with `{ client_id, redirect_uri }` verifies server credentials and callback registration. This does not prove callback reachability or access enforcement.
- POST /api/affiliate/authorize with `{ client_id, redirect_uri, state }`. Generate unpredictable state on the affiliate server and store it in an HttpOnly, SameSite=Lax cookie. The response includes confirm_url, a path on the configured Zik origin. Redirect the browser there.
- The customer's approval returns code and state to the registered callback. Reject error responses, missing state and mismatched state before exchange. Clear the pending-state cookie after callback handling.
- POST /api/affiliate/token with `{ client_id, redirect_uri, state, code }`. Require age_over === true and threshold === 18. Issue a signed HttpOnly affiliate session capped by both the returned expires_at and 30 minutes. Use Secure cookies on HTTPS. Codes expire and cannot be replayed.

## Assisted setup and operations

“Request assisted setup” saves a contact email and help request. “Request a time and calendar invitation” creates a tentative 30-minute booking and a paired session. Dates must be at least 15 minutes in the future and within the setup invitation lifetime. No availability is assumed or queried. The agent confirms or cancels the time in the paired view. Email/calendar status distinguishes not_configured, sending, sent (accepted by SMTP), and failed/uncertain. There is no automatic retry after uncertain delivery; cancel and rebook after checking the mail account.

On the Zik server run `node --env-file=.env.local scripts/affiliate-assistance.mjs` to review the local help/booking inbox. ZIK_RUNTIME_DATA_DIR is honored. The private agent credential is ZIK_ONBOARDING_AGENT_KEY in .env.local, generated during this implementation; it must never be shared with an affiliate.

### Email/calendar setup

Configure ZIK_ONBOARDING_EMAIL, ZIK_ONBOARDING_PUBLIC_URL (the public HTTPS origin of your running development server), ZIK_SMTP_HOST, ZIK_SMTP_PORT, ZIK_SMTP_USER, ZIK_SMTP_PASSWORD and ZIK_SMTP_FROM. External SMTP requires TLS (465) or STARTTLS (587). Only loopback SMTP test servers can run without authentication/TLS. A local-only or missing public URL blocks sending, so recipients are never invited to an unusable localhost route.

The sender must be authorized by the mail provider. Invitations go to the operator and client using standard iCalendar REQUEST/CANCEL MIME messages. The event contains /affiliates/session?id=...; the shared pairing key is in the email body, never in the event. The app does not directly insert events into Google/Outlook accounts or read their availability. Calendar invitation handling depends on each recipient's mail/calendar client.

### Paired sessions

Open the session link and enter the shared pairing key. Clients first open their private setup invitation in the same tab; agents also enter their private operator key. Short polling shares only the allowlisted client form (organisation, framework, contact, implementation progress and question), installation evidence, presence and agent guidance. Client edits retry after temporary network failures. Agents cannot edit client fields or access the client secret. Each role can have one current session; rejoining replaces its previous token. Ending a session invalidates both role tokens and stops sharing; both participants may explicitly rejoin with the existing key. Pair keys and role tokens are persisted only as hashes, expire with the seven-day setup invitation, and are excluded from the progress response.

Creating a new standalone pair invalidates the previous pair. An open booking prevents key replacement so its emailed pairing key remains valid. The original private setup URL for each configured demo is saved as ZIK_SETUP_URL in that affiliate's .env.local. Previous local affiliate settings were retained in .env.before-onboarding.local.

Setup management tokens are passed in URL fragments, removed from the address bar, and kept in tab-scoped sessionStorage. Only token/credential hashes are persisted on the Zik server. Save the setup link before closing the tab. Development registrations and management endpoints are disabled when NODE_ENV=production. Testing credentials can run real development verifications before activation; activation records completion of setup, not production approval.

Disabling a registration blocks new authorizations and exchanges. It does not revoke sessions already issued by the affiliate: those expire independently within 30 minutes with this integration. Removing the integration means removing its routes/button/guards as appropriate, clearing its cookies, and deleting server credentials.

The development registry uses a local atomic JSON file and a cross-process writer lock. Production needs an authenticated operator/account flow, durable database transactions, recovery/renewal of invitations, rate limiting, and production credentials. Do not deploy this development registry as a production onboarding service.


### Google Calendar and Apple Calendar

Saved bookings expose “Add to Google Calendar” (a prefilled event the user saves) and “Apple Calendar (.ics)” (a PUBLISH calendar download). Both include the paired session route, time and booking status, and exclude pairing/access keys. These manual additions are copies, not synced calendar connections; use the emailed invitation to receive booking changes. Downloads omit organizer/attendees to avoid turning a personal import into a new invitation. Cancelled bookings cannot create new calendar copies.

Google supports the event-template link: https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events
Apple supports calendar-file imports on Mac: https://support.apple.com/en-gb/guide/calendar/icl1023/mac
For iPhone, accept the emailed invitation: https://support.apple.com/en-gb/guide/iphone/iphc0eddfe3c/ios
