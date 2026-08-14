"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";
import {
  ZIK_VERIFICATION_RESULT_MESSAGE,
  buildHostedVerificationUrl,
  type VendorVerificationMessage,
  type VendorVerificationResult,
  type VendorVerificationSession
} from "@/lib/shared/vendor-verification";

type VendorUiState =
  | "idle"
  | "verification_in_progress"
  | "verified"
  | "verification_denied"
  | "verification_cancelled"
  | "no_valid_pass";

export function VerifierDemo() {
  const [session, setSession] = useState<VendorVerificationSession | null>(null);
  const [result, setResult] = useState<VendorVerificationResult | null>(null);
  const [uiState, setUiState] = useState<VendorUiState>("idle");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = event.data as VendorVerificationMessage | undefined;

      if (event.origin !== window.location.origin) {
        return;
      }

      if (!message || message.type !== ZIK_VERIFICATION_RESULT_MESSAGE) {
        return;
      }

      if (!session || message.payload.session_id !== session.session_id) {
        return;
      }

      setResult(message.payload);
      setUiState(mapOutcomeToUiState(message.payload));
      setModalOpen(false);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [session]);

  const hostedUrl = useMemo(() => {
    return session ? buildHostedVerificationUrl(session) : null;
  }, [session]);

  function launchVerification() {
    const nextSession: VendorVerificationSession = {
      session_id: crypto.randomUUID(),
      vendor_name: "ZikBet",
      vendor_origin: window.location.origin,
      request: "over18"
    };

    setSession(nextSession);
    setResult(null);
    setUiState("verification_in_progress");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    if (uiState === "verification_in_progress") {
      setUiState(result ? mapOutcomeToUiState(result) : "idle");
    }
  }

  const accessGranted = uiState === "verified";
  const primaryCtaLabel = accessGranted ? "Login/Signup" : "Verify with ZikPass";

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[34px] border border-[#1b3d2d] bg-[#0c1d15] text-white shadow-[0_32px_100px_rgba(7,12,10,0.42)]">
        <div className="border-b border-white/10 bg-[#11422f] px-6 py-3 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-[14px] bg-[#0b2519] px-3 py-2">
                <p className="font-heading text-2xl font-semibold leading-none text-[#f6ffb3]">
                  ZikBet
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-white/72">
                <TopChip label="In-Play" />
                <TopChip label="Football" />
                <TopChip label="Accumulators" />
                <TopChip label="New customer offer" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#0a291d] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#cfe87b]">
                UK sportsbook demo
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,_rgba(17,66,47,0.98),_rgba(11,27,20,0.96))] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#cfe87b]">
                    Join ZikBet
                  </p>
                  <h1 className="mt-3 font-heading text-5xl font-semibold tracking-tight text-white">
                    Create your account with one age check.
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/74 sm:text-base">
                    ZikBet uses Zik Pass as an external trust layer. Zik confirms only that you are
                    over 18, and your identity details stay out of the vendor flow.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-black/15 px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/48">
                    Verification state
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">{labelForUiState(uiState)}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <VendorMetric label="Verification" value="Zik-hosted modal" />
                <VendorMetric label="Data shared" value="Over-18 only" />
                <VendorMetric label="Account rule" value="No ID upload" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[28px] border border-white/8 bg-[#10291e] p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-heading text-2xl font-semibold">Popular today</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/44">
                    Markets preview
                  </p>
                </div>
                <div className="mt-5 grid gap-3">
                  <OddsRow event="Arsenal v Chelsea" left="1.82" draw="3.60" right="4.50" />
                  <OddsRow event="Liverpool v Spurs" left="1.66" draw="4.10" right="5.20" />
                  <OddsRow event="Man City v Newcastle" left="1.48" draw="4.60" right="6.90" />
                  <OddsRow event="West Ham v Villa" left="2.70" draw="3.35" right="2.45" />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/8 bg-[#10291e] p-5">
                <p className="font-heading text-2xl font-semibold">Signup step</p>
                <p className="mt-3 text-sm leading-7 text-white/72">
                  Before ZikBet can unlock sports betting features, it needs one age-verification
                  result from Zik.
                </p>
                <div className="mt-5 rounded-[24px] border border-[#335947] bg-[#0d2018] p-4">
                  <p className="font-medium text-white">Verify your age with ZikPass</p>
                  <p className="mt-2 text-sm leading-6 text-white/66">
                    Zik will confirm only that you are over 18. No identity information will be
                    shared with ZikBet.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      className="rounded-full bg-[#f6ffb3] px-5 py-3 text-sm font-semibold text-[#112518]"
                      onClick={accessGranted ? undefined : launchVerification}
                    >
                      {primaryCtaLabel}
                    </button>
                    <Link
                      className="rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-white"
                      href="/wallet"
                    >
                      Get Zik Pass
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/8 bg-[#10291e] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-heading text-2xl font-semibold">Access gate</p>
                  <p className="mt-2 text-sm text-white/68">
                    ZikBet updates this state after the external Zik flow returns a result.
                  </p>
                </div>
                <StatusPill tone={accessGranted ? "good" : uiState === "verification_cancelled" ? "neutral" : "warn"}>
                  {labelForUiState(uiState)}
                </StatusPill>
              </div>

              <div
                className={clsx(
                  "mt-5 rounded-[24px] border p-5 transition",
                  accessGranted
                    ? "border-[#3e8156] bg-[#173b2a]"
                    : "border-white/8 bg-[#0b1b14]"
                )}
              >
                <p className="font-heading text-3xl font-semibold">
                  {accessGranted ? "Account unlocked" : "Age verification required"}
                </p>
                <p className="mt-3 text-sm leading-7 text-white/72">
                  {accessGranted
                    ? "ZikBet received a minimal verified result from Zik and can continue signup without learning identity details."
                    : "Use the ZikPass button to open the external Zik approval flow and return a minimal over-18 confirmation."}
                </p>

                <div className="mt-5 grid gap-3">
                  <ResultLine label="Verified" value={result?.verified ? "Yes" : "No"} />
                  <ResultLine label="Over 18" value={result?.over18 ? "Yes" : "Not confirmed"} />
                  <ResultLine
                    label="Credential status"
                    value={result?.credential_status ?? "Awaiting verification"}
                  />
                  <ResultLine
                    label="Timestamp"
                    value={
                      result?.verification_timestamp
                        ? formatDateTimeLabel(result.verification_timestamp, "Time unavailable")
                        : "No result yet"
                    }
                  />
                </div>
              </div>
            </div>

            <SurfaceCard
              title="What ZikBet receives"
              subtitle="The vendor gets a minimal result only after the hosted approval flow completes."
              className="border-[#d8e5cc] bg-[#f9fbf4]"
            >
              <pre className="rounded-[22px] bg-[#10291e] p-4 text-xs text-[#edf7dc]">
                {JSON.stringify(
                  result ?? {
                    verified: false,
                    over18: false,
                    credential_status: "awaiting_result"
                  },
                  null,
                  2
                )}
              </pre>
            </SurfaceCard>

            <SurfaceCard
              title="Vendor states"
              subtitle="These investor-demo states cover successful, denied, cancelled, and missing-pass outcomes."
              className="border-[#d8e5cc] bg-[#f9fbf4]"
            >
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={uiState === "verified" ? "good" : "neutral"}>verified</StatusPill>
                <StatusPill tone={uiState === "verification_denied" ? "warn" : "neutral"}>
                  denied
                </StatusPill>
                <StatusPill tone={uiState === "verification_cancelled" ? "neutral" : "neutral"}>
                  cancelled
                </StatusPill>
                <StatusPill tone={uiState === "no_valid_pass" ? "warn" : "neutral"}>
                  no valid pass
                </StatusPill>
              </div>
            </SurfaceCard>
          </div>
        </div>
      </section>

      {modalOpen && hostedUrl ? (
        <div
          className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.12),rgba(5,10,8,0.84)_58%)] backdrop-blur-sm"
          onClick={closeModal}
        >
          <div className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6">
            <div
              className="w-full max-w-6xl overflow-hidden rounded-[34px] border border-white/12 bg-[#07110d] shadow-[0_32px_110px_rgba(4,8,6,0.5)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#0d1f17] px-6 py-4 text-white">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#d0e981]">
                    Secure external verification
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    ZikBet has opened a Zik-hosted verification flow in a modal.
                  </p>
                </div>
                <button
                  className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-0 lg:grid-cols-[0.32fr_0.68fr]">
                <div className="border-b border-white/10 bg-[#0b1812] p-6 text-white lg:border-b-0 lg:border-r">
                  <p className="font-heading text-2xl font-semibold">About this check</p>
                  <p className="mt-3 text-sm leading-7 text-white/70">
                    Zik will confirm only that the holder of the local pass is over 18. The vendor
                    will not receive name, date of birth, address, or raw credential data.
                  </p>
                  <div className="mt-6 grid gap-3">
                    <ModalInfo label="Vendor" value="ZikBet" />
                    <ModalInfo label="Request" value="Over-18 confirmation" />
                    <ModalInfo
                      label="Return method"
                      value="Secure browser message to the vendor page"
                    />
                  </div>
                </div>

                <iframe
                  className="min-h-[760px] w-full bg-[#07110d]"
                  src={hostedUrl}
                  title="Zik-hosted verification"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mapOutcomeToUiState(result: VendorVerificationResult): VendorUiState {
  if (result.outcome === "verified") {
    return "verified";
  }

  if (result.outcome === "cancelled") {
    return "verification_cancelled";
  }

  if (result.outcome === "no_pass" || result.outcome === "expired_pass" || result.outcome === "invalid_pass") {
    return "no_valid_pass";
  }

  return "verification_denied";
}

function labelForUiState(state: VendorUiState): string {
  switch (state) {
    case "idle":
      return "Not verified";
    case "verification_in_progress":
      return "Verification in progress";
    case "verified":
      return "Verified";
    case "verification_denied":
      return "Denied";
    case "verification_cancelled":
      return "Cancelled";
    case "no_valid_pass":
      return "No valid Zik Pass";
  }
}

function TopChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">{label}</span>
  );
}

function VendorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-[#0d2018] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/46">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function OddsRow({
  event,
  left,
  draw,
  right
}: {
  event: string;
  left: string;
  draw: string;
  right: string;
}) {
  return (
    <div className="grid items-center gap-3 rounded-[20px] border border-white/8 bg-[#0c1d16] p-4 sm:grid-cols-[1.3fr_repeat(3,minmax(0,0.3fr))]">
      <p className="text-sm font-medium text-white">{event}</p>
      <OddCell label="1" value={left} />
      <OddCell label="X" value={draw} />
      <OddCell label="2" value={right} />
    </div>
  );
}

function OddCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-[#173223] px-3 py-3 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#f6ffb3]">{value}</p>
    </div>
  );
}

function ResultLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-black/10 px-4 py-3 text-sm">
      <p className="text-white/56">{label}</p>
      <p className="font-medium text-white">{value}</p>
    </div>
  );
}

function ModalInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/42">{label}</p>
      <p className="mt-2 text-sm text-white">{value}</p>
    </div>
  );
}

function formatDateTimeLabel(value?: string, fallback = "Unavailable"): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}
