# ADR 007 — Vault v2 storage and on-device document analysis

Accepted for the working prototype, not for public reliance. Supersedes the storage
parts of [ADR 006](006-vault-disclosure.md); the disclosure and age-verification
decisions in 006 still stand unchanged.

## Context

Vault v1 stored one small JSON profile: a single AES-GCM envelope, re-encrypted in
full on every edit, with the key derived from the passphrase each time. That is
workable for three text fields. It is not workable once the Vault holds document
bytes, extracted text and an evidence graph, and it cannot support per-record edits
on a phone.

## Key hierarchy

The passphrase derives a key-encryption key (PBKDF2-HMAC-SHA-256, 600,000
iterations, fresh 128-bit salt — unchanged from v1). The KEK only ever wraps a
random 256-bit data-encryption key under AES-256-GCM with a fresh 96-bit nonce and
the wrap context as additional authenticated data.

Consequences:

- Unlocking derives once. Editing a claim or reading a document does not re-derive.
- Changing the passphrase rewraps the DEK. Stored records are untouched.
- Locking drops the DEK. The passphrase is never stored, and no device biometric
  unlocks this Vault.

The DEK is held in memory while the Vault is unlocked. This is a real change from
v1, which held no key material between operations and therefore asked for the
passphrase on every edit. Once the Vault must decrypt document bytes for preview and
analysis, holding the DEK is unavoidable, and asking for the passphrase per edit
would no longer protect anything an attacker in an unlocked session could not
already reach. Inactivity lock (two minutes), lock on tab hide, and explicit lock
all remain.

## Record sealing

Every record is sealed individually under the DEK with its own 96-bit nonce. The
additional authenticated data binds `['zik-vault-record', 2, store, id]`, so
ciphertext moved to a different record id or a different object store fails to open
rather than decrypting somewhere it never belonged. This is covered by tests.

## Storage shape

A dedicated `zik-vault` IndexedDB database, separate from both the wallet and the v1
`zik-local-vault` database. Document bytes and thumbnails are stored as binary
through structured clone, not base64 inside JSON: a 12 MB scan stays 12 MB instead of
becoming 16 MB of string, and one record can be rewritten without rewriting the
Vault.

Encrypted at rest: document bytes, thumbnails, filenames, extracted text, dates of
birth, addresses, claims, consents and applications.

Deliberately outside the ciphertext, and the complete list:

- Record ids (random, meaningless on their own).
- `document_id` on observations, thumbnails and blobs, needed as an IndexedDB index
  so a document's derived records can be deleted with it.
- `byte_length` on stored blobs.
- The presence of an application record, which the Wallet reads while the Vault is
  locked to show that an application exists. It reveals that one exists, never
  anything about its content.

## Transactions and Web Crypto

Web Crypto is never awaited inside an IndexedDB transaction. Awaiting a non-IndexedDB
promise lets the transaction auto-commit, which silently drops the writes issued
afterwards. Every method therefore reads in one transaction, does all sealing and
unsealing outside, and applies the result through a single `commit()` of prepared
operations. `tests/vault-v2.test.ts` covers this; it is what caught the bug.

## Migration

v1 → v2 runs on first unlock. The v1 profile is decrypted with the supplied
passphrase, a fresh v2 key envelope and profile are written, and claims are seeded
from the profile with no evidence behind them. v1 held no date of birth and no
designations, so both start empty rather than invented.

The v1 record is left in place. A migration that deletes the only copy of a Vault to
make room for a new format is a migration that can lose a Vault. A wrong passphrase,
a failed write or an unknown schema version leaves the existing data exactly as it
was, and `VaultV2.status()` still reports `v1_only`. A stored schema version higher
than this build understands fails closed rather than guessing.

## Generations and late writes

`VaultV2.epoch` rises on every lock. The analysis client holds its own generation,
raised on lock, reset and Vault deletion, and terminates the worker at the same time.
Every write re-checks the epoch before and after committing, and `saveAnalysis`
rejects a result carrying a stale generation. A job that was already running when the
Vault locked cannot write into it afterwards.

## Content Security Policy

`script-src` now includes `'wasm-unsafe-eval'`. Without it the OCR engine cannot
compile its WebAssembly and analysis fails outright — this was found by running the
real pipeline against the real application, not in review. The token permits
WebAssembly compilation only; JavaScript `eval` remains blocked outside development.
`frame-src blob:` was added so a stored PDF can be previewed in a sandboxed frame,
and `worker-src` allows the analysis worker.

Document text is treated as untrusted data throughout: it is never evaluated,
rendered as HTML, or followed as a link, and PDF previews run in a `sandbox=""`
frame with scripts disabled.

## What this does not provide

- Browser-local storage is not a backup. Persistence is requested where supported
  and may be declined; the Vault says so rather than implying durability.
- No encrypted export/import exists yet. This is an unmet completion item, not a
  finished Vault — see [VAULT_LOCAL_ANALYSIS.md](../VAULT_LOCAL_ANALYSIS.md).
- No hardware-backed key storage, and no guarantee of memory erasure in JavaScript.
- Nothing here attests that a document is genuine or belongs to the person holding
  it. Sealing a document says only that Zik stored what the user gave it.

Parameter reference (checked 18 September 2026): PBKDF2 iterations follow the
[OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
No FIPS validation or certification of this application is claimed.
