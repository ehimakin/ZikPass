import { runtimeConfig } from "@/lib/shared/config";
import { serializeCredentialPayload } from "@/lib/shared/credential-format";
import { signString } from "@/lib/shared/crypto/ed25519";
import type { AgeCredential, EnrollmentRecord, SignedCredential } from "@/lib/shared/types";
import { randomId } from "@/lib/shared/utils";
import { getIssuerKeyMaterial } from "@/lib/server/issuer-keys";

export async function issueCredential(
  record: EnrollmentRecord,
  holderPublicKey: JsonWebKey = record.holder_public_key
): Promise<SignedCredential> {
  const issuedAt = new Date();
  const activatesAt = new Date(record.cooling_off.ends_at);
  const expiresAt = new Date(
    issuedAt.getTime() + runtimeConfig.credentialTtlHours * 60 * 60 * 1000
  );

  const payload: AgeCredential = {
    credential_id: randomId("zp"),
    over18: true,
    issuer: "Zik Pass",
    issued_at: issuedAt.toISOString(),
    activates_at: activatesAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    assurance_level: record.assurance_level,
    issuance_channel: record.issuance_channel,
    verification_method:
      record.issuance_channel === "physical" ? "physical_id_check" : "remote_financial",
    physical_attestation: record.physical_verification?.attestation
      ? {
          session_id: record.physical_verification.attestation.session_id,
          verification_method: record.physical_verification.attestation.verification_method,
          verifier_id: record.physical_verification.attestation.verifier_id,
          retailer_id: record.physical_verification.attestation.retailer_id,
          location_id: record.physical_verification.attestation.location_id,
          verified_at: record.physical_verification.attestation.verified_at
        }
      : undefined,
    subject_public_key: holderPublicKey
  };

  return signCredentialPayload(payload);
}

export async function rebindIssuedCredential(
  credential: SignedCredential,
  holderPublicKey: JsonWebKey
): Promise<SignedCredential> {
  return signCredentialPayload({
    ...credential.payload,
    subject_public_key: holderPublicKey
  });
}

async function signCredentialPayload(payload: AgeCredential): Promise<SignedCredential> {
  const keyMaterial = await getIssuerKeyMaterial();
  const zignature = await signString(
    keyMaterial.privateKeyJwk,
    serializeCredentialPayload(payload)
  );

  return {
    payload,
    zignature,
    algorithm: "Ed25519"
  };
}
