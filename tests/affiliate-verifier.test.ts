import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AffiliateRequestError,
  completeAffiliateChallenge,
  createAffiliateAuthorizationRequest,
  denyAffiliateChallenge,
  exchangeAffiliateAuthorizationCode,
  getAffiliateAuthorizationStatus
} from "@/lib/server/affiliate-verifier";
import { advanceCoolingOff, startEnrollment, verifyPossessionCode } from "@/lib/server/enrollment-service";
import { getIssuerKeyMaterial } from "@/lib/server/issuer-keys";
import { getIssuerKeyPath, getRuntimeStatePath } from "@/lib/server/runtime-paths";
import { serializeCredentialPayload } from "@/lib/shared/credential-format";
import { generateKeyPair, signString } from "@/lib/shared/crypto/ed25519";
import type { AgeCredential, PresentationBundle, SignedCredential } from "@/lib/shared/types";

const runtimeStatePath = getRuntimeStatePath();
const issuerKeyPath = getIssuerKeyPath();

const CLIENT_ID = "nightfall-demo";
const REDIRECT_URI = "/affiliate-demo/callback";

let originalRuntimeState: string | null = null;
let originalIssuerKey: string | null = null;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resetRuntimeFiles() {
  await fs.mkdir(path.dirname(runtimeStatePath), { recursive: true });
  await fs.writeFile(runtimeStatePath, JSON.stringify({ enrollments: [] }, null, 2), "utf8");

  if (await fileExists(issuerKeyPath)) {
    await fs.rm(issuerKeyPath);
  }
}

async function issueRealTestCredential(
  seed: string
): Promise<{ credential: SignedCredential; holderKeys: Awaited<ReturnType<typeof generateKeyPair>> }> {
  const holderKeys = await generateKeyPair();
  const enrollment = await startEnrollment({
    application: {
      identity_match: {
        first_name: "Affiliate",
        last_name: "Tester",
        date_of_birth: "1995-01-01",
        current_home_address: "1 Demo Street"
      },
      bank_name: "Monzo",
      submitted_at: "2026-04-14T10:00:00.000Z",
      demo_scenario: "clean_adult_match"
    },
    holderPublicKey: holderKeys.publicKeyJwk,
    applicationFingerprint: `affiliate-test-${seed}`
  });

  await verifyPossessionCode(enrollment.id, enrollment.bank_verification.code);
  const issued = await advanceCoolingOff(enrollment.id);

  if (!issued.issued_credential) {
    throw new Error("Test setup failed to issue a credential.");
  }

  return { credential: issued.issued_credential, holderKeys };
}

async function buildExpiredCredential(holderPublicKeyJwk: JsonWebKey): Promise<SignedCredential> {
  const keyMaterial = await getIssuerKeyMaterial();
  const payload: AgeCredential = {
    credential_id: "zp_affiliate_expired_test",
    over18: true,
    issuer: "Zik Pass",
    issued_at: "2020-01-01T00:00:00.000Z",
    activates_at: "2020-01-01T00:00:00.000Z",
    expires_at: "2020-02-01T00:00:00.000Z",
    assurance_level: "in_person_verified",
    issuance_channel: "physical",
    verification_method: "physical_id_check",
    subject_public_key: holderPublicKeyJwk
  };

  const zignature = await signString(keyMaterial.privateKeyJwk, serializeCredentialPayload(payload));
  return { payload, zignature, algorithm: "Ed25519" };
}

async function buildValidBundle(
  credential: SignedCredential,
  holderPrivateKeyJwk: JsonWebKey,
  challenge: string
): Promise<PresentationBundle> {
  return {
    credential,
    challenge,
    holder_signature: await signString(holderPrivateKeyJwk, challenge),
    holder_algorithm: "Ed25519",
    presented_at: new Date().toISOString()
  };
}

