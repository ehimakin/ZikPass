import { runtimeConfig } from "@/lib/shared/config";
import type { PaymentMethod, PaymentPurpose, PaymentRecord, StorePlanRecord } from "@/lib/shared/types";
import { randomId } from "@/lib/shared/utils";
import {
  getPayment,
  getStorePlan,
  listPaymentsForEnrollment,
  runPaymentTransaction
} from "@/lib/server/storage";

export interface ResolvedStorePlan {
  storeId?: string;
  deviceLimit: number;
  extensionPriceMinor: number;
  currency: string;
}

export async function resolveStorePlan(storeId?: string): Promise<ResolvedStorePlan> {
  const override: StorePlanRecord | undefined = storeId ? await getStorePlan(storeId) : undefined;

  return {
    storeId,
    deviceLimit: override?.device_limit ?? runtimeConfig.deviceLimitIncluded,
    extensionPriceMinor: override?.extension_price_minor ?? runtimeConfig.deviceExtensionPriceMinor,
    currency: override?.currency ?? runtimeConfig.deviceExtensionCurrency
  };
}

function computeShares(amountMinor: number): { platform_share_minor: number; store_share_minor: number } {
  const platformShareMinor = Math.round((amountMinor * runtimeConfig.platformSharePercent) / 100);
  return {
    platform_share_minor: platformShareMinor,
    store_share_minor: amountMinor - platformShareMinor
  };
}

/**
 * Idempotent by design: a pending payment for the same (enrollment, purpose)
 * is returned as-is instead of creating a duplicate, so repeated clicks
 * never mint two payment records. A previously failed attempt does not
 * block a fresh one — that is the retry path.
 */
export async function createPaymentRecord(input: {
  enrollmentId: string;
  purpose: PaymentPurpose;
  method: PaymentMethod;
  storeId?: string;
}): Promise<PaymentRecord> {
  const plan = await resolveStorePlan(input.storeId);
  const amountMinor =
    input.purpose === "device_extension" ? plan.extensionPriceMinor : runtimeConfig.passIssuancePriceMinor;
  const currency = input.purpose === "device_extension" ? plan.currency : runtimeConfig.deviceExtensionCurrency;

  return runPaymentTransaction((payments) => {
    const existingPending = payments.find(
      (payment) =>
        payment.enrollment_id === input.enrollmentId &&
        payment.purpose === input.purpose &&
        payment.status === "pending"
    );

    if (existingPending) {
      return { result: existingPending };
    }

    const now = new Date().toISOString();
    const record: PaymentRecord = {
      payment_id: randomId("pay"),
      idempotency_key: `${input.enrollmentId}:${input.purpose}:${now}`,
      enrollment_id: input.enrollmentId,
      store_id: input.storeId,
      purpose: input.purpose,
      method: input.method,
      amount_minor: amountMinor,
      currency,
      status: "pending",
      created_at: now,
      ...computeShares(amountMinor),
      settlement_status: "unsettled"
    };

    return { result: record, payments: [...payments, record] };
  });
}

export async function confirmCashPayment(input: {
  paymentId: string;
  confirmedBy: string;
}): Promise<PaymentRecord> {
  return runPaymentTransaction((payments) => confirmPaymentInArray(payments, input.paymentId, input.confirmedBy));
}

export async function confirmOnlineDemoPayment(input: {
  paymentId: string;
  simulateFailure?: boolean;
}): Promise<PaymentRecord> {
  if (input.simulateFailure) {
    return runPaymentTransaction((payments) => failPaymentInArray(payments, input.paymentId));
  }

  return runPaymentTransaction((payments) =>
    confirmPaymentInArray(payments, input.paymentId, "online-demo-gateway")
  );
}

function confirmPaymentInArray(
  payments: PaymentRecord[],
  paymentId: string,
  confirmedBy: string
): { result: PaymentRecord; payments?: PaymentRecord[] } {
  const existing = payments.find((payment) => payment.payment_id === paymentId);

  if (!existing) {
    throw new Error("This payment reference was not found.");
  }

  if (existing.status === "confirmed") {
    return { result: existing };
  }

  const now = new Date().toISOString();
  const confirmed: PaymentRecord = {
    ...existing,
    status: "confirmed",
    confirmed_at: now,
    confirmed_by: confirmedBy,
    failed_at: undefined
  };

  return {
    result: confirmed,
    payments: payments.map((payment) => (payment.payment_id === paymentId ? confirmed : payment))
  };
}

function failPaymentInArray(
  payments: PaymentRecord[],
  paymentId: string
): { result: PaymentRecord; payments?: PaymentRecord[] } {
  const existing = payments.find((payment) => payment.payment_id === paymentId);

  if (!existing) {
    throw new Error("This payment reference was not found.");
  }

  if (existing.status === "confirmed") {
    return { result: existing };
  }

  const failed: PaymentRecord = {
    ...existing,
    status: "failed",
    failed_at: new Date().toISOString()
  };

  return {
    result: failed,
    payments: payments.map((payment) => (payment.payment_id === paymentId ? failed : payment))
  };
}

export async function getPaymentOrThrow(paymentId: string): Promise<PaymentRecord> {
  const payment = await getPayment(paymentId);

  if (!payment) {
    throw new Error("This payment reference was not found.");
  }

  return payment;
}

export async function getPaymentsForEnrollment(enrollmentId: string): Promise<PaymentRecord[]> {
  return listPaymentsForEnrollment(enrollmentId);
}
