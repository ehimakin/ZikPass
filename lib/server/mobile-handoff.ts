import { createHash, randomBytes } from "node:crypto";
import { getEnrollmentOrThrow } from "@/lib/server/enrollment-service";
import { issueCredential } from "@/lib/server/credential-issuer";
import { getMobileAppHandoff, upsertMobileAppHandoff } from "@/lib/server/storage";
import type { SignedCredential } from "@/lib/shared/types";

const HANDOFF_TTL_MS = 10 * 60 * 1000;

export async function createNativeAppHandoff(enrollmentId: string): Promise<{
  token: string;
  expiresAt: string;
}> {
  const enrollment = await getEnrollmentOrThrow(enrollmentId);
  if (!enrollment.issued_credential) {
    throw new Error("The ZikPass must be issued before it can be opened in the native app.");
  }

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = new Date(now + HANDOFF_TTL_MS).toISOString();
  await upsertMobileAppHandoff({
    token_hash: hashToken(token),
    enrollment_id: enrollmentId,
    created_at: new Date(now).toISOString(),
    expires_at: expiresAt
  });

  return { token, expiresAt };
}

export async function claimNativeAppHandoff(input: {
  token: string;
  holderPublicKey: JsonWebKey;
}): Promise<SignedCredential> {
  validateHolderPublicKey(input.holderPublicKey);
  const handoff = await getMobileAppHandoff(hashToken(input.token));

  if (!handoff || new Date(handoff.expires_at).getTime() <= Date.now()) {
    throw new Error("This app handoff has expired or is not recognised.");
  }

  if (handoff.claimed_at) {
    throw new Error("This app handoff has already been claimed.");
  }

  const enrollment = await getEnrollmentOrThrow(handoff.enrollment_id);
  if (!enrollment.issued_credential) {
    throw new Error("This ZikPass is not ready for native app storage.");
  }

  const credential = await issueCredential(enrollment, input.holderPublicKey);
  await upsertMobileAppHandoff({
    ...handoff,
    claimed_at: new Date().toISOString(),
    holder_public_key: input.holderPublicKey,
    issued_credential: credential
  });

  return credential;
}

export function buildNativeAppHandoffUrls(origin: string, token: string) {
  const encodedToken = encodeURIComponent(token);
  return {
    customSchemeUrl: `zik://handoff?token=${encodedToken}`,
    webHandoffUrl: `${origin.replace(/\/$/, "")}/app/handoff?token=${encodedToken}`
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validateHolderPublicKey(value: JsonWebKey) {
  if (
    value.kty !== "OKP" ||
    value.crv !== "Ed25519" ||
    typeof value.x !== "string" ||
    value.d !== undefined
  ) {
    throw new Error("A native Ed25519 public key is required.");
  }

  const keyBytes = Buffer.from(value.x, "base64url");
  if (keyBytes.length !== 32) {
    throw new Error("The native holder public key is malformed.");
  }
}
