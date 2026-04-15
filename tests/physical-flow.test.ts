import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApplicationFingerprint } from "@/lib/server/application-guard";
import {
  completePhysicalDeviceAuth,
  createPhysicalStoreSession,
  issueEnrollmentCredential,
  lookupPhysicalStoreSessionByCode,
  startEnrollment,
  startPhysicalDeviceAuth,
  verifyPhysicalIdCheck
} from "@/lib/server/enrollment-service";
import {
  formatAssuranceLevel,
  getCredentialExperienceVariant,
  parseWalletEntryContext
} from "@/lib/shared/physical-flow";

const runtimeStatePath = path.join(process.cwd(), "data", "runtime-state.json");
const issuerKeyPath = path.join(process.cwd(), "data", "issuer-keypair.json");

const holderPublicKey: JsonWebKey = {
  key_ops: ["verify"],
  ext: true,
  crv: "Ed25519",
  kty: "OKP",
  x: "demo-public-key"
};

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

  it("issues an in-person verified credential only after clerk and device auth complete", async () => {
    const session = await createPhysicalStoreSession({
      storeId: "store_1",
      storeName: "Zik Oxford Street",
      locationId: "desk_1"
    });

    const fingerprint = buildApplicationFingerprint({
      first_name: "Morgan",
      last_name: "Retail",
      date_of_birth: "1994-01-01",
      current_home_address: "10 High Street"
    });

    const enrollment = await startEnrollment({
      application: {
        identity_match: {
          first_name: "Morgan",
          last_name: "Retail",
          date_of_birth: "1994-01-01",
          current_home_address: "10 High Street"
        },
        bank_name: "In-store verification",
        submitted_at: "2026-04-15T10:00:00.000Z",
        lane: "physical",
        physical_context: {
          session_id: session.session_id,
          store_id: session.store_id,
          store_name: session.store_name,
          location_id: session.location_id
        }
      },
      holderPublicKey,
      applicationFingerprint: fingerprint
    });

    expect(enrollment.lane).toBe("physical");
    expect(enrollment.status).toBe("physical_verification_pending");
    expect(enrollment.physical_verification?.user_code.value).toHaveLength(6);
    expect(enrollment.assurance_level).toBe("in_person_verified");
    expect(enrollment.issuance_channel).toBe("physical");

    await expect(issueEnrollmentCredential(enrollment.id)).rejects.toThrow(
      /not yet eligible/i
    );

    const clerkConfirmed = await verifyPhysicalIdCheck({
      userCode: enrollment.physical_verification?.user_code.value ?? ""
    });

    expect(clerkConfirmed.status).toBe("device_auth_pending");
    expect(clerkConfirmed.physical_verification?.clerk_verification.status).toBe("verified");

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
  });

  it("rejects stale or replayed physical sessions", async () => {
    const session = await createPhysicalStoreSession({
      storeId: "store_1",
      storeName: "Zik Oxford Street",
      locationId: "desk_1"
    });

    const fingerprint = buildApplicationFingerprint({
      first_name: "Robin",
      last_name: "Replay",
      date_of_birth: "1992-06-06",
      current_home_address: "20 High Street"
    });

    const firstEnrollment = await startEnrollment({
      application: {
        identity_match: {
          first_name: "Robin",
          last_name: "Replay",
          date_of_birth: "1992-06-06",
          current_home_address: "20 High Street"
        },
        bank_name: "In-store verification",
        submitted_at: "2026-04-15T10:00:00.000Z",
        lane: "physical",
        physical_context: {
          session_id: session.session_id,
          store_id: session.store_id,
          store_name: session.store_name,
          location_id: session.location_id
        }
      },
      holderPublicKey,
      applicationFingerprint: fingerprint
    });

    await expect(
      startEnrollment({
        application: {
          identity_match: {
            first_name: "Robin",
            last_name: "Replay",
            date_of_birth: "1992-06-06",
            current_home_address: "20 High Street"
          },
          bank_name: "In-store verification",
          submitted_at: "2026-04-15T10:01:00.000Z",
          lane: "physical",
          physical_context: {
            session_id: session.session_id,
            store_id: session.store_id,
            store_name: session.store_name,
            location_id: session.location_id
          }
        },
        holderPublicKey,
        applicationFingerprint: fingerprint + "-second"
      })
    ).rejects.toThrow(/already been used/i);

    const lookedUp = await lookupPhysicalStoreSessionByCode(
      firstEnrollment.physical_verification?.user_code.value ?? ""
    );
    expect(lookedUp.enrollment_id).toBe(firstEnrollment.id);

    await verifyPhysicalIdCheck({
      userCode: firstEnrollment.physical_verification?.user_code.value ?? ""
    });

    await expect(
      verifyPhysicalIdCheck({
        userCode: firstEnrollment.physical_verification?.user_code.value ?? ""
      })
    ).rejects.toThrow(/already been confirmed/i);
  });

  it("rejects an expired store session before physical enrollment starts", async () => {
    const session = await createPhysicalStoreSession({
      storeId: "store_1",
      storeName: "Zik Oxford Street",
      locationId: "desk_1"
    });

    const storeState = JSON.parse(await fs.readFile(runtimeStatePath, "utf8")) as {
      physical_sessions: PhysicalStoreSessionRecord[];
    };
    storeState.physical_sessions[0].expires_at = "2020-01-01T00:00:00.000Z";
    await fs.writeFile(runtimeStatePath, JSON.stringify(storeState, null, 2), "utf8");

    await expect(
      startEnrollment({
        application: {
          identity_match: {
            first_name: "Expired",
            last_name: "Session",
            date_of_birth: "1990-01-01",
            current_home_address: "1 Expiry Road"
          },
          bank_name: "In-store verification",
          submitted_at: "2026-04-15T10:00:00.000Z",
          lane: "physical",
          physical_context: {
            session_id: session.session_id,
            store_id: session.store_id,
            store_name: session.store_name,
            location_id: session.location_id
          }
        },
        holderPublicKey,
        applicationFingerprint: "expired-session-fingerprint"
      })
    ).rejects.toThrow(/expired/i);
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
});
