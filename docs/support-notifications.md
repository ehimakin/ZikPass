# Staff support and notifications

Deployment domain: `zik.solutions`. Proposed sending subdomain: `notify.zik.solutions`; proposed from address: `support@notify.zik.solutions`. These are prepared values, not a claim of DNS verification. Staff recipients, DNS host, database and Vercel plan are awaiting confirmation.

The staff workspace is `/dashboard/admin`; customers use `/help` and private ticket links. Staff accounts are independent of customer, affiliate and retail-clerk identities. Named `admin`, `support` and `engineer` accounts can triage tickets and bugs. Only admins can run retention or manually process the delivery queue. Removing an account or changing credentials invalidates existing staff sessions.

## Implemented flow

- Ticket creation/customer replies notify the configured staff email. Recovery/privacy tickets, urgent escalation and recurrence of resolved bugs also alert the configured staff phone.
- Public staff replies, status/resolution changes and partner approvals queue customer email only when that customer opted in at creation. Internal notes never trigger customer notifications.
- Emails/SMS contain references and generic notices, never ticket bodies, diagnostics or bearer access links. Customers must retain their private ticket link. Email replies do not enter the ticket system.
- After a ticket change commits, Next.js runs notification processing after the response, prioritizing the new event. Caught errors trigger grouping and staff notification in the same background lifecycle. A once-daily worker imports any missed errors and processes due queued work; each invocation dispatches up to five notifications. Existing manual error import and dispatch remain available.
- Notifications and ticket changes commit together. Workers claim records before making provider requests. Email retry uses Resend idempotency keys and exponential backoff, with six attempts maximum. Ambiguous email outcomes stop retrying before the provider's 24-hour idempotency window expires and require provider review. Definite rejections (such as rate limits) can retry on the daily run; in quiet periods that may mean waiting until the next day. SMS with an ambiguous response is marked `uncertain` for operator investigation, not automatically retried.
- The dashboard displays configuration, queue totals and recent attempts. `accepted` means accepted by the provider, **not delivered to the recipient**. Delivery receipts, bounce/complaint webhooks, inbound email/SMS and customer SMS verification/preferences are not implemented. Twilio currently serves staff incident alerts only.

## 1. Durable storage

Set `ZIK_SUPPORT_DATABASE_URL` to a TLS Postgres connection URL, preferably the provider's pooled URL. Provision a separate database for preview/testing. Run `scripts/sql/support.sql` with a migration credential before deploying; the runtime role needs only SELECT/UPDATE on `zik_support_state`. Do not expose this URL to client bundles.

This adapter stores the existing help-desk document in one Postgres JSONB row and uses `SELECT ... FOR UPDATE` to serialize transactions across instances. It preserves current semantics but is intended for modest support volumes, not high-throughput telemetry. Monitor document size and transaction latency; move to normalized tables for larger workloads. Enable managed backups and test restoration.

Local development still supports `data/support-store.json`. On Vercel, filesystem support storage is rejected even if the legacy durable-filesystem flag is set. The database only covers support state and error reports; other application modules may still use their existing filesystem storage.

Existing file-backed support data is **not automatically migrated**. Back it up and import it into the singleton row during a maintenance window before switching an existing installation. Revoke old sessions during migration, verify ticket counts and test a saved customer link. Never overwrite an initialized database with an empty state.

## 2. Staff access

Keep the existing `ZIK_ADMIN_USERNAME` / `ZIK_ADMIN_PASSWORD_HASH` for the owner, or set `ZIK_STAFF_ACCOUNTS` to a JSON array of objects containing `username`, `passwordHash` and `role`. When present, the array replaces the owner configuration. Invalid JSON, duplicate usernames, invalid hashes and unsupported roles fail closed.

Use the existing `hashAdminPassword` helper / `npm run admin:setup` workflow to generate scrypt hashes; only hashes belong in Vercel configuration. Give each staff member a unique account. Roles are `admin`, `support`, `engineer`. Do not give customer or affiliate credentials a staff role. This release uses password authentication, not staff SSO/MFA.

