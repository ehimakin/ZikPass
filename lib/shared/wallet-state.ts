import type {
  EnrollmentRecord,
  WalletState,
  WalletStatusSnapshot
} from "@/lib/shared/types";

export function getWalletStatusSnapshot(
  wallet: WalletState,
  enrollment?: EnrollmentRecord | null,
  now = new Date()
): WalletStatusSnapshot {
  const credential = wallet.credential;
  const hasCredential = Boolean(credential);
  const hasHolderKey = Boolean(wallet.holderKeyPair?.privateKeyJwk && wallet.holderKeyPair.publicKeyJwk);
  const activationTime = credential ? toTimestampOrNull(credential.payload.activates_at) : null;
  const expiryTime = credential ? toTimestampOrNull(credential.payload.expires_at) : null;
  const credentialActive =
    activationTime !== null && expiryTime !== null
      ? activationTime <= now.getTime() && expiryTime > now.getTime()
      : false;
  const credentialExpired = expiryTime !== null ? expiryTime <= now.getTime() : false;

  if (credential) {
    return {
      status: credentialExpired ? "pass_expired" : "pass_issued_and_stored_locally",
      has_holder_key: hasHolderKey,
      has_credential: hasCredential,
      blocks_new_pass: true,
      credential_active: credentialActive && !credentialExpired,
      credential_expired: credentialExpired
    };
  }

  if (
    enrollment &&
    [
        "application_submitted",
        "bank_verification_pending",
        "physical_verification_pending",
        "device_auth_pending",
        "retry_provider_failure",
        "approved_with_cooling_off",
        "approved_pending_review",
        "manual_review_required",
        "verification_session_expired",
        "credential_pending_issuance"
      ].includes(enrollment.status)
  ) {
    return {
      status: "pass_pending_issuance",
      has_holder_key: hasHolderKey,
      has_credential: false,
      blocks_new_pass: false,
      credential_active: false,
      credential_expired: false
    };
  }

  if (wallet.enrollmentId || hasHolderKey) {
    return {
      status: "pass_pending_issuance",
      has_holder_key: hasHolderKey,
      has_credential: false,
      blocks_new_pass: false,
      credential_active: false,
      credential_expired: false
    };
  }

  return {
    status: "no_pass_on_device",
    has_holder_key: false,
    has_credential: false,
    blocks_new_pass: false,
    credential_active: false,
    credential_expired: false
  };
}

function toTimestampOrNull(value?: string): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}
