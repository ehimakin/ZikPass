import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPhysicalApplicationFingerprint } from "@/lib/server/application-guard";
import {
  completePhysicalDeviceAuth,
  createPhysicalStoreSession,
  getEnrollmentOrThrow,
  issueEnrollmentCredential,
  lookupPhysicalStoreSessionByCode,
  rejectPhysicalIdCheck,
  startEnrollment,
  startPhysicalDeviceAuth,
  touchPhysicalStoreSession,
  verifyPhysicalIdCheck
} from "@/lib/server/enrollment-service";
import { claimNativeAppHandoff, createNativeAppHandoff } from "@/lib/server/mobile-handoff";
import { getIssuerKeyPath, getRuntimeStatePath } from "@/lib/server/runtime-paths";
import {
  ZIK_APP_DOWNLOAD_URL,
  buildAffiliateOnboardingUrl,
  buildAppOnboardingUrl,
  buildRetailVerificationScanUrl,
  buildZikAppDeepLink,
  formatAssuranceLevel,
  getCredentialExperienceVariant,
  getOnboardingEntryMode,
  getPhysicalProcessState,
  isRetailVerificationCodeReady,
  parseRetailVerificationCode,
  parseWalletEntryContext
} from "@/lib/shared/physical-flow";
import {
  PHYSICAL_CUSTOMER_PAUSE_THRESHOLD_MS,
  derivePhysicalVerificationStatus,
  isPhysicalCustomerPaused,
  isPhysicalStoreSessionExpired,
  isPhysicalVerificationSessionUsable
} from "@/lib/shared/physical-journey";
import type { PhysicalStoreSessionRecord } from "@/lib/shared/types";

const runtimeStatePath = getRuntimeStatePath();
const issuerKeyPath = getIssuerKeyPath();

const holderPublicKey: JsonWebKey = {
  key_ops: ["verify"],
  ext: true,
  crv: "Ed25519",
  kty: "OKP",
  x: "demo-public-key"
};
const nativeHolderPublicKey: JsonWebKey = {
  key_ops: ["verify"],
  ext: true,
  crv: "Ed25519",
  kty: "OKP",
  x: Buffer.alloc(32, 7).toString("base64url")
};
const verifierToken = "demo-retail-terminal";

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
  await fs.writeFile(
    runtimeStatePath,
    JSON.stringify({ enrollments: [], physical_sessions: [] }, null, 2),
    "utf8"
  );

  if (!(await fileExists(issuerKeyPath))) {
    return;
  }

  await fs.rm(issuerKeyPath);
}

function physicalApplication(session: PhysicalStoreSessionRecord, submittedAt: string) {
  return {
    bank_name: "In-store verification",
    submitted_at: submittedAt,
    lane: "physical" as const,
    physical_context: {
      session_id: session.session_id,
      store_id: session.store_id,
      store_name: session.store_name,
      location_id: session.location_id
    }
  };
}

function physicalFingerprint(
  session: PhysicalStoreSessionRecord,
  key: JsonWebKey = holderPublicKey
): string {
  return buildPhysicalApplicationFingerprint({
    sessionId: session.session_id,
    holderPublicKey: key
  });
}

