# ADR 006 — Local Vault and disclosure v1

Accepted for the investor demo, not public reliance.

Vault uses Web Crypto PBKDF2-HMAC-SHA-256 (600,000 iterations, fresh 128-bit salt) and AES-256-GCM (fresh 96-bit IV, 128-bit tag). A passphrase of at least 12 characters is required. The version, KDF parameters and storage context are authenticated. Keys are non-extractable after derivation; plaintext and keys live only in memory and are cleared on lock, reload and inactivity where JavaScript permits. No claim of guaranteed memory erasure or hardware protection. A separate IndexedDB database prevents WalletState migrations from serializing profile data. Unknown versions fail closed and preserve their record; v1 needs no migration. Writes commit transactionally before success is shown.

Disclosure uses RSA-OAEP with SHA-256 to wrap a random AES-256-GCM content key. Request ID, audience, state, nonce, protocol version and expiry are authenticated, and rechecked at redemption. The registered server configuration chooses the merchant name, return path and public key. Zik receives only ciphertext for profile data. The demo merchant private key and unwrap code belong exclusively to a server-only demo relying-party module, never the Zik service or browser. Co-hosting is a demo boundary, not infrastructure isolation; real merchants must operate their own backend and key custody.

Age is verified using the existing signed-presentation and authorization-code service. The merchant receives the server-verified age result, never a browser success boolean. Selective disclosure retains self-entered provenance and does not attest identity. This is not genuine ZKP: Zik still verifies the original signed age credential and holder signature and can correlate its metadata.

Replay state uses a serialized transaction and atomic file replacement, matching the existing single-process demo deployment. A consumed record cannot be redeemed again; expired ciphertext is removed. Multi-process deployment requires a transactional database before use. Disable the explicit v1 flag to fail closed. No fallback to plaintext or legacy postMessage is permitted.
