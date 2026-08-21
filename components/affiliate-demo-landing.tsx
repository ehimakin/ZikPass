"use client";

import { useState } from "react";
import { RecoveryPanel } from "@/components/recovery-panel";
import { classifyError } from "@/lib/shared/errors";

const CLIENT_ID = "nightfall-demo";
const REDIRECT_URI = "/affiliate-demo/callback";
export const AFFILIATE_DEMO_STATE_STORAGE_KEY = "zikpass-affiliate-demo-state";

interface ApiError {
  error: string;
}

type LandingState = "idle" | "starting" | "error";

export function AffiliateDemoLanding() {
  const [state, setState] = useState<LandingState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function startVerification() {
    setState("starting");
    setError(null);

    try {
      const requestState = crypto.randomUUID();
      window.sessionStorage.setItem(AFFILIATE_DEMO_STATE_STORAGE_KEY, requestState);

      const response = await fetch("/api/affiliate/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, state: requestState })
      });
      const data = (await response.json()) as { confirm_url: string } | ApiError;

      if (!response.ok) {
        throw new Error((data as ApiError).error ?? "Unable to start age verification.");
      }

      window.location.href = (data as { confirm_url: string }).confirm_url;
    } catch (reason) {
      const classified = classifyError(reason);
      setError(classified.message);
      setState("error");
    }
  }

  return (
    <div className="grid gap-6">
      <p
        aria-label="Development demonstration only"
        className="w-fit rounded-full border border-ink/12 bg-white/70 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
      >
        Demo environment
      </p>

      <section className="overflow-hidden rounded-[34px] border border-[#2a2033] bg-[#140f1c] text-white shadow-[0_32px_100px_rgba(6,4,10,0.5)]">
        <div className="border-b border-white/10 bg-[#1d1526] px-6 py-4 sm:px-8">
          <p className="font-heading text-2xl font-semibold tracking-tight text-[#e4d6fb]">Nightfall</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">18+ Member Area</p>
        </div>

        <div className="grid gap-8 px-6 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-14">
          <div className="space-y-6">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Confirm your age privately with ZikPass.
            </h1>
            <p className="max-w-xl text-sm leading-7 text-white/70 sm:text-base">
              Nightfall is a restricted member area for adults. Instead of a selfie, ID document,
              biometric scan, or date of birth, we accept a private, one-time over-18 confirmation
              from ZikPass.
            </p>

            {state === "error" && error ? (
              <RecoveryPanel
                message={error}
                onRetry={() => void startVerification()}
                operation="affiliate_demo.start"
                recoveryAction="retry"
                title="Could not start verification"
              />
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                <button
                  className="w-full rounded-full bg-[#c9a9f2] px-6 py-4 text-base font-semibold text-[#1d1526] transition hover:bg-[#d7bdfa] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto"
                  disabled={state === "starting"}
                  onClick={() => void startVerification()}
                  type="button"
                >
                  {state === "starting" ? "Preparing…" : "Use ZikPass to confirm I am 18+"}
                </button>
                <p aria-live="polite" className="mt-4 text-sm leading-6 text-white/60">
                  No selfie, ID document, biometric data, name, or date of birth is shared with this
                  site.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
              <p className="font-heading text-xl font-semibold text-white">What Nightfall receives</p>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Only a minimal, time-limited confirmation — never your identity.
              </p>
              <dl className="mt-4 grid gap-3 text-sm">
                <InfoRow label="Age confirmation" value="Over 18 only" />
                <InfoRow label="Identity data" value="Not shared" />
                <InfoRow label="Verification path" value="ZikPass-hosted, server-checked" />
              </dl>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] bg-black/20 px-4 py-3">
      <dt className="text-white/55">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}
