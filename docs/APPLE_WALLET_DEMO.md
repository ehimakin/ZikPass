# Apple Wallet demo pass

The “Add to Apple Wallet” action lives directly on `/wallet` for Zik Card and
on `/pass` alongside an issued Zik Pass. There is no separate Apple Wallet page.
`GET /api/wallet/apple/demo` generates a signed `.pkpass` in memory once configured.
Before configuration it returns HTTP 503 and the buttons are disabled with an availability message.
It is disabled in `ZIK_ENV=live` and requires an explicit enable flag.

## Current scope

The pass contains static Zik demo content and one shared demo serial number. It does
not read the browser Wallet, personal fields, custom card labels, credentials,
checkout records or recovery records. It carries no barcode, NFC entitlement,
location triggers, registration endpoint, update service or analytics. It is not
proof of age or identity and does not activate a physical card. Its contents do not
change after installation. The issuer identifiers and signing certificate are part
of the signed package, as required by Apple.

No Apple account or real certificate has been accessed or created as part of this
implementation. Account setup, certificate access and any deployment must be
separately approved under the owner's standing data-handling instruction. Do not
paste signing keys, passwords or account details into a task message.

## Prerequisites for installation on an actual iPhone

Apple Wallet requires a valid Apple-issued Pass Type ID signing certificate and its
matching private key; a synthetic test certificate cannot be installed. An Apple
Developer Program account with access to Certificates, Identifiers & Profiles is
needed to obtain the certificate.

After approval, in Apple's developer portal:

1. Register a Pass Type ID for the Zik demo.
2. Create a Pass Type ID certificate using a certificate signing request. Keep the
   corresponding private key locally; do not upload that key to Apple.
3. Obtain the Apple WWDR intermediate matching the signing certificate's issuer.
4. Supply the certificate, private key and intermediate as PEM, base64 encoded,
   using server-only environment settings in an ignored local environment file
   or approved deployment secret store. Do not use `NEXT_PUBLIC_` variables.

Configuration keys (empty placeholders are in `.env.example`):

- `ZIK_APPLE_WALLET_DEMO_ENABLED=true`
- `ZIK_APPLE_PASS_TYPE_ID`: exactly the Pass Type ID in the certificate
- `ZIK_APPLE_TEAM_ID`: exactly the issuing developer team identifier
- `ZIK_APPLE_SIGNER_CERT_BASE64`: base64 of the PEM signing certificate
- `ZIK_APPLE_SIGNER_KEY_BASE64`: base64 of its matching PEM private key
- `ZIK_APPLE_WWDR_CERT_BASE64`: base64 of the PEM intermediate certificate
- `ZIK_APPLE_SIGNER_KEY_PASSPHRASE`: only if the key is encrypted

Keep `ZIK_ENV=demo` or `test`. Restart the app after configuration.
PEM encoding is required; base64 of a `.p12` or DER `.cer` is not equivalent.
Never put signing files under `public/`. `.secrets/` and common signing-file
extensions are ignored by Git as an additional safeguard.

## Install

Use an approved address reachable from the iPhone; `localhost` on the iPhone does
not refer to the development computer. Open `/wallet` or your issued pass on `/pass` in Safari and select
“Add to Apple Wallet”, then confirm Add in Apple's sheet. Alternatively,
transfer the downloaded signed `zik-demo.pkpass` to the iPhone using AirDrop.
No native app or App Store release is required. Creating a public deployment is a
separate action; once enabled, this endpoint serves the same generic demo pass to
anyone who can reach it. Do not enable on a public deployment until that is intended.

The pages check that settings exist, not that Apple accepts the certificate chain.
A signing failure returns a generic 503 response. If Wallet rejects a successfully
downloaded package, check certificate expiry, the matching private key, WWDR
intermediate and exact Team/Pass Type IDs. Never upload the package or signing
material to a third-party pass validator without explicit approval.

## Validation

`npx vitest run tests/apple-wallet.test.ts` creates a temporary synthetic test key
and certificate, checks the ZIP contents and manifest hashes, and verifies the
PKCS#7 signature locally with OpenSSL. It tests disabled and malformed signing
configuration too. It needs `openssl` and `unzip`. These tests prove package and
signature construction, not Apple trust or installation on an actual device.

The account/certificate setup and real-iPhone acceptance check remain outstanding.
Google Wallet is not implemented in this Apple-first slice.

## Official references

- https://developer.apple.com/wallet/get-started/
- https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates
- https://developer.apple.com/documentation/walletpasses/building-a-pass
- https://developer.apple.com/documentation/walletpasses/distributing-and-updating-a-pass
