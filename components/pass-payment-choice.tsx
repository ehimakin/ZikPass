"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentRecord } from "@/lib/shared/types";

interface ApiError {
  error: string;
}

type PanelState = "loading" | "unpaid" | "paying" | "paid" | "error";

const METHOD_LABEL: Record<string, string> = {
  cash_in_store: "cash or card at the till",
  digital_wallet: "Apple Pay / Google Pay",
  online_demo: "online"
};

const POLL_INTERVAL_MS = 3000;

/**
 * Lets the customer pay for in-store onboarding themselves, on the phone
 * they're already holding, instead of waiting to hand over cash or card at
 * the till. Polls so a cash payment the clerk records independently still
 * shows up here without the customer needing to do anything.
 */
export function PassPaymentChoice({ enrollmentId, storeId }: { enrollmentId: string; storeId: string }) {
  const [state, setState] = useState<PanelState>("loading");
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/${enrollmentId}`);
      const data = (await response.json()) as { payments: PaymentRecord[] };
      const passPayment = data.payments.find((candidate) => candidate.purpose === "pass_issuance") ?? null;

      setPayment(passPayment);
      setState((current) =>
        current === "paying" && passPayment?.status !== "confirmed"
          ? current
          : passPayment?.status === "confirmed"
            ? "paid"
            : "unpaid"
      );
    } catch {
      setState((current) => (current === "paying" ? current : "error"));
      setError("Unable to check payment status right now.");
    }
  }, [enrollmentId]);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  async function payWithDigitalWallet() {
    setState("paying");
    setError(null);
    try {
      const createResponse = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, purpose: "pass_issuance", method: "digital_wallet", storeId })
      });
      const created = (await createResponse.json()) as PaymentRecord | ApiError;

      if (!createResponse.ok) {
        throw new Error((created as ApiError).error ?? "Unable to start the payment.");
      }

      const confirmResponse = await fetch("/api/payments/confirm-online-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: (created as PaymentRecord).payment_id })
      });
      const confirmed = (await confirmResponse.json()) as PaymentRecord | ApiError;

      if (!confirmResponse.ok) {
        throw new Error((confirmed as ApiError).error ?? "Unable to confirm the payment.");
      }

      setPayment(confirmed as PaymentRecord);
      setState("paid");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete the payment.");
      setState("unpaid");
    }
  }

  if (state === "loading") {
    return (
      <p aria-live="polite" className="text-sm font-semibold text-ink/55">
        Checking payment status…
      </p>
    );
  }

  if (state === "paid" && payment) {
    return (
      <div className="w-full rounded-[20px] border border-[#69b889]/30 bg-[#eef8e8] px-5 py-4 text-left" role="status">
        <p className="text-sm font-semibold text-ink">
          Paid via {METHOD_LABEL[payment.method] ?? payment.method}
        </p>
        <p className="mt-1 text-xs text-ink/60">Reference {payment.payment_id}</p>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-3 rounded-[20px] border border-ink/8 bg-white/76 px-5 py-4 text-left">
      <p className="text-sm font-semibold text-ink">How would you like to pay?</p>
      <p className="text-sm text-ink/68">
        Pay staff directly with cash or card, or pay now with the digital wallet on this phone.
      </p>
      <button
        className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist disabled:opacity-55"
        disabled={state === "paying"}
        onClick={() => void payWithDigitalWallet()}
        type="button"
      >
        {state === "paying" ? "Confirming…" : "Pay with Apple Pay / Google Pay"}
      </button>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6116]">
        Demo payment only — no real card details are collected or charged.
      </p>
      {error ? (
        <p aria-live="assertive" className="text-xs font-semibold text-[#B32646]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
