"use client";

import { useState } from "react";
import { reportClientError } from "@/lib/client/error-reporting";
import type { ErrorRecoveryAction } from "@/lib/shared/types";

const RECOVERY_COPY: Record<ErrorRecoveryAction, { actionLabel: string; instructions: string }> = {
  retry: {
    actionLabel: "Try again",
    instructions: "This usually works on the next attempt. Nothing you already did was lost."
  },
  resume: {
    actionLabel: "Continue",
    instructions: "You can pick up from where this left off — nothing needs to be redone."
  },
  restart: {
    actionLabel: "Start again",
    instructions: "This step needs to be restarted. Anything already issued or paid for stays safe."
  },
  report: {
    actionLabel: "Report this problem",
    instructions: "This does not look routine. Reporting it gives you a reference to share with support."
  }
};

export function RecoveryPanel({
  title = "Something went wrong",
  message,
  recoveryAction = "report",
  operation,
  onRetry,
  onRestart
}: {
  title?: string;
  message: string;
  recoveryAction?: ErrorRecoveryAction;
  operation?: string;
  onRetry?: () => void;
  onRestart?: () => void;
}) {
  const [reference, setReference] = useState<string | null | "pending">(null);
  const copy = RECOVERY_COPY[recoveryAction];

  async function handleReport() {
    setReference("pending");
    const result = await reportClientError({
      message,
      operation,
      route: typeof window !== "undefined" ? window.location.pathname : undefined
    });
    setReference(result);
  }

  return (
    <section
      aria-live="assertive"
      role="alert"
      className="mx-auto w-full max-w-xl rounded-[28px] border border-[#d27a86]/25 bg-[#fdf3f4] p-6 text-left shadow-panel"
    >
      <h2 className="font-heading text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/76">{message}</p>
      <p className="mt-2 text-sm leading-6 text-ink/60">{copy.instructions}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        {onRetry ? (
          <button
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            onClick={onRetry}
            type="button"
          >
            {recoveryAction === "resume" ? RECOVERY_COPY.resume.actionLabel : RECOVERY_COPY.retry.actionLabel}
          </button>
        ) : null}
        {onRestart ? (
          <button
            className="rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
            onClick={onRestart}
            type="button"
          >
            {RECOVERY_COPY.restart.actionLabel}
          </button>
        ) : null}
        <button
          className="rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          disabled={reference === "pending"}
          onClick={() => void handleReport()}
          type="button"
        >
          {reference === "pending" ? "Reporting…" : "Report this problem"}
        </button>
      </div>

      <p aria-live="polite" className="mt-4 text-xs text-ink/60">
        {reference && reference !== "pending"
          ? `Reference ${reference}. Share this if you contact support.`
          : reference === "pending"
            ? "Filing your report…"
            : ""}
      </p>
    </section>
  );
}
