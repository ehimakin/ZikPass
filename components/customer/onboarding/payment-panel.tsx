"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PaymentRecord } from "@/lib/shared/types";
import type { PassPrice } from "@/lib/shared/payment-config";
import { hasClientStripeKey } from "@/lib/shared/payment-config";
import { Alert, Button, Card, Sheet, StatusBadge } from "@/components/customer/ui";

const POLL_MS = 3000;

interface ApiError {
  error: string;
}

type PanelState = "loading" | "locked" | "choosing" | "till_pending" | "confirming" | "paid" | "failed";

/**
 * Payment for in-store pass issuance. Two explicit adapters share one payment
 * service and the same issuance gate:
 *
 *  - **Provider test adapter (Stripe Express Checkout):** only offered when a
 *    Stripe publishable key is configured. Opens the real wallet UI. Not yet
 *    wired in this build - see docs/SPRINT_STATUS.md for the setup checklist.
 *  - **ZikPass demo checkout:** a clearly-labelled branded simulator with
 *    deterministic success / decline outcomes. It never imitates an Apple
 *    system sheet and is never silently substituted for a failed real
 *    transaction.
 *
 * Plus pay-at-till (cash/card), which the clerk confirms on their screen.
 */
export function PaymentPanel({
  enrollmentId,
  storeId,
  price,
  clerkLookedUp,
  onPaid
}: {
  enrollmentId: string;
  storeId: string;
  price: PassPrice;
  clerkLookedUp: boolean;
  onPaid?: () => void;
}) {
  const [state, setState] = useState<PanelState>("loading");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actingRef = useRef(false);
  const stripeAvailable = hasClientStripeKey();

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/${enrollmentId}`);
      const data = (await res.json()) as { payments: PaymentRecord[] };
      const pass = data.payments.find((p) => p.purpose === "pass_issuance") ?? null;
      setPayment(pass);
      if (pass?.status === "confirmed") onPaid?.();
      setState((current) => {
        if (actingRef.current || current === "confirming") return current;
        if (pass?.status === "confirmed") return "paid";
        if (pass?.status === "pending" && pass.method === "cash_in_store") return "till_pending";
        return clerkLookedUp ? "choosing" : "locked";
      });
    } catch {
      /* keep last state; poll again */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentId, clerkLookedUp]);

  useEffect(() => {
    void loadStatus();
    const id = window.setInterval(() => void loadStatus(), POLL_MS);
    return () => window.clearInterval(id);
  }, [loadStatus]);

  async function createPayment(method: "cash_in_store" | "digital_wallet") {
    const res = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId, purpose: "pass_issuance", method, storeId })
    });
    const data = (await res.json()) as PaymentRecord | ApiError;
    if (!res.ok) throw new Error((data as ApiError).error ?? "Could not start the payment.");
    return data as PaymentRecord;
  }

  async function chooseTill() {
    actingRef.current = true;
    setError(null);
    try {
      const created = await createPayment("cash_in_store");
      setPayment(created);
      setState("till_pending");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not record your choice.");
      setState("choosing");
    } finally {
      actingRef.current = false;
    }
  }

  async function runSimulator(outcome: "success" | "decline") {
    actingRef.current = true;
    setError(null);
    setState("confirming");
    try {
      const created =
        payment?.status === "pending" && payment.method === "digital_wallet"
          ? payment
          : await createPayment("digital_wallet");

      await new Promise((r) => setTimeout(r, 900)); // deterministic simulated latency

      const res = await fetch("/api/payments/confirm-online-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: created.payment_id, simulateFailure: outcome === "decline" })
      });
      const data = (await res.json()) as PaymentRecord | ApiError;
      if (!res.ok) throw new Error((data as ApiError).error ?? "Could not confirm the payment.");

      const confirmed = data as PaymentRecord;
      setPayment(confirmed);
      if (confirmed.status === "confirmed") {
        onPaid?.();
        setSheetOpen(false);
        setState("paid");
      } else {
        setError("The demo card was declined. Try again, or pay at the till.");
        setState("choosing");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment could not be completed.");
      setState("choosing");
    } finally {
      actingRef.current = false;
    }
  }

  /* ---- render ---- */

  if (state === "loading") {
    return (
      <p className="text-[13px] text-[var(--zk-text-soft)]" aria-live="polite" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4b80c27ad530-1" : undefined}>
        Checking payment&hellip;
      </p>
    );
  }

  if (state === "locked") {
    return (
      <Card className="p-4">
        <p className="text-[14px] font-bold text-[var(--zk-text)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4b80c27ad530-2" : undefined}>Payment</p>
        <p className="mt-1 text-[13px] text-[var(--zk-text-soft)]" aria-live="polite" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4b80c27ad530-3" : undefined}>
          Once the clerk finds your code you can choose how to pay here.
        </p>
      </Card>
    );
  }

  if (state === "paid" && payment) {
    return (
      <Alert tone="positive" title={`Paid ${formatMoney(payment.amount_minor, payment.currency)}`}>
        {methodLabel(payment.method)} &middot; ref {payment.payment_id}
      </Alert>
    );
  }

  if (state === "till_pending" && payment) {
    return (
      <Alert tone="info" title="Pay the clerk now">
        You chose cash or card at the till. Staff will confirm it on their screen. Reference{" "}
        {payment.payment_id}.
      </Alert>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold text-[var(--zk-text)]">
          Pay {formatMoney(price.minor, price.currency)}
        </p>
        <StatusBadge tone="caution">Test payment &middot; no real charge</StatusBadge>
      </div>

      <div className="mt-3 space-y-2">
        <button
          onClick={() => setSheetOpen(true)}
          disabled={state === "confirming"}
          className="flex w-full items-center justify-between rounded-[var(--zk-r-md)] border border-[var(--zk-line-strong)] bg-[var(--zk-card)] px-4 py-3.5 text-left hover:bg-[var(--zk-sunken)] disabled:opacity-55"
        >
          <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-4b80c27ad530-4" : undefined}>
            <span className="block text-[14px] font-semibold text-[var(--zk-text)]">
              Zik demo checkout
            </span>
            <span className="block text-[12px] text-[var(--zk-text-soft)]">
              Simulated card - pay now on this phone
            </span>
          </span>
          <Chevron />
        </button>

        <button
          onClick={() => void chooseTill()}
          disabled={state === "confirming"}
          className="flex w-full items-center justify-between rounded-[var(--zk-r-md)] border border-[var(--zk-line-strong)] bg-[var(--zk-card)] px-4 py-3.5 text-left hover:bg-[var(--zk-sunken)] disabled:opacity-55"
        >
          <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-4b80c27ad530-5" : undefined}>
            <span className="block text-[14px] font-semibold text-[var(--zk-text)]">
              Cash or card at the till
            </span>
            <span className="block text-[12px] text-[var(--zk-text-soft)]">
              Pay staff - they confirm it for you
            </span>
          </span>
          <Chevron />
        </button>
      </div>

      {!stripeAvailable ? (
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4b80c27ad530-6" : undefined}>
          Apple Pay / Google Pay isn&rsquo;t available in this build - the payment provider
          isn&rsquo;t connected yet. The demo checkout above is clearly a simulation.
        </p>
      ) : null}

      {error && !sheetOpen ? (
        <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">
          {error}
        </p>
      ) : null}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Zik demo checkout">
        <div className="rounded-[var(--zk-r-md)] bg-[var(--zk-sunken)] p-3.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4b80c27ad530-7" : undefined}>Zik Pass</span>
            <span className="font-bold text-[var(--zk-text)]">
              {formatMoney(price.minor, price.currency)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4b80c27ad530-8" : undefined}>
            Simulated payment. No card details are collected and nothing is charged.
          </p>
        </div>
        {error ? (
          <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 space-y-2">
          <Button size="lg" loading={state === "confirming"} onClick={() => void runSimulator("success")}>
            Pay {formatMoney(price.minor, price.currency)}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            disabled={state === "confirming"}
            onClick={() => void runSimulator("decline")}
          >
            Simulate a declined card
          </Button>
          <Button
            size="lg"
            variant="ghost"
            disabled={state === "confirming"}
            onClick={() => setSheetOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

function Chevron() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--zk-text-faint)]"
      aria-hidden="true"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function formatMoney(minor: number, currency: string): string {
  if (minor <= 0) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
}

function methodLabel(method: string): string {
  return (
    {
      cash_in_store: "Cash or card at the till",
      digital_wallet: "Zik demo checkout",
      online_demo: "Zik demo checkout",
      retail_till: "Paid at the till"
    }[method] ?? method
  );
}
