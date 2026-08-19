import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { advanceCoolingOff, startEnrollment } from "@/lib/server/enrollment-service";
import {
  authorizeDeviceBinding,
  authorizeDeviceBindingOrThrow,
  getDeviceBindings,
  PaymentRequiredError
} from "@/lib/server/device-bindings";
import { claimNativeAppHandoff, createNativeAppHandoff } from "@/lib/server/mobile-handoff";
import { confirmOnlineDemoPayment, createPaymentRecord } from "@/lib/server/payments";
import { getIssuerKeyPath, getRuntimeStatePath } from "@/lib/server/runtime-paths";

const runtimeStatePath = getRuntimeStatePath();
const issuerKeyPath = getIssuerKeyPath();

function keyFor(seed: number): JsonWebKey {
  return {
    key_ops: ["verify"],
    ext: true,
    crv: "Ed25519",
    kty: "OKP",
    x: Buffer.alloc(32, seed).toString("base64url")
  };
}

const primaryKey = keyFor(1);

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

async function issueTestCredential(fingerprint: string) {
  const enrollment = await startEnrollment({
    application: {
      identity_match: {
        first_name: "Devi",
        last_name: "Ces",
        date_of_birth: "1995-01-01",
        current_home_address: "1 Ledger Street"
      },
      bank_name: "Monzo",
      submitted_at: "2026-04-14T10:00:00.000Z",
      demo_scenario: "clean_adult_match"
    },
    holderPublicKey: primaryKey,
    applicationFingerprint: fingerprint
  });

  const confirmed = await import("@/lib/server/enrollment-service").then((mod) =>
    mod.verifyPossessionCode(enrollment.id, enrollment.bank_verification.code)
  );
  expect(confirmed.status).toBe("approved_with_cooling_off");

  return advanceCoolingOff(enrollment.id);
}

let originalRuntimeState: string | null = null;
let originalIssuerKey: string | null = null;

describe.sequential("device binding ledger", () => {
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

  it("creates exactly one primary binding at issuance, using the enrollment holder key", async () => {
    const issued = await issueTestCredential("binding-primary-1");
    const bindings = await getDeviceBindings(issued.id);

    expect(bindings).toHaveLength(1);
    expect(bindings[0].is_primary).toBe(true);
    expect(bindings[0].status).toBe("active");
    expect(bindings[0].holder_public_key.x).toBe(primaryKey.x);
  });

  it("authorizes a second device and treats a repeat claim with the same key as idempotent", async () => {
    const issued = await issueTestCredential("binding-second-1");
    const secondKey = keyFor(2);

    const first = await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: secondKey });
    expect(first.outcome).toBe("authorized");

    const replay = await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: secondKey });
    expect(replay.outcome).toBe("existing");
    if (replay.outcome === "existing" && first.outcome === "authorized") {
      expect(replay.binding.binding_id).toBe(first.binding.binding_id);
    }

    const bindings = await getDeviceBindings(issued.id);
    expect(bindings.filter((binding) => binding.status === "active")).toHaveLength(2);
  });

  it("blocks a third device with payment_required and unblocks it once a demo payment is confirmed", async () => {
    const issued = await issueTestCredential("binding-third-1");
    await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: keyFor(2) });

    const thirdKey = keyFor(3);
    const blocked = await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: thirdKey });
    expect(blocked.outcome).toBe("payment_required");
    if (blocked.outcome === "payment_required") {
      expect(blocked.device_limit).toBe(2);
      expect(blocked.active_count).toBe(2);
    }

    await expect(
      authorizeDeviceBindingOrThrow({ enrollmentId: issued.id, holderPublicKey: thirdKey })
    ).rejects.toBeInstanceOf(PaymentRequiredError);

    const payment = await createPaymentRecord({
      enrollmentId: issued.id,
      purpose: "device_extension",
      method: "online_demo"
    });
    const confirmed = await confirmOnlineDemoPayment({ paymentId: payment.payment_id });
    expect(confirmed.status).toBe("confirmed");

    const unlocked = await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: thirdKey });
    expect(unlocked.outcome).toBe("authorized_via_payment");
    if (unlocked.outcome === "authorized_via_payment") {
      expect(unlocked.binding.entitlement_payment_id).toBe(payment.payment_id);
    }

    // The same confirmed payment cannot unlock a fourth device.
    const fourthBlocked = await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: keyFor(4) });
    expect(fourthBlocked.outcome).toBe("payment_required");
  });

  it("does not create duplicate bindings under concurrent claims for the same new key", async () => {
    const issued = await issueTestCredential("binding-concurrency-1");
    const secondKey = keyFor(2);

    const [first, second] = await Promise.all([
      authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: secondKey }),
      authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: secondKey })
    ]);

    const outcomes = [first.outcome, second.outcome].sort();
    // Either both observe the same binding ("existing" beats a duplicate
    // "authorized"), or one creates it and the other replays it — never two
    // independent authorized bindings for the same key.
    expect(outcomes).not.toEqual(["authorized", "authorized"]);

    const bindings = await getDeviceBindings(issued.id);
    const activeSecondDeviceBindings = bindings.filter(
      (binding) => binding.status === "active" && binding.holder_public_key.x === secondKey.x
    );
    expect(activeSecondDeviceBindings).toHaveLength(1);
  });

  it("gates the native app handoff claim behind the same device-binding policy", async () => {
    const issued = await issueTestCredential("binding-handoff-1");
    await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: keyFor(2) });

    const handoff = await createNativeAppHandoff(issued.id);
    await expect(
      claimNativeAppHandoff({ token: handoff.token, holderPublicKey: keyFor(3) })
    ).rejects.toThrow(/payment/i);
  });

  it("does not damage the existing pass when a device-extension payment fails", async () => {
    const issued = await issueTestCredential("binding-fail-1");
    await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: keyFor(2) });

    const payment = await createPaymentRecord({
      enrollmentId: issued.id,
      purpose: "device_extension",
      method: "online_demo"
    });
    const failed = await confirmOnlineDemoPayment({ paymentId: payment.payment_id, simulateFailure: true });
    expect(failed.status).toBe("failed");

    const stillBlocked = await authorizeDeviceBinding({ enrollmentId: issued.id, holderPublicKey: keyFor(3) });
    expect(stillBlocked.outcome).toBe("payment_required");

    const bindings = await getDeviceBindings(issued.id);
    expect(bindings.filter((binding) => binding.status === "active")).toHaveLength(2);
  });
});
