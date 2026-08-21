"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentRecord } from "@/lib/shared/types";

interface ApiError {
  error: string;
}

type PanelState = "loading" | "locked" | "choosing" | "cash_pending" | "paying" | "paid" | "error";

const METHOD_LABEL: Record<string, string> = {
  cash_in_store: "cash or card at the till",
  digital_wallet: "Apple Pay / Google Pay",
  online_demo: "online"
};

const POLL_INTERVAL_MS = 3000;

/**
 * Lets the customer pay for in-store onboarding themselves, on the phone
 * they're already holding, instead of waiting to hand over cash or card at
 * the till. Stays locked until the clerk has looked up the customer's code
 * (clerkLookupAt) — that lookup is what unlocks the choice. Polls so a cash
 * payment the clerk confirms independently still shows up here.
 */
export function PassPaymentChoice({
  enrollmentId,
  storeId,
  clerkLookupAt
}: {
  enrollmentId: string;
  storeId: string;
  clerkLookupAt?: string;
}) {
  const [state, setState] = useState<PanelState>("loading");
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/${enrollmentId}`);
      const data = (await response.json()) as { payments: PaymentRecord[] };
      const passPayment = data.payments.find((candidate) => candidate.purpose === "pass_issuance") ?? null;

      setPayment(passPayment);
      setState((current) => {
        if (current === "paying" && passPayment?.status !== "confirmed") {
          // Don't let a poll mid-flight override the customer's own action.
          return current;
        }
        if (passPayment?.status === "confirmed") {
          return "paid";
        }
        if (passPayment?.status === "pending") {
          return "cash_pending";
        }
        return clerkLookupAt ? "choosing" : "locked";
      });
    } catch {
      setState((current) => (current === "paying" ? current : "error"));
      setError("Unable to check payment status right now.");
    }
  }, [enrollmentId, clerkLookupAt]);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  async function selectCash() {
    setState("paying");
    setError(null);
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, purpose: "pass_issuance", method: "cash_in_store", storeId })
      });
      const created = (await response.json()) as PaymentRecord | ApiError;

      if (!response.ok) {
        throw new Error((created as ApiError).error ?? "Unable to record your choice.");
      }

      setPayment(created as PaymentRecord);
      setState("cash_pending");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to record your choice.");
      setState("choosing");
    }
  }

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
      setState("choosing");
    }
  }

  if (state === "loading") {
    return (
      <p aria-live="polite" className="text-sm font-semibold text-ink/55">
        Checking payment status…
      </p>
    );
  }

  if (state === "locked") {
    return (
      <p aria-live="polite" className="text-sm font-semibold text-ink/55">
        Once staff have looked up your code, you&apos;ll be able to choose how to pay here.
      </p>
    );
  }

  if (state === "error") {
    return (
      <div className="w-full rounded-[20px] border border-[#d27a86]/30 bg-[#fdf3f4] px-5 py-4 text-left" role="alert">
        <p aria-live="assertive" className="text-sm font-semibold text-ink">
          {error}
        </p>
        <button
          className="mt-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          onClick={() => void loadStatus()}
          type="button"
        >
          Try again
        </button>
      </div>
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

  if (state === "cash_pending" && payment) {
    return (
      <div className="w-full rounded-[20px] border border-ink/10 bg-white/76 px-5 py-4 text-left" role="status">
        <p aria-live="polite" className="text-sm font-semibold text-ink">
          You chose to pay staff directly with cash or card.
        </p>
        <p className="mt-1 text-xs text-ink/60">
          Hand over payment now — staff will confirm it on their screen. Reference {payment.payment_id}.
        </p>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-3 rounded-[20px] border border-ink/8 bg-white/76 px-5 py-4 text-left">
      <p className="text-sm font-semibold text-ink">How would you like to pay?</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          className="rounded-[16px] border border-ink/12 bg-white px-4 py-3 text-left text-sm font-semibold text-ink transition hover:bg-[#f7faee] disabled:opacity-55 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          disabled={state === "paying"}
          onClick={() => void selectCash()}
          type="button"
        >
          Cash or card
          <span className="mt-1 block text-xs font-normal text-ink/55">Pay staff at the till</span>
        </button>
        <button
          className="rounded-[16px] border border-ink/12 bg-white px-4 py-3 text-left text-sm font-semibold text-ink transition hover:bg-[#f7faee] disabled:opacity-55 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          disabled={state === "paying"}
          onClick={() => void payWithDigitalWallet()}
          type="button"
        >
          {state === "paying" ? "Confirming…" : "Apple Pay / Google Pay"}
          <span className="mt-1 block text-xs font-normal text-ink/55">Pay now on this phone</span>
        </button>
      </div>
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
