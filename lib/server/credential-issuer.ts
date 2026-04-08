import { runtimeConfig } from "@/lib/shared/config";
import { serializeCredentialPayload } from "@/lib/shared/credential-format";
import { signString } from "@/lib/shared/crypto/ed25519";
import type { AgeCredential, EnrollmentRecord, SignedCredential } from "@/lib/shared/types";
import { randomId } from "@/lib/shared/utils";
import { getIssuerKeyMaterial } from "@/lib/server/issuer-keys";

export async function issueCredential(record: EnrollmentRecord): Promise<SignedCredential> {
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
    assurance_level: "medium",
    subject_public_key: record.holder_public_key
  };

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
