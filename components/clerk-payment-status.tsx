"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentRecord } from "@/lib/shared/types";

interface ApiError {
  error: string;
}

type PanelState = "loading" | "ready" | "error";

const METHOD_LABEL: Record<string, string> = {
  cash_in_store: "cash",
  digital_wallet: "Apple Pay / Google Pay",
  online_demo: "online"
};

const POLL_INTERVAL_MS = 3000;

export function ClerkPaymentStatus({ enrollmentId, storeId }: { enrollmentId: string; storeId: string }) {
  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPayment = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/${enrollmentId}`);
      const data = (await response.json()) as { payments: PaymentRecord[] };
      const passPayment = data.payments.find((candidate) => candidate.purpose === "pass_issuance") ?? null;
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
        body: JSON.stringify({ enrollmentId, purpose: "pass_issuance", method: "cash_in_store", storeId })
      });
      const created = (await createResponse.json()) as PaymentRecord | ApiError;
      if (!createResponse.ok) {
        throw new Error((created as ApiError).error ?? "Unable to record the payment.");
      }

      const confirmResponse = await fetch("/api/payments/confirm-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: (created as PaymentRecord).payment_id, confirmedBy: "Demo clerk" })
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
      <p aria-live="polite" className="text-xs text-ink/55">
        Checking payment status…
      </p>
    );
  }

  const statusLabel =
    payment?.status === "confirmed"
      ? "Paid"
      : payment?.status === "pending"
        ? `Customer selected ${METHOD_LABEL[payment.method] ?? payment.method} — awaiting your confirmation`
        : "No payment method selected yet";

  return (
    <div className="rounded-[18px] border border-ink/8 bg-white px-4 py-3 text-left">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">Payment</p>
      <p aria-live="polite" className="mt-1 text-sm font-semibold text-ink">
        {statusLabel}
        {payment?.status === "confirmed"
          ? ` via ${METHOD_LABEL[payment.method] ?? payment.method} — reference ${payment.payment_id}`
          : ""}
      </p>
      {payment?.status !== "confirmed" ? (
        <button
          className="mt-2 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-mist disabled:opacity-55 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          disabled={isSubmitting}
          onClick={() => void markPaidByCash()}
          type="button"
        >
          {isSubmitting ? "Confirming…" : "Payment confirmed"}
        </button>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#B32646]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
