"use client";

import { useEffect, useState } from "react";
import { AFFILIATE_DEMO_STATE_STORAGE_KEY } from "@/components/affiliate-demo-landing";

interface AffiliateResult {
  age_over: boolean;
  threshold: number;
  assurance: string;
  verified_at: string;
  expires_at: string;
  verification_id: string;
}

interface ApiError {
  error: string;
}

type CallbackState = "checking" | "granted" | "denied";

export function AffiliateCallbackScreen({
  code,
  state
}: {
  code: string | null;
  state: string | null;
}) {
  const [screenState, setScreenState] = useState<CallbackState>("checking");
  const [message, setMessage] = useState<string>("Checking your verification result…");
  const [result, setResult] = useState<AffiliateResult | null>(null);

  useEffect(() => {
    void (async () => {
      const expectedState = window.sessionStorage.getItem(AFFILIATE_DEMO_STATE_STORAGE_KEY);
      window.sessionStorage.removeItem(AFFILIATE_DEMO_STATE_STORAGE_KEY);

      if (!code || !state || !expectedState || state !== expectedState) {
        setScreenState("denied");
        setMessage(
          "ZikPass could not confirm your age. No identity data was shared. Please try again or choose another verification method."
        );
        return;
      }

      try {
        const response = await fetch("/api/affiliate/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            client_id: "nightfall-demo",
            redirect_uri: "/affiliate-demo/callback",
            state
          })
        });
        const data = (await response.json()) as AffiliateResult | ApiError;

        if (!response.ok || "error" in data) {
          setScreenState("denied");
          setMessage(
            (data as ApiError).error ??
              "ZikPass could not confirm your age. No identity data was shared. Please try again or choose another verification method."
          );
          return;
        }

        setResult(data as AffiliateResult);
        setScreenState("granted");
        setMessage("Access confirmed.");
      } catch {
        setScreenState("denied");
        setMessage(
          "ZikPass could not confirm your age. No identity data was shared. Please try again or choose another verification method."
        );
      }
    })();
  }, [code, state]);

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

        <div className="px-6 py-10 sm:px-8 lg:py-14">
          <p aria-live="polite" className="sr-only">
            {message}
          </p>

          {screenState === "checking" ? (
            <p className="text-sm leading-7 text-white/70">Checking your verification result…</p>
          ) : null}

          {screenState === "granted" && result ? (
            <div className="space-y-6">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                You&apos;re in.
              </h1>
              <p className="max-w-xl text-sm leading-7 text-white/70">
                ZikPass confirmed you are over {result.threshold}. No identity information — name,
                date of birth, ID document, or biometric data — was shared with Nightfall.
              </p>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <dl className="grid gap-3 text-sm">
                  <ResultRow label="Over threshold" value={`${result.threshold}+`} />
                  <ResultRow label="Assurance level" value={result.assurance} />
                  <ResultRow label="Verified at" value={new Date(result.verified_at).toLocaleString()} />
                  <ResultRow label="Result expires" value={new Date(result.expires_at).toLocaleString()} />
                  <ResultRow label="Verification ID" value={result.verification_id} />
                </dl>
              </div>
            </div>
          ) : null}

          {screenState === "denied" ? (
            <div className="space-y-6">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Verification not confirmed
              </h1>
              <p className="max-w-xl text-sm leading-7 text-white/70">{message}</p>
              <a
                className="inline-block w-fit rounded-full bg-[#c9a9f2] px-6 py-3 text-sm font-semibold text-[#1d1526] transition hover:bg-[#d7bdfa] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                href="/affiliate-demo"
              >
                Try again
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] bg-black/20 px-4 py-3">
      <dt className="text-white/55">{label}</dt>
      <dd className="break-all text-right font-medium text-white">{value}</dd>
    </div>
  );
}
