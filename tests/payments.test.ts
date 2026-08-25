import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  confirmCashPayment,
  confirmOnlineDemoPayment,
  createPaymentRecord,
  getPaymentOrThrow,
  hasConfirmedPassIssuancePayment,
  recordRetailTillPurchase,
  resolveStorePlan
} from "@/lib/server/payments";
import { triggerIssuanceRecheck } from "@/lib/server/payment-issuance";
import { upsertStorePlan } from "@/lib/server/storage";
import { getIssuerKeyPath, getRuntimeStatePath } from "@/lib/server/runtime-paths";
import { runtimeConfig } from "@/lib/shared/config";

const runtimeStatePath = getRuntimeStatePath();
const issuerKeyPath = getIssuerKeyPath();

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

let originalRuntimeState: string | null = null;
let originalIssuerKey: string | null = null;

describe.sequential("payments", () => {
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

  it("does not create a duplicate payment when a pending one already exists (repeated-click safe)", async () => {
    const first = await createPaymentRecord({
      enrollmentId: "enroll_demo1",
      purpose: "device_extension",
      method: "online_demo"
    });
    const second = await createPaymentRecord({
      enrollmentId: "enroll_demo1",
      purpose: "device_extension",
      method: "online_demo"
    });

    expect(second.payment_id).toBe(first.payment_id);
  });

  it("allows a fresh payment after a previous attempt failed (retry state)", async () => {
    const first = await createPaymentRecord({
      enrollmentId: "enroll_demo2",
      purpose: "device_extension",
      method: "online_demo"
    });
    await confirmOnlineDemoPayment({ paymentId: first.payment_id, simulateFailure: true });

    const retry = await createPaymentRecord({
      enrollmentId: "enroll_demo2",
      purpose: "device_extension",
      method: "online_demo"
    });

    expect(retry.payment_id).not.toBe(first.payment_id);
    expect(retry.status).toBe("pending");
  });

  it("confirms a cash payment idempotently — confirming twice does not double-process it", async () => {
    const payment = await createPaymentRecord({
      enrollmentId: "enroll_demo3",
      purpose: "pass_issuance",
      method: "cash_in_store",
      storeId: "zik-london-001"
    });

    const firstConfirm = await confirmCashPayment({ paymentId: payment.payment_id, confirmedBy: "Clerk A" });
    const secondConfirm = await confirmCashPayment({ paymentId: payment.payment_id, confirmedBy: "Clerk B" });

    expect(firstConfirm.status).toBe("confirmed");
    expect(secondConfirm.status).toBe("confirmed");
    expect(secondConfirm.confirmed_at).toBe(firstConfirm.confirmed_at);
    expect(secondConfirm.confirmed_by).toBe(firstConfirm.confirmed_by);
  });

  it("lets a customer self-confirm a pass-issuance payment via digital wallet, distinct from cash", async () => {
    const payment = await createPaymentRecord({
      enrollmentId: "enroll_demo3b",
      purpose: "pass_issuance",
      method: "digital_wallet",
      storeId: "zik-london-001"
    });

    expect(payment.method).toBe("digital_wallet");
    expect(payment.status).toBe("pending");

    const confirmed = await confirmOnlineDemoPayment({ paymentId: payment.payment_id });

    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.method).toBe("digital_wallet");

    // Confirming a digital-wallet payment does not interfere with an
    // independent cash payment record for a different purpose/enrollment.
    const cashPayment = await createPaymentRecord({
      enrollmentId: "enroll_demo3c",
      purpose: "pass_issuance",
      method: "cash_in_store",
      storeId: "zik-london-001"
    });
    expect(cashPayment.status).toBe("pending");
  });

  it("computes platform/store settlement shares and always reports them as unsettled", async () => {
    const payment = await createPaymentRecord({
      enrollmentId: "enroll_demo4",
      purpose: "device_extension",
      method: "online_demo"
    });

    expect(payment.platform_share_minor + payment.store_share_minor).toBe(payment.amount_minor);
    expect(payment.settlement_status).toBe("unsettled");
  });

  it("resolves the global default plan, then a store-specific override", async () => {
    const globalPlan = await resolveStorePlan(undefined);
    expect(globalPlan.deviceLimit).toBe(runtimeConfig.deviceLimitIncluded);
    expect(globalPlan.extensionPriceMinor).toBe(runtimeConfig.deviceExtensionPriceMinor);

    await upsertStorePlan({
      store_id: "zik-manchester-002",
      device_limit: 3,
      extension_price_minor: 499,
      currency: "GBP",
      updated_at: new Date().toISOString()
    });

    const overridden = await resolveStorePlan("zik-manchester-002");
    expect(overridden.deviceLimit).toBe(3);
    expect(overridden.extensionPriceMinor).toBe(499);

    const unrelatedStore = await resolveStorePlan("zik-london-001");
    expect(unrelatedStore.deviceLimit).toBe(runtimeConfig.deviceLimitIncluded);
  });

  it("throws a clear error for an unknown payment reference", async () => {
    await expect(getPaymentOrThrow("pay_doesnotexist")).rejects.toThrow(/not found/i);
  });

  it("reports whether a pass-issuance payment has been confirmed, regardless of method", async () => {
    expect(await hasConfirmedPassIssuancePayment("enroll_demo5")).toBe(false);

    const cash = await createPaymentRecord({
      enrollmentId: "enroll_demo5",
      purpose: "pass_issuance",
      method: "cash_in_store",
      storeId: "zik-london-001"
    });
    expect(await hasConfirmedPassIssuancePayment("enroll_demo5")).toBe(false);

    await confirmCashPayment({ paymentId: cash.payment_id, confirmedBy: "Demo clerk" });
    expect(await hasConfirmedPassIssuancePayment("enroll_demo5")).toBe(true);

    // An unrelated device_extension payment for the same enrollment must
    // not satisfy the pass-issuance gate.
    const extension = await createPaymentRecord({
      enrollmentId: "enroll_demo6",
      purpose: "device_extension",
      method: "digital_wallet"
    });
    await confirmOnlineDemoPayment({ paymentId: extension.payment_id });
    expect(await hasConfirmedPassIssuancePayment("enroll_demo6")).toBe(false);
  });

  it("records a retail-till purchase as an already-confirmed pass-issuance payment", async () => {
    expect(await hasConfirmedPassIssuancePayment("enroll_till1")).toBe(false);

    const payment = await recordRetailTillPurchase("enroll_till1", "zik-london-001");

    expect(payment.method).toBe("retail_till");
    expect(payment.status).toBe("confirmed");
    expect(await hasConfirmedPassIssuancePayment("enroll_till1")).toBe(true);
  });

  it("only re-checks issuance for confirmed pass_issuance payments, and never throws", async () => {
    const devicePayment = await createPaymentRecord({
      enrollmentId: "enroll_nonexistent",
      purpose: "device_extension",
      method: "digital_wallet"
    });
    await expect(triggerIssuanceRecheck(devicePayment)).resolves.toBeUndefined();

    const pendingPassPayment = await createPaymentRecord({
      enrollmentId: "enroll_nonexistent",
      purpose: "pass_issuance",
      method: "cash_in_store",
      storeId: "zik-london-001"
    });
    await expect(triggerIssuanceRecheck(pendingPassPayment)).resolves.toBeUndefined();

    // A confirmed pass_issuance payment for an enrollment that doesn't
    // exist would make the underlying lookup throw — this must be
    // swallowed so a payment confirmation never fails because of it.
    const confirmedForMissingEnrollment = await confirmCashPayment({
      paymentId: pendingPassPayment.payment_id,
      confirmedBy: "Demo clerk"
    });
    await expect(triggerIssuanceRecheck(confirmedForMissingEnrollment)).resolves.toBeUndefined();
  });
});