describe.sequential("physical flow", () => {
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

  it("parses a physical QR wallet entry context", () => {
    const params = new URLSearchParams({
      flow: "physical",
      store_id: "store_1",
      store_name: "Zik Oxford Street",
      location_id: "desk_1",
      session_id: "store_abcd1234"
    });

    expect(parseWalletEntryContext(params)).toEqual({
      lane: "physical",
      store_id: "store_1",
      store_name: "Zik Oxford Street",
      location_id: "desk_1",
      session_id: "store_abcd1234"
    });
  });

  it("parses a generic retail-card wallet entry without a unique card or session id", () => {
    const params = new URLSearchParams({
      flow: "physical",
      store_id: "zik-london-001",
      store_name: "Zik Oxford Street",
      location_id: "front-desk"
    });

    expect(parseWalletEntryContext(params)).toEqual({
      lane: "physical",
      store_id: "zik-london-001",
      store_name: "Zik Oxford Street",
      location_id: "front-desk",
      session_id: undefined
    });
  });

  it("treats the plain wallet route as the physical-first entry", () => {
    expect(parseWalletEntryContext(new URLSearchParams())).toEqual({
      lane: "physical",
      session_id: undefined,
      store_id: undefined,
      store_name: undefined,
      location_id: undefined
    });

    expect(parseWalletEntryContext(new URLSearchParams({ flow: "remote" }))).toEqual({
      lane: "remote"
    });
  });

  it("keeps app onboarding store-unspecified and makes affiliate onboarding explicit", () => {
    expect(getOnboardingEntryMode(new URLSearchParams({ source: "app" }))).toBe("app");
    expect(getOnboardingEntryMode(new URLSearchParams({ flow: "physical" }))).toBe("app");
    expect(
      getOnboardingEntryMode(
        new URLSearchParams({ source: "affiliate", store_id: "store_1" })
      )
    ).toBe("affiliate");

    expect(buildAppOnboardingUrl()).toBe("/onboarding?source=app");
    expect(
      buildAffiliateOnboardingUrl({
        store_id: "store_1",
        store_name: "Zik Oxford Street",
        location_id: "desk_1"
      })
    ).toBe(
      "/onboarding?source=affiliate&flow=physical&store_id=store_1&store_name=Zik+Oxford+Street&location_id=desk_1"
    );
  });

  it("issues an in-person verified credential only after clerk and device auth complete", async () => {
    const session = await createPhysicalStoreSession({
      storeId: "zik-london-001",
      storeName: "Zik Oxford Street",
      locationId: "front-desk"
    });

    const enrollment = await startEnrollment({
      application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
      holderPublicKey,
      applicationFingerprint: physicalFingerprint(session)
    });

    expect(enrollment.lane).toBe("physical");
    expect(enrollment.status).toBe("physical_verification_pending");
    expect(enrollment.physical_verification?.user_code.value).toHaveLength(6);
    expect(enrollment.application.identity_match).toBeUndefined();
    expect(enrollment.assurance_level).toBe("in_person_verified");
    expect(enrollment.issuance_channel).toBe("physical");

    await expect(issueEnrollmentCredential(enrollment.id)).rejects.toThrow(
      /not yet eligible/i
    );

    const clerkConfirmed = await verifyPhysicalIdCheck({
      userCode: enrollment.physical_verification?.user_code.value ?? "",
      verifierToken
    });

    expect(clerkConfirmed.status).toBe("device_auth_pending");
    expect(clerkConfirmed.physical_verification?.clerk_verification.status).toBe("verified");
    expect(clerkConfirmed.physical_verification?.attestation).toMatchObject({
      over_18: true,
      verification_method: "physical_id_check",
      verifier_id: "demo-clerk-terminal-001"
    });

    const authStart = await startPhysicalDeviceAuth(enrollment.id);
    expect(authStart.challenge_id).toMatch(/^deviceauth_/);

    const issued = await completePhysicalDeviceAuth({
      enrollmentId: enrollment.id,
      challengeId: authStart.challenge_id,
      method: "demo_device_check"
    });

    expect(issued.status).toBe("issued");
    expect(issued.issued_credential?.payload.assurance_level).toBe("in_person_verified");
    expect(issued.issued_credential?.payload.issuance_channel).toBe("physical");
    expect(issued.issued_credential?.payload.verification_method).toBe("physical_id_check");
    expect(issued.issued_credential?.payload.physical_attestation).toMatchObject({
      session_id: session.session_id,
      verification_method: "physical_id_check",
      verifier_id: "demo-clerk-terminal-001"
    });
    expect(JSON.stringify(issued.issued_credential?.payload)).not.toMatch(
      /Morgan|1994|High Street|date_of_birth|first_name|last_name|current_home_address/i
    );
  });

  it("keeps the post-clerk flow resumable after the customer code expires", async () => {
    const session = await createPhysicalStoreSession();
    const enrollment = await startEnrollment({
      application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
      holderPublicKey,
      applicationFingerprint: physicalFingerprint(session)
    });

    const clerkConfirmed = await verifyPhysicalIdCheck({
      userCode: enrollment.physical_verification?.user_code.value ?? "",
      verifierToken
    });
    expect(clerkConfirmed.status).toBe("device_auth_pending");

    const storeState = JSON.parse(await fs.readFile(runtimeStatePath, "utf8")) as {
      enrollments: Array<{
        physical_verification?: { user_code: { expires_at: string } };
      }>;
      physical_sessions: Array<{
        user_code_expires_at?: string;
      }>;
    };
    storeState.enrollments[0].physical_verification!.user_code.expires_at =
      "2020-01-01T00:00:00.000Z";
    storeState.physical_sessions[0].user_code_expires_at = "2020-01-01T00:00:00.000Z";
    await fs.writeFile(runtimeStatePath, JSON.stringify(storeState, null, 2), "utf8");

    const authStart = await startPhysicalDeviceAuth(enrollment.id);
    expect(authStart.challenge_id).toMatch(/^deviceauth_/);
  });

  it("replays a completed device handoff when the original response was lost", async () => {
    const session = await createPhysicalStoreSession();
    const enrollment = await startEnrollment({
      application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
      holderPublicKey,
      applicationFingerprint: physicalFingerprint(session)
    });

    await verifyPhysicalIdCheck({
      userCode: enrollment.physical_verification?.user_code.value ?? "",
      verifierToken
    });
    const authStart = await startPhysicalDeviceAuth(enrollment.id);
    const issued = await completePhysicalDeviceAuth({
      enrollmentId: enrollment.id,
      challengeId: authStart.challenge_id,
      method: "demo_device_check"
    });

    const handoff = await createNativeAppHandoff(enrollment.id);
    const firstClaim = await claimNativeAppHandoff({
      token: handoff.token,
      holderPublicKey: nativeHolderPublicKey
    });
    const replayedClaim = await claimNativeAppHandoff({
      token: handoff.token,
      holderPublicKey: nativeHolderPublicKey
    });

    expect(firstClaim.payload.credential_id).toBe(issued.issued_credential?.payload.credential_id);
    expect(firstClaim.payload.subject_public_key).toEqual(nativeHolderPublicKey);
    expect(replayedClaim).toEqual(firstClaim);
    await expect(
      claimNativeAppHandoff({
        token: handoff.token,
        holderPublicKey: { ...nativeHolderPublicKey, x: Buffer.alloc(32, 8).toString("base64url") }
      })
    ).rejects.toThrow(/already been claimed/i);
  });

  it("records customer presence for clerk recovery visibility", async () => {
    const session = await createPhysicalStoreSession();
    const touched = await touchPhysicalStoreSession(session.session_id);

    expect(touched.customer_last_seen_at).toEqual(expect.any(String));
  });

  it("maps physical sessions to the Version 2.0 process states", async () => {
    const session = await createPhysicalStoreSession({
      storeId: "zik-london-001",
      storeName: "Zik Oxford Street",
      locationId: "front-desk"
    });

    expect(getPhysicalProcessState({ session })).toBe("preparing_challenge");

    const enrollment = await startEnrollment({
      application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
      holderPublicKey,
      applicationFingerprint: physicalFingerprint(session)
    });

    expect(getPhysicalProcessState({ enrollment })).toBe("awaiting_retail_verification");

    const clerkConfirmed = await verifyPhysicalIdCheck({
      userCode: enrollment.physical_verification?.user_code.value ?? "",
      verifierToken
    });

    expect(getPhysicalProcessState({ enrollment: clerkConfirmed })).toBe("verified");

    const authStart = await startPhysicalDeviceAuth(enrollment.id);
    const issued = await completePhysicalDeviceAuth({
      enrollmentId: enrollment.id,
      challengeId: authStart.challenge_id,
      method: "demo_device_check"
    });

    expect(getPhysicalProcessState({ enrollment: issued })).toBe("credential_issued");
  });

  it("builds production-shaped scan and app handoff URLs", () => {
    expect(
      buildRetailVerificationScanUrl({
        userCode: "ab12cd",
        sessionId: "store_demo"
      })
    ).toBe("/verify?code=AB12CD&session_id=store_demo");
    expect(buildZikAppDeepLink({ credentialId: "zp_demo" })).toBe(
      "zik://pass/open?credential_id=zp_demo"
    );
    expect(buildZikAppDeepLink({ enrollmentId: "enroll_demo" })).toBe(
      "zik://pass/open?enrollment_id=enroll_demo"
    );
    expect(ZIK_APP_DOWNLOAD_URL).toBe("https://zik.app/download");
  });

  it("parses clerk-entered codes from short text or scanned URLs", () => {
    expect(parseRetailVerificationCode(" ab12cd ")).toBe("AB12CD");
    expect(parseRetailVerificationCode("http://localhost:3001/verify?code=ab12cd&session_id=store_demo")).toBe(
      "AB12CD"
    );
    expect(parseRetailVerificationCode("/verify?code=xy98pq")).toBe("XY98PQ");
    expect(isRetailVerificationCodeReady("AB12C")).toBe(false);
    expect(isRetailVerificationCodeReady("AB12CD")).toBe(true);
  });

  it("rejects replaying a physical session after store verification has already advanced", async () => {
    const session = await createPhysicalStoreSession({
      storeId: "zik-london-001",
      storeName: "Zik Oxford Street",
      locationId: "front-desk"
    });

    const firstEnrollment = await startEnrollment({
      application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
      holderPublicKey,
      applicationFingerprint: physicalFingerprint(session)
    });

    const lookedUp = await lookupPhysicalStoreSessionByCode(
      firstEnrollment.physical_verification?.user_code.value ?? ""
    );
    expect(lookedUp.enrollment_id).toBe(firstEnrollment.id);

    const clerkConfirmed = await verifyPhysicalIdCheck({
      userCode: firstEnrollment.physical_verification?.user_code.value ?? "",
      verifierToken
    });

    expect(clerkConfirmed.status).toBe("device_auth_pending");

    await expect(
      startEnrollment({
        application: physicalApplication(session, "2026-04-15T10:01:00.000Z"),
        holderPublicKey,
        applicationFingerprint: `${physicalFingerprint(session)}-second`
      })
    ).rejects.toThrow(/already been used/i);

    await expect(
      verifyPhysicalIdCheck({
        userCode: firstEnrollment.physical_verification?.user_code.value ?? "",
        verifierToken
      })
    ).rejects.toThrow(/already been confirmed/i);
  });

  it("allows restarting the same unverified physical session after local device state is cleared", async () => {
    const session = await createPhysicalStoreSession({
      storeId: "zik-london-001",
      storeName: "Zik Oxford Street",
      locationId: "front-desk"
    });

    const firstEnrollment = await startEnrollment({
      application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
      holderPublicKey,
      applicationFingerprint: "restart-fingerprint-1"
    });

    const replacementKey = {
      ...holderPublicKey,
      x: "replacement-public-key"
    };
    const restarted = await startEnrollment({
      application: physicalApplication(session, "2026-04-15T10:01:00.000Z"),
      holderPublicKey: replacementKey,
      applicationFingerprint: "restart-fingerprint-2"
    });

    expect(restarted.id).toBe(firstEnrollment.id);
    expect(restarted.status).toBe("physical_verification_pending");
    expect(restarted.holder_public_key.x).toBe("replacement-public-key");
    expect(restarted.application_fingerprint).toBe("restart-fingerprint-2");
    expect(restarted.physical_verification?.user_code.value).not.toBe(
      firstEnrollment.physical_verification?.user_code.value
    );
  });

  it("rejects an expired store session before physical enrollment starts", async () => {
    const session = await createPhysicalStoreSession({
      storeId: "zik-london-001",
      storeName: "Zik Oxford Street",
      locationId: "front-desk"
    });

    const storeState = JSON.parse(await fs.readFile(runtimeStatePath, "utf8")) as {
      physical_sessions: PhysicalStoreSessionRecord[];
    };
    storeState.physical_sessions[0].expires_at = "2020-01-01T00:00:00.000Z";
    await fs.writeFile(runtimeStatePath, JSON.stringify(storeState, null, 2), "utf8");

    await expect(
      startEnrollment({
        application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
        holderPublicKey,
        applicationFingerprint: "expired-session-fingerprint"
      })
    ).rejects.toThrow(/expired/i);
  });

  it("rejects unauthorised verifier confirmation and supports explicit staff rejection", async () => {
    const session = await createPhysicalStoreSession();
    const enrollment = await startEnrollment({
      application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
      holderPublicKey,
      applicationFingerprint: physicalFingerprint(session)
    });

    await expect(
      verifyPhysicalIdCheck({
        userCode: enrollment.physical_verification?.user_code.value ?? "",
        verifierToken: "wrong-token"
      })
    ).rejects.toThrow(/authorised retail verifier/i);

    const rejected = await rejectPhysicalIdCheck({
      userCode: enrollment.physical_verification?.user_code.value ?? "",
      verifierToken
    });

    expect(rejected.status).toBe("declined_physical_verification");
    expect(rejected.physical_verification?.status).toBe("rejected");
    await expect(issueEnrollmentCredential(enrollment.id)).rejects.toThrow(/not yet eligible/i);
  });

  it("formats assurance and experience labels for wallet rendering", () => {
    expect(formatAssuranceLevel("remote_standard")).toBe("Remote standard");
    expect(formatAssuranceLevel("in_person_verified")).toBe("In-person verified");
    expect(
      getCredentialExperienceVariant({
        assurance_level: "in_person_verified",
        issuance_channel: "physical"
      })
    ).toBe("physical");
  });

  describe("Sprint 7 physical journey characterization", () => {
    it("keeps a session usable once the customer code expires after clerk confirmation, but not before", async () => {
      const session = await createPhysicalStoreSession();
      const enrollment = await startEnrollment({
        application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
        holderPublicKey,
        applicationFingerprint: physicalFingerprint(session)
      });

      const clerkConfirmed = await verifyPhysicalIdCheck({
        userCode: enrollment.physical_verification?.user_code.value ?? "",
        verifierToken
      });
      expect(clerkConfirmed.status).toBe("device_auth_pending");

      const storeState = JSON.parse(await fs.readFile(runtimeStatePath, "utf8")) as {
        enrollments: Array<{ physical_verification: { user_code: { expires_at: string } } }>;
        physical_sessions: Array<{ user_code_expires_at?: string }>;
      };
      storeState.enrollments[0].physical_verification.user_code.expires_at =
        "2020-01-01T00:00:00.000Z";
      storeState.physical_sessions[0].user_code_expires_at = "2020-01-01T00:00:00.000Z";
      await fs.writeFile(runtimeStatePath, JSON.stringify(storeState, null, 2), "utf8");

      const authStart = await startPhysicalDeviceAuth(enrollment.id);
      expect(authStart.challenge_id).toMatch(/^deviceauth_/);

      expect(
        isPhysicalVerificationSessionUsable({
          sessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          userCodeExpiresAt: "2020-01-01T00:00:00.000Z",
          clerkVerificationStatus: "verified"
        })
      ).toBe(true);

      expect(
        isPhysicalVerificationSessionUsable({
          sessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          userCodeExpiresAt: "2020-01-01T00:00:00.000Z",
          clerkVerificationStatus: "pending"
        })
      ).toBe(false);
    });

    it("derives a paused heartbeat once the customer device has gone stale beyond the clerk-screen threshold", async () => {
      const now = Date.now();

      expect(
        isPhysicalCustomerPaused({ customerLastSeenAt: new Date(now - 1_000).toISOString() }, now)
      ).toBe(false);

      expect(
        isPhysicalCustomerPaused(
          { customerLastSeenAt: new Date(now - PHYSICAL_CUSTOMER_PAUSE_THRESHOLD_MS - 1).toISOString() },
          now
        )
      ).toBe(true);

      expect(isPhysicalCustomerPaused({ customerLastSeenAt: undefined }, now)).toBe(false);

      const session = await createPhysicalStoreSession();
      const touched = await touchPhysicalStoreSession(session.session_id);
      expect(
        isPhysicalCustomerPaused({ customerLastSeenAt: touched.customer_last_seen_at })
      ).toBe(false);
    });

    it("marks a session expired mid-flow, before clerk verification ever completes", async () => {
      const session = await createPhysicalStoreSession({
        storeId: "zik-london-001",
        storeName: "Zik Oxford Street",
        locationId: "front-desk"
      });
      const enrollment = await startEnrollment({
        application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
        holderPublicKey,
        applicationFingerprint: physicalFingerprint(session)
      });

      expect(isPhysicalStoreSessionExpired(session)).toBe(false);
      expect(enrollment.status).toBe("physical_verification_pending");

      const storeState = JSON.parse(await fs.readFile(runtimeStatePath, "utf8")) as {
        physical_sessions: PhysicalStoreSessionRecord[];
      };
      storeState.physical_sessions[0].expires_at = "2020-01-01T00:00:00.000Z";
      await fs.writeFile(runtimeStatePath, JSON.stringify(storeState, null, 2), "utf8");

      // getEnrollmentOrThrow re-derives the linked session via
      // getPhysicalStoreSessionOrThrow, which always throws for an expired
      // session (its exclusion list only covers completed/rejected/cancelled).
      // The enrollment sync that runs first still persists the correct
      // "verification_session_expired" status before that throw happens.
      await expect(getEnrollmentOrThrow(enrollment.id)).rejects.toThrow(/expired/i);

      const persistedState = JSON.parse(await fs.readFile(runtimeStatePath, "utf8")) as {
        enrollments: Array<{ status: string; physical_verification?: { status: string } }>;
      };
      expect(persistedState.enrollments[0].status).toBe("verification_session_expired");
      expect(persistedState.enrollments[0].physical_verification?.status).toBe("expired");

      await expect(
        verifyPhysicalIdCheck({
          userCode: enrollment.physical_verification?.user_code.value ?? "",
          verifierToken
        })
      ).rejects.toThrow(/expired/i);
    });

    it("derives a rejected verification status once staff decline the in-person ID check", async () => {
      const session = await createPhysicalStoreSession();
      const enrollment = await startEnrollment({
        application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
        holderPublicKey,
        applicationFingerprint: physicalFingerprint(session)
      });

      const rejected = await rejectPhysicalIdCheck({
        userCode: enrollment.physical_verification?.user_code.value ?? "",
        verifierToken
      });

      expect(rejected.status).toBe("declined_physical_verification");
      expect(rejected.physical_verification?.status).toBe("rejected");

      expect(
        derivePhysicalVerificationStatus({
          status: "rejected",
          clerk_verification: { status: "rejected" },
          device_auth: { status: "pending" }
        })
      ).toBe("rejected");

      expect(
        derivePhysicalVerificationStatus({
          status: "claimed",
          clerk_verification: { status: "rejected" },
          device_auth: { status: "pending" }
        })
      ).toBe("rejected");
    });

    it("replays an idempotent app handoff claim without minting a second credential (device binding unchanged by this slice)", async () => {
      const session = await createPhysicalStoreSession();
      const enrollment = await startEnrollment({
        application: physicalApplication(session, "2026-04-15T10:00:00.000Z"),
        holderPublicKey,
        applicationFingerprint: physicalFingerprint(session)
      });

      await verifyPhysicalIdCheck({
        userCode: enrollment.physical_verification?.user_code.value ?? "",
        verifierToken
      });
      const authStart = await startPhysicalDeviceAuth(enrollment.id);
      await completePhysicalDeviceAuth({
        enrollmentId: enrollment.id,
        challengeId: authStart.challenge_id,
        method: "demo_device_check"
      });

      const handoff = await createNativeAppHandoff(enrollment.id);
      const firstClaim = await claimNativeAppHandoff({
        token: handoff.token,
        holderPublicKey: nativeHolderPublicKey
      });
      const secondClaim = await claimNativeAppHandoff({
        token: handoff.token,
        holderPublicKey: nativeHolderPublicKey
      });
      const thirdClaim = await claimNativeAppHandoff({
        token: handoff.token,
        holderPublicKey: nativeHolderPublicKey
      });

      expect(secondClaim).toEqual(firstClaim);
      expect(thirdClaim).toEqual(firstClaim);
    });
  });
});
