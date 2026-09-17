"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentRecord } from "@/lib/shared/types";
import { Button } from "@/components/customer/ui";

interface ApiError {
  error: string;
}

type PanelState = "loading" | "ready" | "error";

const METHOD_LABEL: Record<string, string> = {
  cash_in_store: "cash or card at the till",
  digital_wallet: "Zik demo checkout",
  online_demo: "Zik demo checkout",
  retail_till: "paid at the till"
};

const POLL_INTERVAL_MS = 3000;

export function ClerkPaymentStatus({
  enrollmentId,
  storeId
}: {
  enrollmentId: string;
  storeId: string;
}) {
  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPayment = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/${enrollmentId}`);
      const data = (await response.json()) as { payments: PaymentRecord[] };
      const passPayment =
        data.payments.find((candidate) => candidate.purpose === "pass_issuance") ?? null;
      setPayment(passPayment);
      setPanelState("ready");
    } catch {
      setError("Unable to load payment status for this session.");
      setPanelState("error");
    }
  }, [enrollmentId]);

  useEffect(() => {
    void loadPayment();
    const interval = window.setInterval(() => void loadPayment(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadPayment]);

  async function markPaidByCash() {
    setIsSubmitting(true);
    setError(null);
    try {
      const createResponse = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          purpose: "pass_issuance",
          method: "cash_in_store",
          storeId
        })
      });
      const created = (await createResponse.json()) as PaymentRecord | ApiError;
      if (!createResponse.ok) {
        throw new Error((created as ApiError).error ?? "Unable to record the payment.");
      }

      const confirmResponse = await fetch("/api/payments/confirm-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: (created as PaymentRecord).payment_id,
          confirmedBy: "Demo clerk"
        })
      });
      const confirmed = (await confirmResponse.json()) as PaymentRecord | ApiError;
      if (!confirmResponse.ok) {
        throw new Error((confirmed as ApiError).error ?? "Unable to confirm the payment.");
      }
      setPayment(confirmed as PaymentRecord);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to record the payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (panelState === "loading") {
    return (
      <p aria-live="polite" className="text-[12px] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-ac9855083888-1" : undefined}>
        Checking payment&hellip;
      </p>
    );
  }

  const method = payment ? METHOD_LABEL[payment.method] ?? payment.method : null;
  const statusLabel =
    payment?.status === "confirmed"
      ? `Paid - ${method} - ref ${payment.payment_id}`
      : payment?.status === "pending"
        ? `Customer chose ${method} - awaiting your confirmation`
        : "No payment yet";

  return (
    <div className="rounded-[var(--zk-r-md)] border border-[var(--zk-line)] bg-[var(--zk-sunken)] px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-ac9855083888-2" : undefined}>
        Payment
      </p>
      <p aria-live="polite" className="mt-1 text-[13px] font-semibold text-[var(--zk-text)]">
        {statusLabel}
      </p>
      {payment?.status !== "confirmed" ? (
        <Button
          className="mt-2"
          variant="secondary"
          loading={isSubmitting}
          onClick={() => void markPaidByCash()}
        >
          Confirm payment received
        </Button>
      ) : null}
      {error ? (
        <p className="mt-2 text-[12px] font-semibold text-[var(--zk-critical)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
