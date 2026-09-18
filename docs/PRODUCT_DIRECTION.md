# Zik product direction

Product source of truth, agreed positioning milestone — 15 September 2026.
Implementation facts remain in [ARCHITECTURE.md](ARCHITECTURE.md).

## Umbrella and product ladder

Zik is the umbrella platform. It separates verifying information from disclosing it.
The repository implements Zik Pass, the first Zik product. Zik Pass → ZikVault → Zik ID
is a progression in what a person can choose to prove, not a dependency for using Pass.

| Product | Canonical distinction | Commercial model | Product status |
| --- | --- | --- | --- |
| Zik Pass | One thing about me that I can prove without identifying myself. | £1.99 one-off; not a subscription | Available now in the prototype |
| ZikVault | What I can prove. | Planned £0.99/month | Working on the device; membership not a real product |
| Zik ID | Who I am when identity is genuinely required. | Planned £2.99 one-off | Application only; cannot be issued |

ZikVault works in this prototype: documents chosen by the user are stored encrypted on
the device and read there to suggest details the user reviews. Nothing it reads is a
check that a document is genuine, and nothing in a Vault is labelled verified. Zik ID
can be applied for and the application saved; it cannot be issued, because the identity
checks and the issuer do not exist yet — see
[ZIK_ID_ONBOARDING_DEPENDENCIES.md](ZIK_ID_ONBOARDING_DEPENDENCIES.md).
“Available now” for Pass means the working prototype journey; payments remain demo-only.
Planned prices cannot currently be charged. Pass purchase amounts remain server-authoritative
in `lib/shared/payment-config.ts` and the existing payment services, including configured
free flows and store overrides. Display configuration never determines a payment amount.

## Zik Pass: standalone minimal age credential

Prove you’re 18+ online without sharing your identity. A participating site receives
the minimum age assertion and verification metadata, not the person's name, exact date
of birth, photograph, address or identity document. A user must never need ZikVault or
a subscription to obtain or use Pass. This milestone changes neither expiry nor renewal.

## ZikVault: local-first proof-backed credentials

The Vault is a device-held pool of documents and the claims they support, from sources
such as a passport, driving licence, utility bill, address evidence, or a student or
professional credential. Documents live on the user's device, not in a central Zik
identity-document database, and are read on the device rather than by Zik or an AI
provider.

Today the Vault holds documents, extractions, user-reviewed claims and consents — not
verified credentials. An extraction the user has confirmed means Zik read the text
correctly; it is not an authenticity or holder check, and the interface never calls it
one. Proof-backed credentials require the issuance path described in
[ZIK_ID_ONBOARDING_DEPENDENCIES.md](ZIK_ID_ONBOARDING_DEPENDENCIES.md). Self-entered
profile fields are not verified credentials either.

Local-first does not mean “Zik stores no data”. Operational server data may include public
keys, revocation/status data, issuer metadata, fraud signals and audit events. A separate
security/data architecture decision is required before implementing the agreed Vault,
including key custody, retention, verification, consent, backup and recovery boundaries.
No claim is made that a production native document vault exists or is currently secure.

## Zik ID: a presentation of Vault claims

Zik ID is a ready-made identity assembled from sufficient verified information already in
ZikVault. It is a predefined presentation/preset, not a separate identity database or an
independent profile. It could combine verified name, photograph, age and identity-document
status. Once enough verified information exists, a future in-app promotion could offer it.
Eligibility rules remain undecided; this milestone implements none. Zik ID is not currently
accepted as physical identification.

## Verifying and disclosing are separate actions

Checking evidence establishes a claim; disclosure determines which claims a recipient sees.
An illustrative future car-hire request could share legal name, over-25 status and valid
driving entitlement while withholding exact DOB and home address. This is not a working
form, a legal acceptance claim or a guarantee that every car-hire provider needs the same
information. Today an 18+ site gets only the age assertion and verification metadata.

## Device binding and the physical card

- Device binding: underlying security mechanism, not the product proposition. Binding a
  holder key to a pass does not make the pass an identity profile or require identity disclosure.
- Physical Zik card: future continuity/enrolment/recovery root of trust. This direction is
  distinct from today's clerk-first purchase-card activation. Recovery trust, replacement,
  loss and abuse policies need separate design; this milestone adds no recovery capability.

## Existing experiments and current implementation boundary

This checkout already contains experimental Vault/disclosure and Zik ID logic:
`/vault`, `/retail-demo`, `/id`, `/verify/id`, Vault IndexedDB/encryption helpers,
disclosure services and Zik ID session/peer code. The owner requested preservation of that
work. It is not implementation of the agreed proof-backed product ladder and must not be
used as evidence that planned products are available. Sprint 6 documentation describes
those experiments; it does not supersede this product direction. The new customer product
links lead only to `/ecosystem`; experimental code and direct routes are retained.

This is a product-positioning/documentation milestone, not a Vault implementation sprint.
It adds no storage, encryption, document import/upload, OCR, verification, subscription,
backup/recovery, eligibility calculation, biometric check, purchase or ID issuance logic.
It adds no speculative API routes, domain types or database schemas. Credential formats,
age verification, payment/issuance state machines, physical-card flow, wallet and affiliate
verification remain unchanged. Any expansion of experimental logic needs concrete behavior
agreed separately from this display milestone.

## Language and presentation

Use “participating sites” or “18+ sites”. Prefer “designed to live on your device”. Do not
claim zero-knowledge proofs, zero server data, invulnerable documents, production native
Vault storage, accepted physical ID or chargeable planned prices. Keep Pass current and
actionable in the hero; future products appear below its explanation, in the read-only
ecosystem page and beneath active-pass controls. No new bottom-navigation tabs.
