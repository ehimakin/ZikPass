import { createHash, randomBytes } from "node:crypto";
import { getEnrollmentOrThrow } from "@/lib/server/enrollment-service";
import { issueCredential } from "@/lib/server/credential-issuer";
import {
  findLatestRecoverableMobileAppHandoff,
  getMobileAppHandoff,
  upsertMobileAppHandoff
} from "@/lib/server/storage";
import type { SignedCredential } from "@/lib/shared/types";

const HANDOFF_TTL_MS = 10 * 60 * 1000;

export async function createNativeAppHandoff(
  enrollmentId: string,
  options?: { clientIp?: string }
): Promise<{
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
    expires_at: expiresAt,
    client_ip: options?.clientIp
  });

  return { token, expiresAt };
}

export async function claimNativeAppHandoff(input: {
  token: string;
  holderPublicKey: JsonWebKey;
}): Promise<SignedCredential> {
  validateHolderPublicKey(input.holderPublicKey);
  const handoff = await getMobileAppHandoff(hashToken(input.token));

  if (!handoff) {
    throw new Error("This app handoff has expired or is not recognised.");
  }

  if (handoff.claimed_at) {
    if (
      handoff.issued_credential &&
      handoff.holder_public_key &&
      sameHolderPublicKey(handoff.holder_public_key, input.holderPublicKey)
    ) {
      return handoff.issued_credential;
    }

    throw new Error("This app handoff has already been claimed.");
  }

  if (handoff.superseded_at || new Date(handoff.expires_at).getTime() <= Date.now()) {
    throw new Error("This app handoff has expired or is not recognised.");
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

export async function recoverNativeAppHandoff(clientIp: string): Promise<{
  token: string;
  expiresAt: string;
} | null> {
  const pending = await findLatestRecoverableMobileAppHandoff(clientIp);
  if (!pending) {
    return null;
  }

  await upsertMobileAppHandoff({
    ...pending,
    superseded_at: new Date().toISOString()
  });
  return createNativeAppHandoff(pending.enrollment_id, { clientIp });
}

export function buildNativeAppHandoffUrls(origin: string, token: string) {
  const encodedToken = encodeURIComponent(token);
  return {
    customSchemeUrl: `zik://handoff?token=${encodedToken}`,
    webHandoffUrl: `${origin.replace(/\/$/, "")}/app/handoff?token=${encodedToken}`,
    pwaStartUrl: `/wallet?source=pwa&handoff_token=${encodedToken}`
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

function sameHolderPublicKey(left: JsonWebKey, right: JsonWebKey): boolean {
  return left.kty === right.kty && left.crv === right.crv && left.x === right.x;
}
