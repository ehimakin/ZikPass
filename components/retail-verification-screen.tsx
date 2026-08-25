"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  isRetailVerificationCodeReady,
  parseRetailVerificationCode
} from "@/lib/shared/physical-flow";
import { isPhysicalCustomerPaused } from "@/lib/shared/physical-journey";
import { ClerkPaymentStatus } from "@/components/clerk-payment-status";
import type { EnrollmentRecord, PhysicalStoreSessionRecord } from "@/lib/shared/types";

interface ApiError {
  error: string;
}

const demoRetailVerifierToken = "demo-retail-terminal";

type RetailState = "scan" | "loading" | "ready" | "confirmed" | "rejected" | "error";

export function RetailVerificationScreen({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(parseRetailVerificationCode(initialCode));
  const [session, setSession] = useState<PhysicalStoreSessionRecord | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [state, setState] = useState<RetailState>(initialCode ? "loading" : "scan");
  const [error, setError] = useState<string | null>(null);
  const [customerPaused, setCustomerPaused] = useState(false);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  const [hasResolvedInitialCode, setHasResolvedInitialCode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canLookup = isRetailVerificationCodeReady(code) && !isPending;
  const hasErrorState = state === "error" || state === "rejected" || Boolean(error);

  const lookupSession = useCallback((nextCode = code) => {
    const parsedCode = parseRetailVerificationCode(nextCode);

    if (!isRetailVerificationCodeReady(parsedCode)) {
      setState("error");
      setError("Enter the six-character customer code shown on the device.");
      return;
    }

    setCode(parsedCode);
    setState("loading");
    setError(null);
    setCustomerPaused(false);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/physical/sessions/lookup", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-zik-retailer-token": demoRetailVerifierToken
            },
            body: JSON.stringify({ userCode: parsedCode })
          });
          const data = (await response.json()) as PhysicalStoreSessionRecord | ApiError;

          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          setSession(data as PhysicalStoreSessionRecord);
          setEnrollment(null);
          setState("ready");
        } catch (err) {
          setSession(null);
          setEnrollment(null);
          setError(err instanceof Error ? err.message : "Unable to find that session.");
          setState("error");
        }
      })();
    });
  }, [code]);

  useEffect(() => {
    if (!initialCode || hasResolvedInitialCode) {
      return;
    }

    setHasResolvedInitialCode(true);
    lookupSession(parseRetailVerificationCode(initialCode));
  }, [hasResolvedInitialCode, initialCode, lookupSession]);

  function submitIdCheck(decision: "confirm" | "reject") {
    const parsedCode = parseRetailVerificationCode(code);

    if (!isRetailVerificationCodeReady(parsedCode)) {
      return;
    }

    setCode(parsedCode);
    setError(null);
    setCustomerPaused(false);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/physical/sessions/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-zik-retailer-token": demoRetailVerifierToken
            },
            body: JSON.stringify({
              userCode: parsedCode,
              decision,
              checkedBy: "Demo clerk",
              note:
                decision === "confirm"
                  ? "Physical ID checked in store."
                  : "Physical ID did not establish 18+."
            })
          });
          const data = (await response.json()) as EnrollmentRecord | ApiError;

          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          setEnrollment(data as EnrollmentRecord);
          setState(decision === "confirm" ? "confirmed" : "rejected");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to submit the ID check.");
          setState("error");
        }
      })();
    });
  }

  const title =
    state === "confirmed"
      ? "18+ confirmed"
      : state === "rejected"
        ? "Verification stopped"
        : state === "ready"
          ? "Check their ID"
          : state === "loading"
            ? "Loading check"
            : state === "error"
              ? "Session needs attention"
              : "Scan customer QR";
  const hasPausedState = state === "confirmed" && customerPaused;
  const accentClass = hasErrorState
    ? "bg-[#d27a86]"
    : hasPausedState
      ? "bg-[#d4a449]"
      : "bg-[#69b889]";
  const body =
    state === "confirmed"
      ? hasPausedState
        ? "The customer device appears to be paused. Ask them to reopen ZikPass after charging; this session is still waiting for device authentication."
        : "The customer phone will update automatically."
      : state === "rejected"
        ? "Ask the customer to speak with staff or restart."
        : state === "ready"
          ? "Confirm only if the physical ID shows this person is at least 18."
          : state === "loading"
            ? "Resolving the live Zik session."
            : state === "error"
              ? "Keep this screen open while you try again."
              : "Scan the code on the customer's phone, or enter the six-character code.";

  useEffect(() => {
    if (state !== "scan" || !canLookup) {
      return;
    }

    const timer = window.setTimeout(() => lookupSession(), 250);
    return () => window.clearTimeout(timer);
  }, [canLookup, lookupSession, state]);

  useEffect(() => {
    const sessionId = enrollment?.physical_verification?.session.session_id;
    if (state !== "confirmed" || !sessionId) {
      return;
    }

    let cancelled = false;

    async function checkIssuanceStatus() {
      try {
        const response = await fetch(`/api/physical/sessions/${sessionId}`);
        if (!response.ok) {
          if (!cancelled) {
            setCustomerPaused(false);
            setError("This in-store session expired before the pass was issued. Ask the customer to restart.");
            setState("error");
          }
          return;
        }

        if (cancelled) {
          return;
        }

        const nextSession = (await response.json()) as PhysicalStoreSessionRecord;
        if (nextSession.status !== "completed") {
          setCustomerPaused(
            isPhysicalCustomerPaused({ customerLastSeenAt: nextSession.customer_last_seen_at })
          );
          return;
        }

        setCustomerPaused(false);
        setCode("");
        setSession(null);
        setEnrollment(null);
        setState("scan");
        setError(null);
        setCompletionNotice("Pass issued successfully. Ready for the next customer.");
      } catch {
        if (!cancelled) {
          setCustomerPaused(true);
        }
      }
    }

    void checkIssuanceStatus();
    const timer = window.setInterval(() => {
      void checkIssuanceStatus();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enrollment?.physical_verification?.session.session_id, state]);

  useEffect(() => {
    if (!completionNotice) {
      return;
    }

    const timer = window.setTimeout(() => setCompletionNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [completionNotice]);

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a2740_0%,_#0e1726_44%,_#070b12_78%,_#04060a_100%)] px-4 py-5 text-mist sm:px-6 sm:py-7">
      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-5xl flex-col overflow-hidden rounded-[40px] border border-white/10 bg-white/[0.03] px-5 py-7 sm:min-h-[calc(100vh-3.5rem)] sm:px-8">
        <div
          className={`absolute inset-x-0 top-0 h-1.5 ${accentClass}`}
        />
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-9 text-center">
          <div className="zik-stage-copy">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-lime/70">
            Retail verification
          </p>
          <h1 className="mt-4 font-heading text-6xl font-semibold leading-[0.9] text-mist sm:text-8xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg font-semibold text-mist/55">{body}</p>
          </div>

          <div className="zik-stage-pop grid w-full max-w-xl gap-5">
          {completionNotice ? (
            <p
              className="rounded-[24px] border border-lime/25 bg-lime/[0.06] px-5 py-4 text-base font-semibold text-mist"
              role="status"
            >
              {completionNotice}
            </p>
          ) : null}
          <input
            aria-label="Customer verification code"
            className="h-20 w-full rounded-[8px] border border-white/15 bg-white/5 px-5 text-center font-heading text-5xl font-semibold uppercase tracking-[0.2em] text-mist outline-none placeholder:text-mist/25"
            disabled={state === "confirmed" || state === "rejected"}
            maxLength={256}
            placeholder="ABC123"
            value={code}
            onChange={(event) => {
              const nextCode = parseRetailVerificationCode(event.target.value);
              setCode(nextCode);
              setError(null);
              if (!isRetailVerificationCodeReady(nextCode)) {
                setState("scan");
                setSession(null);
              }
            }}
            onBlur={() => {
              if (code && !isRetailVerificationCodeReady(code)) {
                setState("error");
                setError("Enter the six-character customer code shown on the device.");
              }
            }}
          />

          {state === "scan" || state === "error" ? (
            <button
              className="rounded-full bg-lime px-7 py-4 text-base font-semibold text-ink transition hover:bg-lime/90 disabled:opacity-50"
              disabled={!canLookup}
              onClick={() => lookupSession()}
              type="button"
            >
              {isPending ? "Finding..." : "Find session"}
            </button>
          ) : null}

          {session && state === "ready" ? (
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-5 py-4 text-left">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-mist/45">
                  {session.store_name}
                </p>
                <p className="mt-2 text-sm font-semibold text-mist/75">
                  Your attestation: I physically checked this person&apos;s ID and confirmed they are at least 18.
                </p>
              </div>
              {session.enrollment_id ? (
                <ClerkPaymentStatus enrollmentId={session.enrollment_id} storeId={session.store_id} />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="rounded-full bg-lime px-7 py-4 text-base font-semibold text-ink transition hover:bg-lime/90 disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => submitIdCheck("confirm")}
                  type="button"
                >
                  Confirm 18+
                </button>
                <button
                  className="rounded-full border border-[#f8c8b4]/30 bg-[#f8c8b4]/10 px-7 py-4 text-base font-semibold text-[#f8c8b4] disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => submitIdCheck("reject")}
                  type="button"
                >
                  Unable to verify
                </button>
              </div>
            </div>
          ) : null}

          {enrollment && state === "confirmed" ? (
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-mist/75">
                {enrollment.last_user_message ?? "Customer verified. Their device can now receive ZikPass."}
              </div>
              {session?.enrollment_id ? (
                <ClerkPaymentStatus enrollmentId={session.enrollment_id} storeId={session.store_id} />
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-2xl border border-[#f8c8b4]/25 bg-[#f8c8b4]/[0.06] px-5 py-4 text-sm font-semibold text-[#f8c8b4]">
              {error}
            </p>
          ) : null}
          </div>
        </div>

        <div className="mx-auto h-1.5 w-full max-w-3xl overflow-hidden rounded-full bg-white/8">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-700 ${accentClass}`}
            style={{ width: state === "confirmed" || state === "rejected" ? "100%" : state === "ready" ? "62%" : "24%" }}
          />
        </div>
      </div>
    </main>
  );
}
