import { createHash, randomBytes } from "node:crypto";
import { getAffiliateClient, isAllowedAffiliateRedirectUri } from "@/lib/server/affiliate-clients";
import { getIssuerPublicKey } from "@/lib/server/issuer-keys";
import {
  findPendingAffiliateAuthorizationRequest,
  getAffiliateAuthorizationRequest,
  insertAffiliateAuthorizationCode,
  insertAffiliateAuthorizationRequest,
  runAffiliateAuthorizationCodeTransaction,
  runAffiliateAuthorizationRequestTransaction
} from "@/lib/server/storage";
import {
  buildAffiliateChallenge,
  classifyAffiliateChallengeMismatch,
  isClientReportableDenialReason
} from "@/lib/shared/affiliate-verifier";
import { runtimeConfig } from "@/lib/shared/config";
import type {
  AffiliateAuthorizationCodeRecord,
  AffiliateAuthorizationRequest,
  AffiliateDenialReason,
  AffiliateVerificationResult,
  PresentationBundle
} from "@/lib/shared/types";
import { randomAlphaNumericCode, randomId } from "@/lib/shared/utils";
import { verifyPresentationBundle } from "@/lib/shared/verifier-sdk";

const MAX_OPAQUE_FIELD_LENGTH = 512;

export class AffiliateRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AffiliateRequestError";
  }
}

export type AffiliateChallengeOutcome =
  | { outcome: "approved"; redirectUri: string; code: string; state: string }
  | { outcome: "denied"; redirectUri: string; state: string; reason: AffiliateDenialReason };

export async function createAffiliateAuthorizationRequest(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): Promise<AffiliateAuthorizationRequest> {
  const clientId = input.clientId?.trim();
  const redirectUri = input.redirectUri?.trim();
  const state = input.state?.trim();

  if (!clientId) {
    throw new AffiliateRequestError("A client_id is required.");
  }

  if (!redirectUri) {
    throw new AffiliateRequestError("A redirect_uri is required.");
  }

  if (!state) {
    throw new AffiliateRequestError("A state value is required.");
  }

  if (state.length > MAX_OPAQUE_FIELD_LENGTH || redirectUri.length > MAX_OPAQUE_FIELD_LENGTH) {
    throw new AffiliateRequestError("The request contains an unexpectedly long field.");
  }

  const client = getAffiliateClient(clientId);
  if (!client) {
    throw new AffiliateRequestError("This client_id is not recognised.");
  }

  if (!isAllowedAffiliateRedirectUri(clientId, redirectUri)) {
    throw new AffiliateRequestError("This redirect_uri is not registered for this client.");
  }

  // Idempotent: a retried authorize call with the same client/state/redirect
  // (e.g. a double-click, or a network retry) reuses the pending request
  // instead of minting a second one.
  const existing = await findPendingAffiliateAuthorizationRequest({ clientId, state, redirectUri });
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const requestId = randomId("areq");
  const nonce = randomAlphaNumericCode(20);
  const challenge = buildAffiliateChallenge({ clientId, requestId, nonce });
  const challengeExpiresAt = new Date(
    Date.now() + runtimeConfig.affiliateChallengeTtlSeconds * 1000
  ).toISOString();

  const record: AffiliateAuthorizationRequest = {
    request_id: requestId,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    nonce,
    challenge,
    challenge_expires_at: challengeExpiresAt,
    status: "pending",
    created_at: now,
    updated_at: now
  };

  return insertAffiliateAuthorizationRequest(record);
}

export async function getAffiliateAuthorizationStatus(requestId: string): Promise<
  | {
      status: AffiliateAuthorizationRequest["status"];
      client_id: string;
      redirect_uri: string;
      // Only meaningful (and only returned) while still pending — this is
      // not a secret, it's the value the confirm screen asks the device to
      // sign, but it's irrelevant once the request has already resolved.
      challenge?: string;
    }
  | undefined
> {
  const request = await getAffiliateAuthorizationRequest(requestId);

  if (!request) {
    return undefined;
  }

  return {
    status: request.status,
    client_id: request.client_id,
    redirect_uri: request.redirect_uri,
    challenge: request.status === "pending" ? request.challenge : undefined
  };
}

