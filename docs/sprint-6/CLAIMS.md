# Claims we can and cannot make

## Demonstrated scope

The PWA stores a separately encrypted local profile. Zik's disclosure service receives ciphertext, while the explicitly named co-hosted demo merchant decrypts approved fields. Zik verifies the age pass using existing signatures. Name/address/email remain self-entered. Test evidence includes IndexedDB inspection, request-body canaries, omitted optional fields and atomic concurrent redemption.

We cannot claim genuine ZKP, anonymity, verified identity/address, hardware-backed browser storage, guaranteed memory erasure, recovery, independent merchant infrastructure, production reliability, certification or regulatory approval. The phrase “Zik servers cannot read your vault” is deliberately not used: the co-hosted merchant and malicious web-code threat make that broader phrase misleading.

Required positioning: **investor-ready vertical slice; not certified or approved for public reliance**.

## Verbatim security/privacy copy introduced or revised

### Vault

- “Name and address are self-entered, not checked by Zik. Your pass supplies the separate Zik-verified age result.”
- “Encrypted on this device with your passphrase. No cloud backup or passphrase recovery. Locks on reload, when hidden, or after two minutes of inactivity.”
- “Self-entered”
- “Passphrase (at least 12 characters)”
- “Re-enter passphrase to save edits”
- “Vault locked.”
- “Vault unlocked on this device.”
- “Encrypted Vault saved on this device.”
- “Unable to unlock. Check your passphrase; the saved Vault has not been changed.”
- “Unable to save. Use a passphrase of at least 12 characters; existing data is preserved.”
- “Vault deleted from this device.”
- “Deletion failed. Your Vault remains locked; retry deletion.”
- “Browser encryption is not hardware-backed storage. A compromised device or page can read unlocked data. JavaScript cannot guarantee memory erasure.”

### Retail consent and checkout

- “Fictional merchant · no order is placed.”
- “Confirm 18+ and fill your delivery details for this demo order.”
- “Request expires in two minutes. Protocol v1.”
- “Required” / “Age over 18” / “Zik verified”
- “Legal name and delivery address” / “Self-entered”
- “Optional · off by default” / “Share email · Self-entered”
- “Not shared: date of birth, photo, ID number, raw credential or holder key. Name and address are not Zik-verified.”
- “Approved profile fields are encrypted for this merchant. This co-hosted demo merchant can read them after approval.”
- “You will share”
- “Cancelled. No details shared.”
- “Checkout filled. Age 18+ — Zik verified.”
- “Age 18+ · Zik verified”
- “No purchase is submitted in this demo.”
- “This disclosure could not be completed. Please start again.”

“Zik verified” is tied to the prototype's physical-issuance age pass, with demo store/device authentication limitations explained in the script and threat model. It does not attest any profile value.

### Age consent, home and help

- “Consent v1 · Required: age over 18 · Zik verified”
- “Zik checks your signed age pass. [registered display name] receives an over-18 result and verification timestamps. Your Vault is not accessed.”
- “Over 18 result and verification metadata”
- “Name, date of birth, photo, ID number” (labelled “Not shared” to the age-only affiliate)
- “with participating demo sites. Share an age result, or approve self-entered details for retail form-fill.”
- “A reusable age pass. That's Zik.”
- “Age-only sites receive the over-18 result and verification metadata. Retail demos also receive the self-entered fields you approve. No date of birth, photo or document number is shared. This is not a zero-knowledge proof.”
- “The age check happens in person; the physical flow does not upload an ID photo. Your pass stays on your device, with operational issuance records on Zik servers.”
- “Age-only sites receive an over-18 result and verification metadata. Retail demos also receive only the self-entered profile fields you approve. No date of birth or document number is shared.”
- “Signed age verification” (replaces legacy “Zero Knowledge age verification” heading).

Existing signed age verification still sends the original credential/holder public key to Zik. Merchant-facing “not shared” statements do not mean these are hidden from Zik's age verifier. The unsafe legacy hosted verifier is not reused by this sprint.

Existing age-only denial, retained verbatim: “Zik could not confirm your age. No identity data was shared. Please try again or choose another verification method.” This refers to identity data released to the affiliate; Zik's age-verification boundary is described above.
