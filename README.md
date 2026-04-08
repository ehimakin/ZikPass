# Zik Pass

Zik Pass is a privacy-first, zero-knowledge-inspired age verification prototype. The current sprint demonstrates a consumer-friendly journey: a new user answers a few simple questions, receives a signed Over-18 credential, waits through a cooling-off period, and then uses that credential at a dummy betting-style vendor that verifies it locally without learning identity details.

## Current sprint scope

- Issuer/admin surface for monitoring proof intake, possession simulation, cooling-off state, notification logging, and credential issuance
- User wallet surface with a `Get Zik Pass` button that launches a single-question full-screen card flow
- Credential delivery immediately after possession confirmation, followed by a visible cooling-off period before use
- Dummy betting vendor surface with a single `Verify with Zik Pass` action and fully local signature, activation, and claim verification
- Shared TypeScript modules for proof capture, proof evaluation, possession verification, credential issuance, wallet handling, crypto, and verifier logic
- JSON-backed prototype persistence in [`data/state.json`](/Users/ehim/dev/ZikPass/data/state.json)

## Trust model

Zik Pass issues a credential only when all of the following are true:

1. The mocked credit adulthood proof passes the configured rule.
2. The user completes the refund-reference possession check.
3. The wallet generated a local holder keypair that is bound into the credential.

After issuance, the credential includes an activation time. Vendors deny access until the cooling-off period has elapsed, even though the wallet already holds the signed credential.

The verifier trusts a known issuer public key and validates the presentation bundle locally. The core decision does not require a callback to the issuer.

## Proof model

Sprint one uses a simulated `credit_adulthood_proof`:

```json
{
  "type": "credit_adulthood_proof",
  "signals": {
    "has_primary_credit_account": true,
    "oldest_account_age_months": 24,
    "active_accounts_count": 1
  },
  "derived": {
    "confidence": "high"
  }
}
```

The default approval rule is:

- `has_primary_credit_account === true`
- `oldest_account_age_months >= 12`

The threshold is configurable through `ZIK_MIN_OLDEST_ACCOUNT_MONTHS`.

## Credential format

Issued credentials contain only the minimum claim and metadata needed for the demo:

```json
{
  "credential_id": "zp_xxxx",
  "over18": true,
  "issuer": "Zik Pass",
  "issued_at": "timestamp",
  "activates_at": "timestamp",
  "expires_at": "timestamp",
  "assurance_level": "medium",
  "subject_public_key": "holder_public_key_jwk"
}
```

The credential intentionally excludes name, date of birth, address, government ID, and raw proof evidence.

## Signing and verification model

- The issuer generates or loads an Ed25519 keypair on the server and stores it in `data/issuer-keypair.json`.
- The credential payload is canonically serialized and signed with the issuer private key.
- The resulting signature is called a Zignature.
- The verifier checks the Zignature locally with the issuer public key.
- The verifier also checks `activates_at` so a newly delivered credential cannot be used before cooling-off finishes.
- The wallet signs the verifier's fresh challenge with its holder private key.
- The verifier checks that holder signature using the `subject_public_key` embedded in the credential.

This binds the credential to the wallet without disclosing identity.

## Holder binding

The wallet generates an Ed25519 keypair in the browser using Web Crypto. The private key remains in `localStorage` for the prototype, and the public key is sent to the issuer and embedded in the credential. During presentation, the wallet signs the verifier challenge so the verifier can prove control of the bound key.

## Architecture

This sprint uses one Next.js App Router codebase so UI surfaces, API routes, crypto utilities, and shared types stay easy to run and extend locally.

### Key folders

```text
/Users/ehim/dev/ZikPass
├── app
│   ├── api
│   │   ├── config/public-key
│   │   ├── enrollment
│   │   └── issuer/sessions
│   ├── issuer
│   ├── verifier
│   └── wallet
├── components
├── data
├── lib
│   ├── client
│   ├── server
│   └── shared
└── tests
```

### Responsibility mapping

- `lib/server/mock-credit-profile.ts`: derives mocked adulthood signals from the identity-match input
- `lib/server/proof-evaluator.ts`: applies issuance rules
- `lib/server/possession-verification.ts`: creates refund-code possession challenges
- `lib/server/credential-issuer.ts`: signs credentials with the issuer private key
- `lib/client/wallet-client.ts`: manages local keypair, credential storage, and presentation
- `lib/shared/verifier-sdk.ts`: runs issuer signature, holder signature, expiry, and claim checks
- `lib/shared/crypto/*`: shared Ed25519 helpers
- `lib/shared/types.ts`: shared domain types

## Local persistence

- Server state: JSON file in [`data/state.json`](/Users/ehim/dev/ZikPass/data/state.json)
- Issuer key material: generated on first use in `data/issuer-keypair.json`
- Wallet state: browser `localStorage`

Production storage and key management would need to be replaced with secure infrastructure.

## Run locally

From the project root:

```bash
npm install
cp .env.example .env
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
npm run lint
npm run test
npm run build
```

## Demo flow

1. Open `/wallet`.
2. Click `Get Zik Pass`.
3. Answer the guided questions and confirm the refund-reference code.
4. Confirm the wallet receives the credential immediately after the possession step.
5. Wait for the cooling-off timer to finish or use `Advance demo state`.
6. Open `/verifier`.
7. Click `Verify with Zik Pass`.
8. Confirm the vendor shows valid issuer signature, valid holder signature, active credential, unexpired credential, `over18 === true`, and `Access granted`.

To demonstrate denial:

- Attempt verification before cooling-off finishes to fail the activation check.
- Enable `Tamper the credential payload` to break the issuer signature and claim.
- Enable `Verify after expiry time` to simulate a valid signature on an expired credential.
- Enable `Break holder challenge signature` to fail holder possession verification.

## Environment variables

See [`.env.example`](/Users/ehim/dev/ZikPass/.env.example):

- `ZIK_MIN_OLDEST_ACCOUNT_MONTHS`: proof approval threshold
- `ZIK_COOLING_OFF_SECONDS`: demo cooling-off duration
- `ZIK_CREDENTIAL_TTL_HOURS`: credential lifetime

## Known limitations

This prototype still does not include:

- Real CRA or bank integrations
- Real email or SMS delivery
- Revocation lists or status checks
- True zero-knowledge proofs over hidden date of birth data
- Production-grade wallet storage or hardware-backed key protection
- Full defenses against shared-device or household abuse

## Assumptions and simplifications

- The verifier page reads the wallet from same-origin browser storage for demo convenience.
- The issuer public key is loaded by the app at page render time; the verification decision itself is local.
- JSON storage is intentionally simple and is not safe for concurrent multi-instance deployment.
- If cooling-off is manually advanced after issuance, the server re-signs the credential with an updated activation time for the local demo.
