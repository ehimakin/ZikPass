# Product 7 — Zik Pass via finance check

Review date: 20 September 2026. Scope: UK online 18+ assurance, proposed £3.99 one-off remote route at `/prove-with-finance-check`.

## Decision

Proceed with the prototype. Production legality and suitability are conditional, not established by this review. Credit-reference evidence may support age assurance; a soft-search label or evidence that an adult credit file exists does not establish that its owner is the applicant. Do not issue a production credential or advertise this route as Ofcom-approved or universally accepted until the provider, implementation and intended uses are assessed. This is preliminary product research, not a legal opinion on an implemented service.

The £3.99 price is a commercial proposal. Charging more cannot remedy weaker evidence or lower an applicable assurance standard. Position this as a remote alternative, not a higher-assurance product. A financial-history match is also different from a credit-card check or open-banking authentication.

## Regulatory findings

Ofcom uses a technology-neutral, non-exhaustive approach. Its examples of methods capable of highly effective age assurance include credit-card checks, open banking and digital identity services; its list does not expressly approve a generic soft credit-history lookup. The full process must satisfy technical accuracy, robustness, reliability and fairness. Relevant regulated services must assess their own duties. A reusable signed certificate preserves a claim; signing it does not strengthen its underlying evidence. This last conclusion is our technical/product inference, not a regulator’s approval or prohibition of this specific design.

Source: [Ofcom age assurance duties](https://www.ofcom.org.uk/online-safety/protecting-children/age-assurance), updated 2 September 2026.

Assess provider evidence, circumvention resistance, identity binding, and the full issuance and reuse journey. Ask how performance was tested, what populations it covers, how failures are handled and what independent assurance exists. A borrowed adult’s name, date of birth and address must not suffice to obtain a usable certificate.

Source: [Ofcom vendor due diligence](https://www.ofcom.org.uk/online-safety/protecting-children/vet-your-vendor).

UK data protection requirements apply to identity data used for age assurance. Establish controller/processor roles and lawful basis; provide clear notices; limit collection, onward disclosure and retention; protect records; and provide a way to challenge errors. Complete an early DPIA and determine whether it is mandatory. Prefer an age-threshold response plus necessary verification metadata over retaining full credit files. ICO’s age-assurance opinion is under review following the Data (Use and Access) Act; confirm current automated-decision requirements with counsel before launch rather than relying on its older Article 22 wording.

Source: [ICO age-assurance expectations](https://ico.org.uk/about-the-ico/what-we-do/information-commissioners-opinions/age-assurance-for-the-children-s-code/6-expectations-for-age-assurance-and-data-protection-compliance/).

Experian describes soft searches as including identity checks and explains that they do not affect credit scores. This describes the search type, not Zik’s eligibility for data access, a supplier agreement, or proof of HEAA compliance. Confirm the actual provider’s permitted purpose, footprint and customer notice before making an unconditional promise.

Source: [Experian soft and hard searches](https://www.experian.co.uk/consumer/guides/searches-and-credit-checks.html).

## Production gates

1. Select a contracted provider that permits age/identity verification using its data. Confirm access rights, processing roles, sub-processors, retention and any applicable regulatory perimeter with UK counsel. This review does not determine whether a particular business model needs FCA permissions.
2. Specify authoritative age evidence and applicant authentication. Test borrowed/stolen identities, household knowledge, replay, account/device sharing and recovery. A bare name/DOB/address match is insufficient for this proposed design.
3. Obtain measured assurance evidence for the intended deployment, including false acceptance of children and adult exclusion. Do not use creditworthiness as an age criterion. Treat thin/no files and mismatches as unconfirmed, not under 18.
4. Complete data-protection documentation and a usable review/alternative route. Confirm lawful basis independently of the UI authorisation checkbox.
5. Define distinct verification-method metadata and relying-party acceptance policy. Do not silently make this route interchangeable with existing in-person assurance. Secure issuance, device binding, expiry, revocation and recovery all need assessment.
6. Agree price, payment timing, service terms, failure/refund treatment and applicable consumer cancellation rights before taking money. Prototype assumption: request payment only after a successful check; no subscription.
7. Obtain UK legal review for each target use. An online age assertion is not a physical photo-ID scheme accreditation, universal identity proof or automatic approval for gambling, alcohol sales or other separately regulated uses.

## Prototype boundary

The route is public and linked from the shared product catalogue (homepage and ecosystem). It demonstrates authorisation and three synthetic provider responses. It collects no identity fields, calls no credit provider/payment/issuance endpoints, persists no new state and creates no usable credential. No supplier is implied to be integrated. Existing pass pricing and issuance remain untouched.

## Bundle decision — 20 September 2026

The user confirmed that £3.99 covers the finance check, ZikVault and passport verification. The bundle has no separate local-Vault subscription or passport-check charge. Standalone Vault pricing is unchanged; optional cloud backup is separate.

Planned behaviour: adding a passport scan to Vault starts an included remote-verification step, with the provider, purpose and shared data disclosed before authorised transmission. This changes the future data flow: remote verification requires access to the selected scan, unlike on-device reading or an encrypted recovery backup. Update privacy notices and the DPIA before connecting that service.

Keep document authenticity and holder binding as separate results. A passport upload, OCR extraction or authenticity result alone must not mark a person verified or cause age-credential issuance. Define states for stored/unverified, awaiting authorisation, checking, document checked, holder checked, inconclusive and failed. These are proposed states, not implemented provider integration.

The £3.99 entitlement must cover all three components. Supplier pricing, repeat uploads/replacements, retries and abuse controls still need a costed policy; do not silently add per-passport charges or promise unlimited supplier calls. Passport verification is available when a scan is added, not a retrospective cure for insufficient evidence at initial pass issuance.