export async function completeAffiliateChallenge(input: {
  requestId: string;
  presentationBundle: PresentationBundle;
}): Promise<AffiliateChallengeOutcome> {
  const issuerPublicKey = await getIssuerPublicKey();

  const outcome = await runAffiliateAuthorizationRequestTransaction<
    AffiliateChallengeOutcome | { outcome: "approved_pending_code"; requestId: string; redirectUri: string; state: string; rawCode: string }
  >(async (requests) => {
    const index = requests.findIndex((request) => request.request_id === input.requestId);

    if (index === -1) {
      throw new AffiliateRequestError("This verification request was not found.");
    }

    const request = requests[index];

    if (request.status !== "pending") {
      return {
        result: {
          outcome: "denied",
          redirectUri: request.redirect_uri,
          state: request.state,
          reason: request.status === "approved" ? "consumed_challenge" : request.denial_reason ?? "consumed_challenge"
        }
      };
    }

    if (new Date(request.challenge_expires_at).getTime() <= Date.now()) {
      const denied = denyRequestRecord(request, "expired_challenge");
      const nextRequests = requests.slice();
      nextRequests[index] = denied;
      return {
        result: {
          outcome: "denied",
          redirectUri: denied.redirect_uri,
          state: denied.state,
          reason: "expired_challenge"
        },
        requests: nextRequests
      };
    }

    if (input.presentationBundle.challenge !== request.challenge) {
      const reason = classifyAffiliateChallengeMismatch(input.presentationBundle.challenge, {
        clientId: request.client_id,
        requestId: request.request_id,
        nonce: request.nonce
      });
      const denied = denyRequestRecord(request, reason);
      const nextRequests = requests.slice();
      nextRequests[index] = denied;
      return {
        result: { outcome: "denied", redirectUri: denied.redirect_uri, state: denied.state, reason },
        requests: nextRequests
      };
    }

    const verification = await verifyPresentationBundle(input.presentationBundle, issuerPublicKey, new Date());

    if (verification.decision !== "allow") {
      const reason: AffiliateDenialReason = !verification.checks.holder_signature_valid
        ? "invalid_signature"
        : !verification.checks.not_expired
          ? "expired_pass"
          : "revoked_or_invalid_pass";
      const denied = denyRequestRecord(request, reason);
      const nextRequests = requests.slice();
      nextRequests[index] = denied;
      return {
        result: { outcome: "denied", redirectUri: denied.redirect_uri, state: denied.state, reason },
        requests: nextRequests
      };
    }

    const now = new Date().toISOString();
    const result: AffiliateVerificationResult = {
      verification_id: randomId("av_demo"),
      age_over: true,
      threshold: 18,
      assurance: input.presentationBundle.credential.payload.assurance_level,
      verified_at: now,
      expires_at: input.presentationBundle.credential.payload.expires_at
    };

    const approved: AffiliateAuthorizationRequest = {
      ...request,
      status: "approved",
      updated_at: now,
      completed_at: now,
      result
    };
    const nextRequests = requests.slice();
    nextRequests[index] = approved;

    // The raw code is generated here and returned exactly once — only its
    // hash is ever persisted, matching the mobile-handoff token pattern.
    const rawCode = randomBytes(32).toString("base64url");

    return {
      result: {
        outcome: "approved_pending_code",
        requestId: approved.request_id,
        redirectUri: approved.redirect_uri,
        state: approved.state,
        rawCode
      },
      requests: nextRequests
    };
  });

  if (outcome.outcome !== "approved_pending_code") {
    return outcome;
  }

  const now = new Date().toISOString();
  const codeRecord: AffiliateAuthorizationCodeRecord = {
    code_hash: hashAffiliateCode(outcome.rawCode),
    request_id: outcome.requestId,
    client_id: (await getAffiliateAuthorizationRequest(outcome.requestId))?.client_id ?? "",
    redirect_uri: outcome.redirectUri,
    created_at: now,
    expires_at: new Date(Date.now() + runtimeConfig.affiliateAuthorizationCodeTtlSeconds * 1000).toISOString()
  };
  await insertAffiliateAuthorizationCode(codeRecord);

  return { outcome: "approved", redirectUri: outcome.redirectUri, code: outcome.rawCode, state: outcome.state };
}

