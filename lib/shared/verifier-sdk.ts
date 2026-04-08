import { serializeCredentialPayload } from "@/lib/shared/credential-format";
import { verifyString } from "@/lib/shared/crypto/ed25519";
import type { PresentationBundle, VerificationResult } from "@/lib/shared/types";

export async function verifyPresentationBundle(
  bundle: PresentationBundle,
  issuerPublicKey: JsonWebKey,
  verificationTime = new Date()
): Promise<VerificationResult> {
  const issuer_signature_valid = await verifyString(
    issuerPublicKey,
    serializeCredentialPayload(bundle.credential.payload),
    bundle.credential.zignature
  );

  const holder_signature_valid = await verifyString(
    bundle.credential.payload.subject_public_key,
    bundle.challenge,
    bundle.holder_signature
  );

  const active =
    new Date(bundle.credential.payload.activates_at).getTime() <= verificationTime.getTime();
  const not_expired =
    new Date(bundle.credential.payload.expires_at).getTime() > verificationTime.getTime();
  const claim_over18 = bundle.credential.payload.over18 === true;

  const decision =
    issuer_signature_valid && holder_signature_valid && active && not_expired && claim_over18
      ? "allow"
      : "deny";

  return {
    checks: {
      issuer_signature_valid,
      holder_signature_valid,
      active,
      not_expired,
      claim_over18
    },
    decision,
    verified_at: verificationTime.toISOString()
  };
}
