# Five-minute investor demonstration

## Setup

Use a controlled localhost or HTTPS demo with a single Node process and fictional data:

```sh
ZIK_DISCLOSURE_V1=true ZIK_ENV=demo npm run dev
```

The feature is off unless `ZIK_DISCLOSURE_V1` is exactly `true`. Merchant key material is provisioned on the first demo merchant start into the configured runtime directory. The private key is demo relying-party material; it must not be copied into client bundles or Zik domain modules. For separate infrastructure, the real merchant must provision/hold its private key on its own backend, register only its public key with Zik, and implement authenticated server-to-server retrieval. This demo is not that production integration.

## Route

1. **0:00–1:15 — issue:** `/find` → choose store → Start. In another window `/verify`, choose the same terminal and confirm 18+. Return and complete the labelled demo payment. Show the active pass. Explain that store/device authentication is prototype infrastructure.
2. **1:15–2:15 — Vault:** `/vault`, enter a fictional legal name, UK delivery address and optional email, and a strong passphrase (12+ characters). Save. Reload to show it locks. In DevTools IndexedDB inspect `zik-local-vault/encrypted/profile`: salt, IV and ciphertext, no name/address.
3. **2:15–3:00 — age-only:** `/affiliate-demo` → Verify with Zik → approve. Show the age result and explain that the Vault was not opened; Zik verifies the existing signed credential. This is not a zero-knowledge proof.
4. **3:00–4:30 — retail:** `/retail-demo` → Fill with Zik. Point out the registered merchant, purpose, two-minute expiry, required age/name/address and default-off optional email. Unlock locally. Show self-entered badges. Approve and show the populated checkout with email absent. No purchase is submitted.
5. **4:30–5:00 — evidence and limits:** in Network inspect `/api/disclosure/approve`: wrapped key/ciphertext, no profile plaintext. The explicit `/api/demo-merchant/redeem` response contains authorised merchant plaintext. Explain co-hosting and replay tests. Close with: **investor-ready vertical slice; not certified or approved for public reliance**.

## Reset

Use **Delete Vault** on `/vault` to remove local encrypted profile data and lock memory. Server reset deliberately cannot delete a device Vault. Use **Reset demo data** on `/help` to clear demo issuance/request/ciphertext state; issuer and merchant keys are preserved. Delete the pass using the existing `/pass` UI and clear the affiliate session cookie if you want a completely fresh age demo. Refresh/close checkout to clear its in-memory received fields. Never delete issuer key files as a demo reset.

## Migration / rollback

There is no plaintext migration and no change to WalletState. New Vault database version 1 is separate. Existing users begin with no Vault. Envelope v1 is parsed strictly; unsupported versions/corrupt ciphertext remain untouched and cannot unlock or be overwritten through Save. Deletion remains available. Any future version must authenticate/decrypt under its original context before migration and atomically replace the envelope.

Disable `ZIK_DISCLOSURE_V1` and restart to stop creation, read, approval, cancel and redemption. Reset server demo data if pending ciphertext should be removed. Vault users can still locally delete/export nothing; there is intentionally no export/recovery feature. Roll back implementation commits without touching wallet/issuer keys; existing Vault ciphertext can remain locked in IndexedDB until local deletion. A rollback does not revoke data already delivered to a merchant.

## Physical-device checks still required

Real iPhone Safari/PWA: PBKDF2 unlock latency and keyboard; IndexedDB durability/quota/private browsing; lock on background/reload; consent scrolling at safe-area edges; Add to Home Screen and pass handoff; storage isolation between Safari and installed PWA; offline no-store behavior; VoiceOver focus/announcements; reduced motion. Chromium/WebKit emulation cannot certify these. No physical iPhone was available to this implementation session.