/**
 * The confirm screen can detect some denial conditions before ever asking
 * the device to sign anything (no pass, expired pass, unsupported device,
 * user cancellation). Only a narrow, pre-approved set of reasons may be
 * reported this way — anything else is rejected so a client can't claim a
 * server-only outcome for itself.
 */
export async function denyAffiliateChallenge(input: {
  requestId: string;
  reason: string;
}): Promise<AffiliateChallengeOutcome> {
  if (!isClientReportableDenialReason(input.reason)) {
    throw new AffiliateRequestError("This denial reason is not valid for a client-reported outcome.");
  }

  return runAffiliateAuthorizationRequestTransaction<AffiliateChallengeOutcome>((requests) => {
    const index = requests.findIndex((request) => request.request_id === input.requestId);

    if (index === -1) {
      throw new AffiliateRequestError("This verification request was not found.");
    }

    const request = requests[index];

    if (request.status !== "pending") {
      return {
        result: {
          outcome: "denied",
          redirectUri: request.redirect_uri,
          state: request.state,
          reason: request.denial_reason ?? "consumed_challenge"
        }
      };
    }

    const denied = denyRequestRecord(request, input.reason);
    const nextRequests = requests.slice();
    nextRequests[index] = denied;

    return {
      result: { outcome: "denied", redirectUri: denied.redirect_uri, state: denied.state, reason: input.reason as AffiliateDenialReason },
      requests: nextRequests
    };
  });
}

export async function exchangeAffiliateAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): Promise<AffiliateVerificationResult> {
  if (!input.code?.trim()) {
    throw new AffiliateRequestError("An authorization code is required.");
  }

  const codeHash = hashAffiliateCode(input.code.trim());

  const consumed = await runAffiliateAuthorizationCodeTransaction<
    AffiliateAuthorizationCodeRecord | "not_found" | "replayed" | "expired"
  >((codes) => {
    const index = codes.findIndex((candidate) => candidate.code_hash === codeHash);

    if (index === -1) {
      return { result: "not_found" };
    }

    const record = codes[index];

    if (record.consumed_at) {
      return { result: "replayed" };
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return { result: "expired" };
    }

    const now = new Date().toISOString();
    const consumedRecord: AffiliateAuthorizationCodeRecord = { ...record, consumed_at: now };
    const nextCodes = codes.slice();
    nextCodes[index] = consumedRecord;

    return { result: consumedRecord, codes: nextCodes };
  });

  if (consumed === "not_found") {
    throw new AffiliateRequestError("This authorization code was not recognised.");
  }

  if (consumed === "replayed") {
    throw new AffiliateRequestError("This authorization code has already been used.");
  }

  if (consumed === "expired") {
    throw new AffiliateRequestError("This authorization code has expired.");
  }

  if (consumed.client_id !== input.clientId?.trim()) {
    throw new AffiliateRequestError("This authorization code was not issued to this client.");
  }

  if (consumed.redirect_uri !== input.redirectUri?.trim()) {
    throw new AffiliateRequestError("This authorization code was not issued for this redirect_uri.");
  }

  const request = await getAffiliateAuthorizationRequest(consumed.request_id);

  if (!request?.result) {
    throw new AffiliateRequestError("No verification result is available for this authorization code.");
  }

  if (request.state !== input.state?.trim()) {
    throw new AffiliateRequestError("This authorization code does not match the expected state.");
  }

  return request.result;
}

function denyRequestRecord(
  request: AffiliateAuthorizationRequest,
  reason: string
): AffiliateAuthorizationRequest {
  const now = new Date().toISOString();
  return {
    ...request,
    status: "denied",
    updated_at: now,
    completed_at: now,
    denial_reason: (reason as AffiliateDenialReason) ?? "server_error"
  };
}

function hashAffiliateCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
