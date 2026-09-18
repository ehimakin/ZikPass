# Zik ID — what the owner must specify

The Vault pipeline and the application-preparation milestone are finished and do not
depend on any of this. What follows is what Zik must decide before a Zik ID can
actually be issued to anyone.

Today the furthest a person can get is a saved application in state
`pending_onboarding`. Nothing is sent anywhere, nothing is approved, and no ID
exists. `pendingOnboardingAdapter` in `lib/shared/onboarding/adapter.ts` refuses
every outcome, including a well-formed one, because no issuer is authorised yet.

## 1. Authorised checker and checks

Who performs the identity check, under what authority, and what do they actually
check? The prototype readiness policy asks only whether the *evidence is prepared* —
a forged document that reads cleanly satisfies it exactly as a genuine one would.
Someone has to decide what makes evidence genuine, and who is permitted to say so.

Needed: the checker, their legal basis, the check types (document authenticity,
issuer confirmation, database checks), and the assurance level being targeted.
[GPG 45](https://www.gov.uk/government/publications/how-to-check-someones-identity-1-0/how-to-check-someones-identity-1-0-pre-release)
separates evidence strength, validity and holder verification; the codebase keeps
them separate too, so a decision can be dropped into each.

## 2. Portrait acquisition and use

Is there a portrait at all, where does it come from, and who sees it?

This sprint added no mandatory selfie and no remote upload. The existing "designated
selfie" in the legacy Zik ID demo is **not** a verified portrait — it is a file the
user chose — and it is deliberately isolated from readiness and approval. If a
portrait becomes part of Zik ID, Zik must decide whether it is captured live, whether
it leaves the device, who compares it to a document, and how the central privacy
promise — that a face is not uploaded to Zik or an AI provider — survives that.

## 3. Holder binding and recovery

What cryptographically ties an issued ID to this person and this device, and what
happens when the device is lost?

The adapter contract already carries `holder_key_thumbprint` and expects an
issuer-authenticated outcome bound to the application, claim set and evidence
snapshot. It currently passes the placeholder `device-local`, because there is no
holder key ceremony yet. Needed: how the holder key is generated and attested, how a
new device is bound, and what recovery looks like given the Vault has no export.

## 4. Issuer authority

Which key signs a Zik ID, held where, under what custody and rotation policy?

A mutable local flag must never confer issuance. The contract is built so that an
outcome is accepted only after verifying an issuer signature bound to the specific
application; that verification cannot be written until the issuer exists.

## 5. Acceptance partners

Who accepts a Zik ID, for what, and what does the verifier check?

Nothing in this sprint delivers acceptance. Note also that the existing WebRTC
presentation path uses no ICE servers, so it works on a controlled same-device or
local-network demonstration and should not be described as working across arbitrary
networks. Bar, club and online acceptance, and trust-framework certification, are
separate milestones.

## 6. Approval, expiry and revocation

How long is an ID valid, what expires it, what revokes it, and how does a verifier
learn that it was revoked? Also: what happens to an issued ID when the underlying
claims change — the code already marks an application `stale` when its evidence or
claims move on, and the same question applies after issuance.

## 7. Commercial

The £2.99 Zik ID and £0.99/month Vault prices are display-only. There is no payment,
entitlement or subscription integration behind either, and the Vault signup runs a
clearly labelled preview checkout that collects nothing and charges nothing.
