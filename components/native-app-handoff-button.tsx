"use client";

import { useState } from "react";

interface HandoffResponse {
  customSchemeUrl: string;
  webHandoffUrl: string;
  expires_at: string;
}

export function NativeAppHandoffButton({
  enrollmentId,
  className = "rounded-full border border-ink/12 bg-[#f7faee] px-5 py-3 text-sm font-semibold text-ink",
  label = "Open in ZikPass"
}: {
  enrollmentId?: string;
  className?: string;
  label?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function openNativeApp() {
    if (!enrollmentId) {
      setMessage("Complete the current onboarding flow before opening the native wallet.");
      return;
    }

    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/mobile/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId })
      });
      const data = (await response.json()) as HandoffResponse | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? "Unable to open the native wallet.");
      }

      const handoff = data as HandoffResponse;
      window.location.assign(handoff.customSchemeUrl);
      window.setTimeout(() => {
        setMessage("If the native app did not open, install the development build and try again.");
      }, 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open the native wallet.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className={`${className} disabled:cursor-wait disabled:opacity-55`}
        disabled={isPending}
        onClick={() => void openNativeApp()}
        type="button"
      >
        {isPending ? "Preparing handoff..." : label}
      </button>
      {message ? (
        <p aria-live="polite" className="text-xs leading-5 text-ink/58">
          {message}
        </p>
      ) : null}
    </div>
  );
}
