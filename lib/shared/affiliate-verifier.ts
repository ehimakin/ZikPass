import type { AffiliateDenialReason } from "@/lib/shared/types";

const CHALLENGE_PREFIX = "zik_affiliate_v1";

/**
 * Builds the exact string the holder's device must sign. Binding the
 * client_id, request_id, and nonce into the signed payload means a
 * captured challenge from one request cannot be replayed against another
 * request, another client, or with a substituted nonce — the signature
 * itself would no longer match what this request expects.
 */
export function buildAffiliateChallenge(input: {
  clientId: string;
  requestId: string;
  nonce: string;
}): string {
  return `${CHALLENGE_PREFIX}:${input.clientId}:${input.requestId}:${input.nonce}`;
}

export type AffiliateChallengeMismatch = "wrong_audience" | "wrong_nonce" | "malformed_challenge";

/**
 * Classifies why a submitted challenge does not match what was issued for
 * a request, so the same underlying "strings don't match" failure can
 * still surface a specific, testable reason. Only used once a plain
 * equality check has already failed.
 */
export function classifyAffiliateChallengeMismatch(
  submitted: string,
  expected: { clientId: string; requestId: string; nonce: string }
): AffiliateChallengeMismatch {
  const parts = submitted.split(":");

  if (parts.length !== 4 || parts[0] !== CHALLENGE_PREFIX || parts[2] !== expected.requestId) {
    return "malformed_challenge";
  }

  if (parts[1] !== expected.clientId) {
    return "wrong_audience";
  }

  if (parts[3] !== expected.nonce) {
    return "wrong_nonce";
  }

  return "malformed_challenge";
}

/**
 * The affiliate only ever sees this one calm message, regardless of the
 * specific internal reason — it must never learn whether a pass was
 * missing, expired, tampered with, or targeted at the wrong client, since
 * that would itself leak information about the holder's device/account.
 */
export const AFFILIATE_DENIAL_MESSAGE =
  "ZikPass could not confirm your age. No identity data was shared. Please try again or choose another verification method.";

const CLIENT_REPORTABLE_DENIAL_REASONS: readonly AffiliateDenialReason[] = [
  "no_pass",
  "expired_pass",
  "revoked_or_invalid_pass",
  "unsupported_device",
  "cancelled"
];

/**
 * The confirm screen (ZikPass's own UI, not the affiliate's) can detect
 * some denial conditions locally before ever asking the device to sign
 * anything — e.g. there is no pass to sign with at all. Only this narrow,
 * pre-flight set of reasons may be reported by the client; anything else
 * is ignored so a client cannot claim a server-only outcome (like
 * "wrong_nonce") for itself.
 */
export function isClientReportableDenialReason(
  value: string
): value is (typeof CLIENT_REPORTABLE_DENIAL_REASONS)[number] {
  return (CLIENT_REPORTABLE_DENIAL_REASONS as readonly string[]).includes(value);
}
