"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { classifyError } from "@/lib/shared/errors";
import { RecoveryPanel } from "@/components/recovery-panel";
import type { DeviceBindingRecord, PaymentRecord } from "@/lib/shared/types";

interface ApiError {
  error: string;
}

interface HandoffResponse {
  webHandoffUrl: string;
  pwaStartUrl: string;
  expires_at: string;
}

type PanelState =
  | { step: "loading" }
  | { step: "status"; bindings: DeviceBindingRecord[]; deviceLimit: number; payments: PaymentRecord[] }
  | { step: "handoff_ready"; url: string; qrDataUrl: string | null }
  | { step: "payment"; payment: PaymentRecord }
  | { step: "error"; message: string; recoveryAction: ReturnType<typeof classifyError>["recoveryAction"] };

// The included-device count is also enforced server-side (device-bindings.ts);
// this local fallback only covers the moment before the status fetch resolves.
const DEFAULT_DEVICE_LIMIT = 2;

export function ExtendPassPanel({ enrollmentId }: { enrollmentId: string }) {
  const [state, setState] = useState<PanelState>({ step: "loading" });

  const loadStatus = useCallback(async () => {
    setState({ step: "loading" });
    try {
      const response = await fetch(`/api/payments/${enrollmentId}`);
      const data = (await response.json()) as { payments: PaymentRecord[]; device_bindings: DeviceBindingRecord[] };
      const activeBindings = data.device_bindings.filter((binding) => binding.status === "active");
      setState({
        step: "status",
        bindings: activeBindings,
        deviceLimit: DEFAULT_DEVICE_LIMIT,
        payments: data.payments
      });
    } catch (error) {
      const classified = classifyError(error);
      setState({ step: "error", message: classified.message, recoveryAction: classified.recoveryAction });
    }
  }, [enrollmentId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function generateHandoffLink() {
    setState({ step: "loading" });
    try {
      const response = await fetch("/api/mobile/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId })
      });
      const data = (await response.json()) as HandoffResponse | ApiError;

      if (!response.ok) {
        throw new Error((data as ApiError).error ?? "Unable to prepare the new device link.");
      }

      const handoff = data as HandoffResponse;
      const qrDataUrl = await QRCode.toDataURL(handoff.webHandoffUrl, {
        color: { dark: "#0E1726", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320
      }).catch(() => null);

      setState({ step: "handoff_ready", url: handoff.webHandoffUrl, qrDataUrl });
    } catch (error) {
      const classified = classifyError(error);
      setState({ step: "error", message: classified.message, recoveryAction: classified.recoveryAction });
    }
  }

  async function startExtensionPayment() {
    setState({ step: "loading" });
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, purpose: "device_extension", method: "online_demo" })
      });
      const data = (await response.json()) as PaymentRecord | ApiError;

      if (!response.ok) {
        throw new Error((data as ApiError).error ?? "Unable to start the extension payment.");
      }

      setState({ step: "payment", payment: data as PaymentRecord });
    } catch (error) {
      const classified = classifyError(error);
      setState({ step: "error", message: classified.message, recoveryAction: classified.recoveryAction });
    }
  }

  async function confirmDemoPayment(paymentId: string, simulateFailure: boolean) {
    setState({ step: "loading" });
    try {
      const response = await fetch("/api/payments/confirm-online-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, simulateFailure })
      });
      const data = (await response.json()) as PaymentRecord | ApiError;

      if (!response.ok) {
        throw new Error((data as ApiError).error ?? "Unable to confirm the extension payment.");
      }

      const payment = data as PaymentRecord;
      if (payment.status === "failed") {
        setState({ step: "payment", payment });
        return;
      }

      await loadStatus();
    } catch (error) {
      const classified = classifyError(error);
      setState({ step: "error", message: classified.message, recoveryAction: classified.recoveryAction });
    }
  }

  if (state.step === "loading") {
    return (
      <div aria-live="polite" className="rounded-[18px] bg-white px-4 py-3 text-sm text-ink/68">
        Checking your devices…
      </div>
    );
  }

  if (state.step === "error") {
    return (
      <RecoveryPanel
        message={state.message}
        onRetry={() => void loadStatus()}
        operation="extend_pass"
        recoveryAction={state.recoveryAction}
        title="We could not load your devices"
      />
    );
  }

  if (state.step === "handoff_ready") {
    return (
      <div className="grid gap-4">
        <h3 className="font-heading text-lg font-semibold text-ink">Add this pass to another device</h3>
        <p className="text-sm leading-6 text-ink/68">
          On the new device, open this link or scan the code. It expires in 10 minutes and can only be used
          once.
        </p>
        {state.qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Scan to add ZikPass to a new device"
            className="mx-auto h-auto w-56 rounded-[18px] bg-white p-2"
            src={state.qrDataUrl}
          />
        ) : (
          <p role="status">Preparing the code…</p>
        )}
        <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-ink/10 bg-white px-3 py-2">
          <code className="flex-1 truncate text-xs text-ink/72">{state.url}</code>
        </div>
        <button
          className="justify-self-start rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          onClick={() => void loadStatus()}
          type="button"
        >
          Done
        </button>
      </div>
    );
  }

  if (state.step === "payment") {
    const { payment } = state;
    return (
      <div className="grid gap-4">
        <h3 className="font-heading text-lg font-semibold text-ink">
          Extend to a third device — demo payment
        </h3>
        <p aria-live="polite" className="text-sm leading-6 text-ink/68">
          {payment.status === "failed"
            ? `Payment ${payment.payment_id} did not go through. No device was added and nothing was charged twice.`
            : `Payment ${payment.payment_id} — ${(payment.amount_minor / 100).toFixed(2)} ${payment.currency}, awaiting confirmation.`}
        </p>
        <p className="rounded-[16px] bg-[#fff7e6] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#8a6116]">
          Demo payment only — no real card details are collected or charged.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            onClick={() => void confirmDemoPayment(payment.payment_id, false)}
            type="button"
          >
            Simulate successful payment
          </button>
          <button
            className="rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            onClick={() => void confirmDemoPayment(payment.payment_id, true)}
            type="button"
          >
            Simulate failed payment
          </button>
        </div>
      </div>
    );
  }

  const { bindings, deviceLimit, payments } = state;
  const hasUnusedEntitlement = payments.some(
    (candidate) => candidate.purpose === "device_extension" && candidate.status === "confirmed" && !candidate.consumed_by_binding_id
  );
  const atLimit = bindings.length >= deviceLimit && !hasUnusedEntitlement;

  return (
    <div className="grid gap-4">
      <h3 className="font-heading text-lg font-semibold text-ink">Extend pass to another device</h3>
      <p className="text-sm leading-6 text-ink/68">
        This adds an authorised device to your existing pass — it does not delete or move the pass off this
        device.
      </p>
      <p aria-live="polite" className="rounded-[16px] bg-[#f7faee] px-4 py-3 text-sm font-semibold text-ink">
        {bindings.length} of {deviceLimit} included devices linked
        {hasUnusedEntitlement ? " (plus one paid extension ready to use)" : ""}.
      </p>
      {atLimit ? (
        <>
          <p className="text-sm leading-6 text-ink/68">
            You have used both devices included with your pass. Extending to a third device uses the demo
            payment flow below.
          </p>
          <button
            className="justify-self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            onClick={() => void startExtensionPayment()}
            type="button"
          >
            Pay to extend to a third device
          </button>
        </>
      ) : (
        <button
          className="justify-self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          onClick={() => void generateHandoffLink()}
          type="button"
        >
          Get a link for a new device
        </button>
      )}
    </div>
  );
}
