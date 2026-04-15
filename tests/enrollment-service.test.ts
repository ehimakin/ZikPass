import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  advanceCoolingOff,
  retryEnrollmentProviders,
  startEnrollment,
  verifyPossessionCode
} from "@/lib/server/enrollment-service";

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
  await fs.writeFile(runtimeStatePath, JSON.stringify({ enrollments: [] }, null, 2), "utf8");

  if (!(await fileExists(issuerKeyPath))) {
    return;
  }

  await fs.rm(issuerKeyPath);
}

describe.sequential("enrollment service orchestration", () => {
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

  it("walks a clean application through bank verification and issuance", async () => {
    const enrollment = await startEnrollment({
      application: {
        identity_match: {
          first_name: "Alice",
          last_name: "Example",
          date_of_birth: "1995-01-01",
          current_home_address: "10 High Street"
        },
        bank_name: "Monzo",
        submitted_at: "2026-04-14T10:00:00.000Z",
        demo_scenario: "clean_adult_match"
      },
      holderPublicKey,
      applicationFingerprint: "fingerprint-clean"
    });

    expect(enrollment.status).toBe("bank_verification_pending");
    expect(enrollment.providers.financial_check.normalized_response?.outcome).toBe(
      "match_high_confidence"
    );
    expect(enrollment.providers.cop.normalized_response?.outcome).toBe("full_match");
    expect(enrollment.bank_verification.transaction_status).toBe("sent");

    const confirmed = await verifyPossessionCode(enrollment.id, enrollment.bank_verification.code);

    expect(confirmed.status).toBe("approved_with_cooling_off");
    expect(confirmed.bank_verification.transaction_status).toBe("confirmed");
    expect(confirmed.risk_decision.state).toBe("approved");

    const issued = await advanceCoolingOff(enrollment.id);

    expect(issued.status).toBe("issued");
    expect(issued.issued_credential?.payload.over18).toBe(true);
    expect(issued.orchestration.stage).toBe("credential_returned");
  });

  it("holds manual-review scenarios instead of issuing automatically", async () => {
    const enrollment = await startEnrollment({
      application: {
        identity_match: {
          first_name: "Jamie",
          last_name: "Review",
          date_of_birth: "1997-05-05",
          current_home_address: "20 Review Road"
        },
        bank_name: "Monzo",
        submitted_at: "2026-04-14T10:00:00.000Z",
        demo_scenario: "manual_review_required"
      },
      holderPublicKey,
      applicationFingerprint: "fingerprint-review"
    });

    expect(enrollment.status).toBe("manual_review_required");
    expect(enrollment.risk_decision.requires_manual_review).toBe(true);
    expect(enrollment.issued_credential).toBeUndefined();
  });

  it("allows retrying transient provider failures", async () => {
    const enrollment = await startEnrollment({
      application: {
        identity_match: {
          first_name: "Taylor",
          last_name: "Timeout",
          date_of_birth: "1993-03-03",
          current_home_address: "30 Retry Street"
        },
        bank_name: "Monzo",
        submitted_at: "2026-04-14T10:00:00.000Z",
        demo_scenario: "provider_timeout"
      },
      holderPublicKey,
      applicationFingerprint: "fingerprint-timeout"
    });

    expect(enrollment.status).toBe("retry_provider_failure");
    expect(enrollment.last_retryable_error?.code).toBe("timeout");

    const retried = await retryEnrollmentProviders(enrollment.id);

    expect(retried.status).toBe("bank_verification_pending");
    expect(retried.providers.financial_check.normalized_response?.outcome).toBe(
      "match_high_confidence"
    );
  });
});
