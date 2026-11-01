# Consumer Live MVP sprint

## Product correction (supersedes the initial routing decisions below)

- Digital Zik Pass: 99p one-off, free during Early Access. In-person verification through `/get-pass`; not a finance check.
- Physical Zik Card: £2.99, kept for life. Its till-sale price is independent of the digital promotion.
- Zik Vault: 35p/month; Zik VaultCloud: 99p/month. Billing remains unconnected.
- Zik ID: £1.99 one-off.
- Zik Validate: from £5.99, dependent on the document.
- Zik Pass via Finance Check: separate future £3.99 remote route. Stripe, Apple Pay and Google Pay are preview options, not wired up.

The original sprint incorrectly merged digital acquisition with finance and advertised free Vault access. Those decisions are corrected. The finance wallet preview is explicitly separate and cannot suppress digital acquisition.


## Audit and decisions

The existing visual identity, cinematic hero, animated Vault, bottom navigation,
signed credential storage, clerk verification, affiliate handshake, support and
recovery logic remain the foundation. No new framework or payment dependency.

| Surface | Finding and change |
| --- | --- |
| Home / navigation | Conflicting acquisition destinations and long explanations. Keep artwork and motion; shorten copy, point digital acquisition to in-person setup; finance remains a separate future route. |
| Finance / get-pass | Keep `/get-pass` on in-person onboarding. The separate future finance preview has consent, payment sheet, check, timed pending state and a labelled wallet preview. |
| Wallet / pass | Preserve signed credentials and their verification logic. Display finance previews separately; keep digital acquisition available even when a finance preview exists. |
| Physical card / shop | Remove invented online checkout and shipment state. Direct customers to store purchase and existing pairing/activation routes. |
| Find | All catalogue entries are explicitly fictional. Do not publish invented addresses or hours as partners; show a neutral launch state. Existing fixtures remain for staff/test flows. |
| Partner / vendor | Preserve authenticated clerk and website integration tools. Add a partner contact path; remove logo decoration not backed by an acceptance directory. |
| Vault / guide | Preserve encryption, document reading and safe animation. Remove dummy billing; show 35p/month Vault and 99p/month VaultCloud, with unconnected Apple-managed billing in disclosure. Correct stale guide claiming storage is unavailable. |
| ID / Validate / ecosystem | Distinguish Coming Soon. Put the existing fictional validation workflow behind an explicit sample disclosure. Retain ecosystem security detail in expandable content. |
| Help / policy / recovery | Keep support, privacy and recovery protections. Remove consumer reset control and update acquisition guidance. |
| Legacy / staff / demos | Preserve standalone regression and operator routes. Use the existing in-person onboarding for digital passes; keep unrelated demo routes outside the primary journey. |
| Development overlay | Opt-in with `ZIK_VISUAL_EDITOR=true`; it previously intercepted mobile payment taps. |

## Integration boundaries

`lib/client/finance-check.ts` is the replaceable finance gateway interface.
The current implementation stores **preview progress only**, separately from the
IndexedDB signed credential wallet. It never calls payment, credit-reference or
issuance APIs and cannot provide proof to a partner. The 30-second pending window
is explicitly a shortened preview, not a live cooling-off policy. Reloads resume
it; repeated checkout returns the same record. Storage failures are recoverable.

The live adapter still requires server-side payment authority, provider consent,
identity/age decisions, declines/review, real cooling-off rules and signed issuance.
Do not turn the local preview into a signed credential or use client timestamps
as production authority. Provider failure currently means a save/checkout error;
no consumer control can select an age-check result.

Vault subscriptions are not sold by this web build. Preview setup preserves existing
encryption without claiming the subscription is free. Paid iOS plans should use StoreKit's native product, purchase, restore
and management surfaces once product IDs and entitlements exist; no custom Zik
billing or fictitious successful subscription is exposed.

## Launch dependencies

- Confirmed store directory, stock, opening hours and prices.
- Activated website partners; no invented network size or partner brands.
- Finance provider, consent/privacy terms, assurance review and authoritative issuance.
- Live payment provider and refund/cancellation policy.
- StoreKit products and native subscription integration if Vault becomes paid.

## Verification

- New adapter tests cover persistence, repeat checkout, cooling-off and malformed records.
- Mobile browser tests cover payment, reload, pending-to-approved wallet, store-first cards and route width.
- Existing unit/integration suite and production build are run separately.

Validation results: 319 tests passed in the full sandboxed run; the remaining
local SMTP test passed when rerun with loopback-server permissions (320 total).
The initial three mobile tests passed; final coverage also checks ID and Validate
and rejects browser runtime errors. Existing legacy image/ref lint warnings remain.

Final production build completed successfully. Three production mobile browser
tests passed across acquisition, wallet, cards, home, Vault, ecosystem, help,
ID and Validate, including a zero-runtime-error assertion. A final payment-sheet
callback stabilization prevents its one-second timer from stealing keyboard focus;
TypeScript and a dedicated browser focus/Escape test cover that adjustment.