## 3. Resend and DNS

1. Add a sending subdomain you own to Resend (for example, `notify.your-domain`). Use the real domain, not this example.
2. Add exactly the SPF/DKIM and other sending records shown by Resend at the **authoritative DNS host**. That may be Vercel or another registrar/provider. Preserve existing MX records for inbound mail. Do not invent record values or replace an existing SPF policy with a second conflicting one.
3. Wait until Resend reports the domain verified. Create a sending API key scoped to the sending domain.
4. Save `RESEND_API_KEY`, `ZIK_SUPPORT_FROM_EMAIL` (plain address on that domain), and `ZIK_SUPPORT_STAFF_EMAIL` in Vercel's server-side environment variables. The from address must match the verified domain.

Reference: [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## 4. Twilio

Create a Messaging Service and add an SMS-capable sender to its sender pool. Complete sender registration required for the sender/destination countries in Twilio. Trial accounts may restrict destinations to verified numbers. Confirm the staff recipient agrees to incident SMS.

Save `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` and `ZIK_SUPPORT_STAFF_PHONE` (E.164, starting with `+`) in Vercel. Leave the phone blank to disable staff SMS. The integration uses Programmable Messaging, not Twilio Verify or SendGrid; SMS setup does not require Resend's DNS records. Use separate preview/test credentials and recipients.

Reference: [Messaging Services](https://www.twilio.com/docs/messaging/services), [Message API](https://www.twilio.com/docs/messaging/api/message-resource).

## 5. Vercel deployment and scheduler

`vercel.json` schedules `/api/cron/support` once daily at 08:00 UTC, compatible with Vercel Hobby. On Hobby, execution may occur within the scheduled hour. This is 08:00–09:00 UK time in winter and 09:00–10:00 in summer. Event-triggered notifications do not wait for this schedule: they run after the response using Next.js `after()`. The durable queue remains the fallback if background work is interrupted. A busy backlog may need manual processing because each run is bounded to five messages.

Set `CRON_SECRET` to at least 32 cryptographically random characters. Vercel includes it in the worker's bearer authorization header. An external scheduler must do the same. Never put the secret in the URL. The route fails closed if it is absent or too short. Provider calls are bounded to ten seconds and a worker handles at most five messages; adjust throughput through a separate durable worker if the queue grows.

Keep `ZIK_SUPPORT_NOTIFICATIONS_ENABLED=false` during setup. Select the intended Production/Preview environment for each variable and redeploy after changes. Enable notifications only after DNS/provider verification and testing. With notifications paused, new events do not queue; existing queued messages remain until resumed or retained out. Error ingestion still runs while notification delivery is paused.

Reference: [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Vercel storage guidance](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).

## Acceptance checks before enabling real recipients

1. Initialize a test database and confirm two deployed instances preserve the same ticket, session and queue state.
2. Sign in as support/engineer; verify ticket/bug access works, retention/manual dispatch fails. Confirm customer/affiliate/clerk credentials fail staff authorization.
3. Create an opted-in ticket using a controlled inbox; run the worker with an admin or cron credential. Check the staff email in Resend.
4. Post an internal note: no customer email. Post a public reply twice using the same request ID: one queued customer alert. Confirm the customer reads it using their saved private link.
5. Create a privacy test ticket with a consenting test phone configured; verify one Twilio message and inspect provider delivery status.
6. Simulate provider failures in tests, verify pending/failed/uncertain states, and check actual provider history before any manual resend of uncertain SMS.
7. Report the same error twice; background import groups occurrences into one bug. Resolve it with fix/verification evidence, report it again and confirm recurrence reopens it.
8. Check Vercel cron invocation logs and drain rate, then enable production delivery with the agreed addresses.

Use the dashboard's retention action regularly. It removes notification records after 30 days or when their closed ticket is removed. Errors retain the latest 1,000 reports. Pending/failed messages need operational review; retention is not an automatic resend mechanism.
