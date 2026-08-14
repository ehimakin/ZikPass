export const ZIK_VERIFICATION_RESULT_MESSAGE = "zikpass.verification.result";

export type VendorVerificationOutcome =
  | "verified"
  | "denied"
  | "cancelled"
  | "invalid_pass"
  | "expired_pass"
  | "no_pass";

export type VendorCredentialStatus =
  | "active"
  | "expired"
  | "invalid"
  | "missing"
  | "cancelled"
  | "denied";

export interface VendorVerificationSession {
  session_id: string;
  vendor_name: string;
  vendor_origin: string;
  request: "over18";
}

export interface VendorVerificationResult {
  session_id: string;
  vendor_name: string;
  verified: boolean;
  over18: boolean;
  credential_status: VendorCredentialStatus;
  outcome: VendorVerificationOutcome;
  verification_timestamp: string;
  assurance_level?: "remote_standard" | "in_person_verified";
}

export interface VendorVerificationMessage {
  type: typeof ZIK_VERIFICATION_RESULT_MESSAGE;
  payload: VendorVerificationResult;
}

export function buildHostedVerificationUrl(session: VendorVerificationSession): string {
  const searchParams = new URLSearchParams({
    session: session.session_id,
    vendor: session.vendor_name,
    origin: session.vendor_origin,
    request: session.request
  });

  return `/verify/zik?${searchParams.toString()}`;
}

export function createVendorVerificationMessage(
  payload: VendorVerificationResult
): VendorVerificationMessage {
  return {
    type: ZIK_VERIFICATION_RESULT_MESSAGE,
    payload
  };
}

export function createVendorVerificationResult(
  session: VendorVerificationSession,
  input: {
    verified: boolean;
    over18: boolean;
    credential_status: VendorCredentialStatus;
    outcome: VendorVerificationOutcome;
    assurance_level?: "remote_standard" | "in_person_verified";
  }
): VendorVerificationResult {
  return {
    session_id: session.session_id,
    vendor_name: session.vendor_name,
    verified: input.verified,
    over18: input.over18,
    credential_status: input.credential_status,
    outcome: input.outcome,
    verification_timestamp: new Date().toISOString(),
    assurance_level: input.assurance_level
  };
}
