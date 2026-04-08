# 🚀 Zik Pass — MVP Definition (Sprint 1)

## 🧠 Core Product Idea
Zik Pass is a zero-knowledge-inspired system that allows users to prove they are over 18 using cryptographic credentials derived from real-world financial signals—without revealing their identity.

## 🎯 MVP Goal
Deliver a working prototype that demonstrates:
- Capture of adulthood proofs (credit-based signals)
- Evaluation of those proofs
- Issuance of a signed Over-18 credential (Zik Pass)
- Local verification of that credential by a third-party site
- Basic fraud resistance via possession + device binding

## 🔐 MVP Trust Model
Zik Pass issues credentials only when all three conditions are met:

### 1. Adult Signal (Credit-Based)
Evidence of regulated financial activity requiring age ≥18

### 2. Live Possession
User must actively control a real financial channel

### 3. Holder Binding
Credential is cryptographically tied to the user’s device

## 🧾 Accepted Proof Source (Sprint 1)

### ✅ Primary Proof: Credit History Signal
We do not rely on existence of a credit file.

We require timestamped credit events:

**Required signals:**
- Presence of primary credit account
- Oldest account age ≥ threshold (e.g. 6–12 months)

## 🧩 Proof Schema (MVP)
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

## 🛡️ Anti-Fraud Strategy (MVP)

Designed to prevent:
> “Child using parent’s details or card”

**Required Layers:**
1. 💳 Credit-Based Adulthood Signal  
2. 💸 Bank Transaction Verification  
   - Small transaction/refund with embedded code  
   - User must retrieve and input code  
3. 📲 Banking App / Live Approval  
4. 🔑 Device-Level Authentication  
   - Passcode / biometric / passkey (local only)  
5. ⏳ Cooling-Off Period  
   - Credential activates after delay (e.g. 24h)  
6. 📩 Out-of-Band Notification  
   - Email/SMS alert: “A Zik Pass was created using your identity”

## 🧠 Issuance Rule (MVP)
Issue Over-18 credential only if:
- Credit adulthood signal = valid  
- AND bank verification = completed  
- AND device auth = completed  

Otherwise:
- Reject or retry  

## 🔐 Credential Design (Zik Pass)

### Payload
```json
{
  "credential_id": "zp_xxxx",
  "over18": true,
  "issuer": "Zik Pass",
  "issued_at": "timestamp",
  "expires_at": "timestamp",
  "assurance_level": "medium",
  "subject_public_key": "user_public_key"
}
```

### Signature (Zignature)
```
signature = SIGN(Zik_private_key, HASH(payload))
```

### Key Properties
- No personal identity data  
- No DOB  
- No name  
- Only boolean + metadata  

## 👤 Holder Binding (Critical)
Each credential is tied to a user-generated keypair:
- Private key → stored locally (device/wallet)  
- Public key → embedded in credential  

## 🔄 Verification Flow (Third-Party Site)

### Step 1 — User presents:
- Credential payload  
- Zignature  
- Challenge response signature  

### Step 2 — Site verifies:
- ✅ Issuer authenticity  
- ✅ Holder ownership  
- ✅ Credential validity  

**Result:**  
👉 Access granted / denied  

## 🧩 System Components (Sprint 1)

1. **proof_capture**  
   - Accept proof input  
   - Normalize into schema  

2. **proof_evaluator**  
   - Apply rules  
   - Output eligibility  

3. **verification_layer**  
   - Simulate transaction checks  

4. **credential_issuer**  
   - Generate & sign credential  

5. **wallet_client**  
   - Generate keypair  
   - Store credential  
   - Sign challenges  

6. **verifier_sdk**  
   - Verify issuer signature  
   - Verify holder proof  
   - Validate credential  

## 🔁 End-to-End Flow (MVP Demo)

### Enrollment:
- User submits proof  
- System evaluates  
- User verifies transaction  
- User completes device auth  
- Keypair generated  
- Credential issued & stored  

### Verification:
- User visits site  
- Site sends challenge  
- User signs + submits credential  
- Site verifies everything  
- Access granted  

## ⚠️ Known Limitations
- Proof inputs are simulated  
- Not resistant to shared devices  
- No revocation system  
- No ZKP layer yet  

## 🧭 Sprint 1 Success Criteria
You are done when:
- A user can obtain a Zik Pass locally  
- Credential is cryptographically signed  
- A separate app can verify it  
- No identity data is exchanged  

## 🔑 Core Principle
**Zik Pass proves adulthood through verified financial behaviour and cryptographic trust—without revealing identity.**