describe.sequential("affiliate verification demo", () => {
  beforeAll(async () => {
    originalRuntimeState = (await fileExists(runtimeStatePath))
      ? await fs.readFile(runtimeStatePath, "utf8")
      : null;
    originalIssuerKey = (await fileExists(issuerKeyPath))
      ? await fs.readFile(issuerKeyPath, "utf8")
      : null;
  });

  beforeEach(async () => {
    await resetRuntimeFiles();
  });

  afterAll(async () => {
    if (originalRuntimeState === null) {
      await fs.rm(runtimeStatePath, { force: true });
    } else {
      await fs.writeFile(runtimeStatePath, originalRuntimeState, "utf8");
    }

    if (originalIssuerKey === null) {
      await fs.rm(issuerKeyPath, { force: true });
    } else {
      await fs.writeFile(issuerKeyPath, originalIssuerKey, "utf8");
    }
  });

  it("1. completes a successful verification and returns only the minimal fields to the affiliate", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("success");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-success"
    });

    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, request.challenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });

    expect(outcome.outcome).toBe("approved");
    if (outcome.outcome !== "approved") {
      throw new Error("expected approved outcome");
    }
    expect(outcome.state).toBe("state-success");

    const result = await exchangeAffiliateAuthorizationCode({
      code: outcome.code,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-success"
    });

    expect(result.age_over).toBe(true);
    expect(result.threshold).toBe(18);
    expect(result.assurance).toBe(credential.payload.assurance_level);
    expect(result.verification_id).toMatch(/^av_demo_/);
    expect(new Date(result.verified_at).getTime()).not.toBeNaN();
    expect(new Date(result.expires_at).getTime()).not.toBeNaN();
  });

  it("2. denies when there is no wallet/pass on the device", async () => {
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-no-pass"
    });

    const outcome = await denyAffiliateChallenge({ requestId: request.request_id, reason: "no_pass" });

    expect(outcome.outcome).toBe("denied");
    if (outcome.outcome === "denied") {
      expect(outcome.reason).toBe("no_pass");
    }

    const status = await getAffiliateAuthorizationStatus(request.request_id);
    expect(status?.status).toBe("denied");
  });

  it("3. denies an expired pass", async () => {
    const holderKeys = await generateKeyPair();
    const expiredCredential = await buildExpiredCredential(holderKeys.publicKeyJwk);
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-expired-pass"
    });

    const bundle = await buildValidBundle(expiredCredential, holderKeys.privateKeyJwk, request.challenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });

    expect(outcome.outcome).toBe("denied");
    if (outcome.outcome === "denied") {
      expect(outcome.reason).toBe("expired_pass");
    }
  });

  it("4. denies an invalid holder signature", async () => {
    const { credential } = await issueRealTestCredential("bad-signature");
    const wrongKeys = await generateKeyPair();
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-bad-sig"
    });

    // Signed with a key that does not match the credential's subject key.
    const bundle = await buildValidBundle(credential, wrongKeys.privateKeyJwk, request.challenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });

    expect(outcome.outcome).toBe("denied");
    if (outcome.outcome === "denied") {
      expect(outcome.reason).toBe("invalid_signature");
    }
  });

  it("5. denies a challenge built for the wrong audience/client", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("wrong-audience");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-wrong-audience"
    });

    const tamperedChallenge = `zik_affiliate_v1:some-other-client:${request.request_id}:${request.nonce}`;
    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, tamperedChallenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });

    expect(outcome.outcome).toBe("denied");
    if (outcome.outcome === "denied") {
      expect(outcome.reason).toBe("wrong_audience");
    }
  });

  it("6. denies a challenge signed over the wrong nonce", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("wrong-nonce");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-wrong-nonce"
    });

    const tamperedChallenge = `zik_affiliate_v1:${CLIENT_ID}:${request.request_id}:wrong-nonce-value`;
    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, tamperedChallenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });

    expect(outcome.outcome).toBe("denied");
    if (outcome.outcome === "denied") {
      expect(outcome.reason).toBe("wrong_nonce");
    }
  });

  it("denies a malformed challenge that does not match the expected shape at all", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("malformed-challenge");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-malformed"
    });

    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, "not-a-real-challenge");
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });

    expect(outcome.outcome).toBe("denied");
    if (outcome.outcome === "denied") {
      expect(outcome.reason).toBe("malformed_challenge");
    }
  });

  it("7. denies a replayed challenge (already-consumed request)", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("replayed-challenge");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-replay-challenge"
    });

    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, request.challenge);
    const first = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });
    expect(first.outcome).toBe("approved");

    const second = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });
    expect(second.outcome).toBe("denied");
    if (second.outcome === "denied") {
      expect(second.reason).toBe("consumed_challenge");
    }
  });

  it("8. denies a replayed authorization code", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("replayed-code");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-replay-code"
    });

    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, request.challenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });
    if (outcome.outcome !== "approved") {
      throw new Error("expected approved outcome");
    }

    const exchangeInput = {
      code: outcome.code,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-replay-code"
    };

    await expect(exchangeAffiliateAuthorizationCode(exchangeInput)).resolves.toBeDefined();
    await expect(exchangeAffiliateAuthorizationCode(exchangeInput)).rejects.toThrow(/already been used/i);
  });

  it("9. denies an expired authorization code", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("expired-code");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-expired-code"
    });

    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, request.challenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });
    if (outcome.outcome !== "approved") {
      throw new Error("expected approved outcome");
    }

    const storeState = JSON.parse(await fs.readFile(runtimeStatePath, "utf8")) as {
      affiliate_authorization_codes: Array<{ expires_at: string }>;
    };
    storeState.affiliate_authorization_codes[0].expires_at = "2020-01-01T00:00:00.000Z";
    await fs.writeFile(runtimeStatePath, JSON.stringify(storeState, null, 2), "utf8");

    await expect(
      exchangeAffiliateAuthorizationCode({
        code: outcome.code,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        state: "state-expired-code"
      })
    ).rejects.toThrow(/expired/i);
  });

  it("10. treats user cancellation as an explicit, distinguishable denial", async () => {
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-cancelled"
    });

    const outcome = await denyAffiliateChallenge({ requestId: request.request_id, reason: "cancelled" });
    expect(outcome.outcome).toBe("denied");
    if (outcome.outcome === "denied") {
      expect(outcome.reason).toBe("cancelled");
    }
  });

  it("11. rejects a malformed authorize request cleanly", async () => {
    await expect(
      createAffiliateAuthorizationRequest({ clientId: "", redirectUri: REDIRECT_URI, state: "s" })
    ).rejects.toBeInstanceOf(AffiliateRequestError);

    await expect(
      createAffiliateAuthorizationRequest({ clientId: CLIENT_ID, redirectUri: REDIRECT_URI, state: "" })
    ).rejects.toBeInstanceOf(AffiliateRequestError);
  });

  it("12. rejects an unregistered redirect_uri", async () => {
    await expect(
      createAffiliateAuthorizationRequest({
        clientId: CLIENT_ID,
        redirectUri: "https://evil.example/steal-the-result",
        state: "state-bad-redirect"
      })
    ).rejects.toThrow(/redirect_uri is not registered/i);
  });

  it("13. never returns identity, credential, or reusable-identifier fields in the affiliate result", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("redaction");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-redaction"
    });

    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, request.challenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });
    if (outcome.outcome !== "approved") {
      throw new Error("expected approved outcome");
    }

    const result = await exchangeAffiliateAuthorizationCode({
      code: outcome.code,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-redaction"
    });

    expect(Object.keys(result).sort()).toEqual(
      ["age_over", "assurance", "expires_at", "threshold", "verification_id", "verified_at"].sort()
    );
    // The verification_id must not double as the logical credential ID —
    // it cannot be used to correlate this visit with the pass itself.
    expect(result.verification_id).not.toBe(credential.payload.credential_id);
    expect(JSON.stringify(result)).not.toMatch(/Tester|1995-01-01|Demo Street|subject_public_key|zignature/i);
  });

  it("14. safely handles hostile/XSS-like state values without executing or corrupting them", async () => {
    const hostileState = '<script>alert("x")</script>';
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: hostileState
    });

    expect(request.state).toBe(hostileState);

    const outcome = await denyAffiliateChallenge({ requestId: request.request_id, reason: "cancelled" });
    expect(outcome.state).toBe(hostileState);

    await expect(
      createAffiliateAuthorizationRequest({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        state: "x".repeat(10_000)
      })
    ).rejects.toBeInstanceOf(AffiliateRequestError);
  });

  it("rejects a token exchange whose state does not match the original request", async () => {
    const { credential, holderKeys } = await issueRealTestCredential("wrong-state");
    const request = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-original"
    });

    const bundle = await buildValidBundle(credential, holderKeys.privateKeyJwk, request.challenge);
    const outcome = await completeAffiliateChallenge({ requestId: request.request_id, presentationBundle: bundle });
    if (outcome.outcome !== "approved") {
      throw new Error("expected approved outcome");
    }

    await expect(
      exchangeAffiliateAuthorizationCode({
        code: outcome.code,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        state: "state-tampered"
      })
    ).rejects.toThrow(/state/i);
  });

  it("15. does not create duplicate verification records for a repeated authorize request", async () => {
    const first = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-idempotent"
    });
    const second = await createAffiliateAuthorizationRequest({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      state: "state-idempotent"
    });

    expect(second.request_id).toBe(first.request_id);
    expect(second.challenge).toBe(first.challenge);
  });
});
