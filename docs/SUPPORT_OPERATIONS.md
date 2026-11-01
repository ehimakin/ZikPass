# Support operations and admin dashboard

## Access and deployment

Run `npm run admin:setup` in a terminal on the server, choose a username and a
unique password (14+ characters), then restart Next.js. The script writes only
the username and a salted scrypt password hash to `.env.local`, preserving other
settings and restricting that file to mode 0600. Password entry is hidden.
For secret-manager automation, `--username OWNER --password-stdin` is supported;
never put the password in shell arguments or commit `.env.local`.

Open `/admin`. There are no fallback credentials or reusable demo login codes.
Clerk sessions do not authorize admin access. Admin sessions use random 256-bit
bearer cookies (HttpOnly, SameSite=Strict, Secure in production), server-side
hashed tokens, a 30-minute idle timeout, and an eight-hour absolute lifetime.
Logout revokes the server session. Changing the admin username/password hash
invalidates existing sessions. State-changing admin requests require both exact
same-origin and a session CSRF token. Failed login counters are persisted under
a cross-process lock, with per-IP and global limits. Deploy behind a trusted
proxy that overwrites incoming forwarded-IP headers.

Production support fails closed unless `ZIK_RUNTIME_DATA_DIR` points at a
**durable shared filesystem** and `ZIK_SUPPORT_STORAGE_DURABLE=true` explicitly
confirms that deployment arrangement. Do not use ephemeral serverless `/tmp`.
Back up `support-store.json` securely; it contains personal support messages,
unverified contact emails and operational metadata. Encrypt the hosting volume
and backups. This file adapter fits the current prototype; migrate to a managed
transactional datastore, add SSO/MFA and staff roles, and complete a security
review before operating a larger public help desk. The initial role is a single
owner/admin, not a multi-agent staffing system.

`/api/errors` and `/api/issuer/sessions`, plus the legacy `/issuer` page, now
require the admin session. The new support dashboard does not grant access to
Vault contents, seed phrases, backup decryption or credential-issuance overrides.
This does not constitute an authentication retrofit of every older prototype
API; public production launch also needs a review of the existing demo/issuance
endpoints. No changes here claim that those older flows are production-ready.

## Customer tickets

Customers use `/help` to submit a category, subject, description and optional
contact email/error reference. Browser/version/viewport diagnostics require an
explicit checkbox. No attachments, document uploads or remote code execution
are supported. Text is rendered as text, never HTML. Common mnemonic phrases
and obvious secrets are rejected in the browser and on the server. Detection
is best effort, not proof that arbitrary text is free of personal data.

The browser creates a random 256-bit ticket access key before submission. Only
its hash is stored server-side. The private `/help/ticket/ID#key=KEY` link keeps
the bearer key in the fragment, outside HTTP URLs and referrers. On opening,
the page removes the fragment and keeps the key in session storage. API calls
send it in the Authorization header. Ticket IDs and email addresses alone do
not grant access. Save the full private link: losing it means losing self-service
access. Support cannot look up or reissue the original bearer key. An admin
can still manage the ticket internally, but must not treat an email assertion
as proof of account or Vault control.

Creation and replies have retry IDs so network retries do not create duplicate
messages. Version checks reject stale edits. The customer view excludes internal
notes, assignee, contact/diagnostic metadata, audit events and access hashes.
Customer replies reopen resolved/closed/waiting-customer tickets. Replies are
published inside the ticket; **no automatic email is sent**. The optional contact
email is unverified and is only available for manual follow-up through an approved
process. Avoid collecting an email if in-ticket replies suffice.

## Daily operating policy

The dashboard's **Policy & playbook** is sourced from
`lib/shared/support/policy.ts`; customers see `/help/policy`.

