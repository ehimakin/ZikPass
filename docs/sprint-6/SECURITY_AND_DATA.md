# Sprint 6 data flow and threat model

Investor demonstration only. No public-reliance approval or certification.

## Boundaries

1. Physical issuance remains the existing store confirmation → device check → payment → signed age credential path. The credential and holder key remain in the existing wallet database. The physical application does not collect name/address/DOB.
2. The separate `zik-local-vault` IndexedDB database stores one `VaultEnvelopeV1`. Legal name, delivery address and optional email are self-entered. PBKDF2-SHA256 and AES-256-GCM execute in the browser. The passphrase is not retained by the session or sent over the network.
3. `/api/demo-merchant/start` is the explicit co-hosted fictional relying-party entry point. It prepares its RSA key and asks the Zik service for a registered request. The Zik service reads only `demo-merchant-public.json`; it never imports the private-key module. An HttpOnly Strict cookie binds redemption to the browser that started the checkout.
4. The browser selects required fields and explicitly selected optional email, encrypts them to that public key and submits the envelope plus the existing signed age presentation to `/api/disclosure/approve`.
5. Zik verifies age through the existing affiliate challenge/code service and stores only the minimum age result, request metadata, ciphertext and a hash of the new one-time redemption code.
6. `/api/demo-merchant/redeem` checks cookie bindings and atomically consumes the response. Only then does the demo merchant unwrap/decrypt. The browser receives the merchant's form-fill values with provenance. No checkout submission is implemented and merchant plaintext is not persisted.

The encrypted request context binds protocol version, request ID, audience, return URI, state, nonce and expiry. Required/optional allowlists are checked before encryption and after decryption. Replay is rejected even when redemption calls overlap. A decryption failure after consumption requires a fresh request; it never falls back to plaintext.

## Inventory

| Data | Device storage | Zik service receives/persists | Demo merchant receives |
|---|---|---|---|
| Passphrase | Input/memory only; never persisted | Never | Never |
| Legal name, address, optional email | Encrypted envelope; plaintext while unlocked | Ciphertext only | Only approved fields, plaintext after decryption |
| `self_entered`, updated timestamp | Inside encrypted field object | Ciphertext only | With each approved field |
| Salt, iterations, IV, schema version | Plaintext envelope header, authenticated | Never receives Vault envelope | Never |
| Disclosure IV, wrapped key, ciphertext | Ephemeral browser memory | Until consumed/reset; expired records pruned on next successful transaction | Once, before decryption |
| Request ID, client, name, return path, purpose, field list, nonce/state, expiry | Ephemeral request; merchant state cookie | Plaintext | Plaintext |
| Age credential, holder public key, signature | Existing wallet | Existing age verification receives full signed presentation; original enrollment state remains | Never in the result |
| Holder private key | Existing wallet only (legacy development fallback remains) | Not sent by disclosure; existing development key fallback is a separate historical risk | Never |
| Age result | UI memory | Minimal verification result | Age over 18, `zik_verified` |
| Redeem code | Ephemeral response, never URL | Only hash stored | Presented with pending cookie |
| IP/timing/browser metadata | Browser/network | Observable to hosting infrastructure | Observable; same origin in demo |
| Internal denial reason | None | Finite reason code only, no raw exception/payload logging | Generic denial text |

No DOB, face, ID image, ID number or biometric field exists in the new profile/disclosure vocabulary. Global HTTP logs must not capture bodies. The test canaries prove tested request bodies and storage contents, not the absence of compromised infrastructure.

## Threats and residuals

| Threat | Control | Residual |
|---|---|---|
| Copied local database | Passphrase KDF, random salt/IV, authenticated encryption | Offline guessing remains possible; use a strong unique passphrase. No hardware-backed guarantee. |
| Device compromise / XSS | Nonce CSP, no third-party scripts, fail-closed parsing, lock when hidden/inactive | Client code must see plaintext to display/share it. Malicious code or extensions can steal it while unlocked. CSP is defence in depth. |
| Zik server compromise | Zik modules receive ciphertext only; private-key import boundary enforced | Co-hosted merchant shares host/process privilege. A host compromise can access merchant key; a malicious Zik web deployment can change client code. This is not infrastructure separation. |
| Malicious merchant | Exact required/optional selection, named registered recipient, default-off email | An authorised merchant can retain/redistribute received data. Consent cannot cryptographically enforce downstream use. |
| Confused deputy / wrong return | Fixed registry, cookie state, exact audience/URI/nonce/expiry checks | Merchant registration/key provisioning must be independently controlled in real deployments. |
| Replay / races | Serialized request redemption transaction and atomic rename, single use | Only one Node process. Multiple instances or shared-file workers are unsupported; use database compare-and-set transactions first. |
| Availability / abuse | 120-second TTL, 100 active request cap, 300 body/read requests per process/minute, 24KB streaming body limit | Global demo limits permit denial of service and are not a distributed abuse defence. |
| Issuer/merchant collusion | Merchant result excludes stable credential identifiers | Zik sees original age credential, holder key, audience and timing. Cookies/IP and co-hosting allow correlation. Not ZKP or anonymity. |
| Disk corruption / unsupported versions | Fail closed, preserve Vault record, commit writes transactionally | No backup/recovery. Unknown Vault versions require a future explicit authenticated migration. |
| Merchant restart/key loss | Separate on-disk private key, no silent replacement on parse/permission error; reset preserves keys | Local file keys are not KMS custody. Losing the merchant key makes pending ciphertext unrecoverable. |

## Operational scope

Existing prototype issuer/store authentication, development device-check fallback, holder-key extraction, credential lifetime/revocation and native handoff limitations from AUDIT.md remain. They are not claims of public identity assurance. Use only fictional demo profiles. The new v1 feature defaults off and must be explicitly enabled. It does not introduce a public merchant token API; demo merchant redemption is co-hosted. Deploy only as a single-process controlled demonstration.

A nonce CSP forces dynamic page rendering. Development permits eval for Next tooling; production does not. Inline styles are allowed for the established UI. Geolocation is self-only; camera/microphone/framing are denied. New sensitive routes are no-store and excluded from the service worker. Native Vault parity, cloud sync and recovery are not implemented.
