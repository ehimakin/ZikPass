# Account recovery after loss of phone and card

The account recovery phrase is a newly generated 24-word BIP39 mnemonic. It is
separate from the user-chosen **messaging passphrase** used by the lost-phone QR
card. Existing messaging passphrases cannot be converted into account recovery.

## Customer flow

- Vault completion, the issued Pass screen and Wallet offer **Set up recovery
  phrase** at `/account-recovery`. The public menu links to
  `/account-recovery/restore` for customers without either device or card.
- Write down all 24 generated words. The next screen hides them and requires all
  words to be re-entered. Nothing is marked backed up until the server confirms
  the encrypted snapshot is saved. The user explicitly consents to uploading it.
- If a Vault exists, its current passphrase is required. The snapshot includes
  all v2 record stores, document bytes and thumbnails. The data key is rewrapped
  under the recovery phrase locally. The whole snapshot is then encrypted again.
  A v1 Vault is migrated through its existing unlock flow first.
- The phrase is not persisted, logged or sent over the network. No wallet holder
  private key is backed up; restore generates a new holder key instead.
- Backup updates require the same phrase and the current trusted holder's
  signature. Updates are manual; changes since the displayed backup timestamp
  are not protected. The encrypted payload currently has a 32 MiB base64 limit
  (less usable document capacity because of encryption and encoding overhead).
- Restore first decrypts and authenticates the snapshot in the new browser,
  then shows its contents/date and asks for explicit replacement confirmation.
  A restored Vault gets a new user-chosen passphrase. It does not need the old
  Vault passphrase. Existing wallet/Vault data is never overwritten.
- The server atomically rebinds the digital pass, revokes previous holder keys
  and device bindings, supersedes handoffs and records the recovery revision.
  Issuance dates, assurance and expiry are preserved. This does not renew a pass.
- A pending replacement key and operation ID are kept in IndexedDB for retries;
  the seed phrase is not. A lost response or failed local write can be retried.
  Vault import is atomic and tagged with the operation ID for idempotency.

## Security and implementation

BIP39 generation/checksum handling uses `@scure/bip39` 2.2.0 ([upstream
usage documentation](https://github.com/paulmillr/scure-bip39)). HKDF-SHA256 derives
separate Ed25519 recovery-authorization and AES-256-GCM backup keys with Zik v1
domain labels. The account locator is a domain-separated hash of the recovery
public key, not a password hash. Backup AEAD binds ciphertext to that locator.

`/api/account-recovery` uses short-lived, one-use server challenges. Signatures
cover the action, nonce, account, revision, full ciphertext or replacement key,
and operation ID. Save requires both recovery and current holder signatures;
restore requires recovery authorization and proof of the replacement key.
A second phrase cannot silently replace the recovery authority for a pass.
Revisions prevent conflicting updates/restores. Request streaming enforces a
size limit; responses are no-store. Phrase/private-key values do not enter logs.

The runtime-state transaction now uses an exclusive filesystem directory lock
as well as its process queue. Backup state, bindings, enrollment changes and
revocations share a single atomic file replacement. A process killed while
holding the lock can leave `runtime-state.json.lock`; an operator should only
remove that directory after confirming no writer is running. There is no unsafe
age-based lock stealing.

Old pass keys are denied by the server affiliate/disclosure verifier and the
hosted browser verification surfaces, which now require an online status check.
Raw/offline uses of `verifyPresentationBundle` still only verify cryptographic
signatures; they must add revocation lookup before treating a pass as current.
Recovery cannot erase a lost phone's local plaintext or encryption keys.
Legacy unauthenticated native-handoff creation is disabled for recovered
accounts so an old enrollment ID cannot undo replacement.

## Deployment and current boundaries

Local development enables this feature by default. Production/hosted deployments
fail closed unless `ZIK_ACCOUNT_RECOVERY_ENABLED=true` AND
`ZIK_RUNTIME_DATA_DIR` are configured. The directory must be **durable, shared by
all app processes, and operationally backed up** together with the issuer key.
An ephemeral serverless `/tmp` directory is unsuitable. The explicit setting is
an operator assertion of durability, not a storage-provider integration.
The local file adapter is suitable for this prototype; a durable transactional
service and a security review are required before offering public recovery.
Demo reset deletes recovery snapshots and revocations along with demo accounts.

The real physical-card registry/issuance system does not exist in this project;
its current card pairing is explicitly a demo. Recovery restores the digital
pass and Vault without a physical card, but does **not** ship, activate or claim
to revoke a real physical card. It also does not restore lost-phone messaging
conversations, notification channels, browser settings or records not included
in the last snapshot. Replacement physical-card issuance remains a separate
integration. Automatic continuous backup and recovery-phrase rotation are not
implemented.

## Validation

- `tests/account-recovery.test.ts`: phrase/AEAD behavior, owner proof, replay and
  challenge expiry, duplicate phrase rejection, atomic replacement and retries,
  competing restores, old/new pass verification, and document-byte restoration.
- `e2e/account-recovery.spec.ts`: real Vault creation, phrase confirmation and
  encrypted upload, followed by restoration/unlock in a separate mobile-sized
  browser context. Checks phrase, passphrase and profile are absent from requests.
- Run alongside physical-flow, affiliate-verifier, vault-v2 and recovery tests.