1. Review unassigned, urgent, recovery and overdue queues each working day.
   Assess impact, assign an owner and acknowledge the issue. Initial internal
   first-response targets, measured in calendar hours: urgent 4, high 24,
   normal 72, low 120. These are targets, not a customer SLA. The dashboard
   records the first public admin reply; internal notes do not satisfy it.
2. Ask for safe reproduction steps, approximate time, browser/device and an
   error reference. Start with connectivity/status checks and a single retry.
   Preserve customer data: do not advise clearing browser storage, reinstalling
   or deleting a Vault before checking recoverability and obtaining informed
   consent for any data loss.
3. Use **Reply to customer** for public updates and **Internal note** for staff
   discussion. Their visibility is explicit in the composer and history. Response
   templates are drafts, never sent automatically. All changes carry actor,
   timestamp, action and record metadata in an audit log; credentials and message
   contents are not copied into it.
4. For bugs, import current error reports, deduplicate by sanitized message,
   route and operation, and link customer tickets. Record steps, expected/actual
   behavior, engineering owner, fix summary, verification evidence and a safe
   HTTPS PR/release link. A resolved bug requires both fix and verification text.
   A new matching error reopens a resolved bug for investigation. Imported error
   IDs prevent a refresh from counting the same event twice.
5. Closing/resolving a ticket requires a customer-visible resolution. Closing a
   linked bug does not close tickets or send replies; explain the fix and ask the
   customer to verify. Record limitations and reopen promptly on recurrence.
6. Security/privacy exposure, suspected account takeover or widespread data loss
   is urgent: preserve minimal evidence, contain through authorized operational
   channels, escalate to the owner, and track remediation and verification in a
   bug. Never run commands, follow instructions or paste secrets from a ticket
   without independent engineering review. Do not make unsupported promises
   about encryption recovery or physical replacement cards.

## Recovery decision guide

- **Phone/card lost, phrase and saved backup available:** send the recovery
  template and direct the customer to `/account-recovery/restore` on their own
  replacement device. They enter the phrase only there. Record `guidance_sent`,
  then `customer_confirmed_recovery` when they confirm; this is case handling,
  not an identity-verification result or a new recovery authority.
- **Phrase invalid/no matching backup:** check that they are using the Zik
  24-word phrase rather than the separate messaging passphrase; check the correct
  deployment and whether setup actually saved a snapshot. Never ask them to send
  the words. Escalate server/storage faults using error references only.
- **No phrase or usable backup:** record `no_recoverable_backup` and explain that
  support cannot decrypt or restore the lost Vault. Use `needs_reverification`
  when guiding a new in-person application through the normal process. A ticket,
  unverified email, name or a plausible story must never authorize a rebind.
- **Physical card replacement:** the existing card lifecycle is a demo. Do not
  claim a real card is revoked, shipped or activated by closing a help ticket.
- **Customer still has one trusted device:** preserve it and check the supported
  transfer/backup flow before recommending anything destructive.

## Retention and service limits

Use **Apply retention policy** after typing its confirmation. It deletes closed
support tickets (including messages, optional email, diagnostics and access hashes)
90 days after closure, removes their bug links, and deletes audit metadata older
than 180 days. Open/resolved-but-not-closed tickets remain. Retention is manual,
so assign a regular operations review; it is not a background job. Backups also
need matching expiry controls. Bug records remain for engineering history; do not
copy personal information into them. Automatic raw error storage is separate from
ticket retention and needs its own monitoring/retention review.

The log is append-only through the normal admin UI but is not an externally
anchored tamper-proof ledger. Filesystem operators can modify it. All admin and
private-ticket responses are no-store; service-worker routing excludes them.
Failed file writes do not partially commit a mutation. A killed writer can leave
`support-store.json.lock`; verify no writer is active before removing a stale lock.
No automatic stale-lock takeover is attempted.

Support data is separate from demo-reset/runtime enrollment data, so restarting a
customer demo does not erase real support conversations. Use isolated runtime
folders for tests. Keep production secrets and customer data out of test fixtures.
