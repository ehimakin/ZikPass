"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  isRetailVerificationCodeReady,
  parseRetailVerificationCode
} from "@/lib/shared/physical-flow";
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
              ? "Still working..."
              : "Scan customer QR";
  const body =
    state === "confirmed"
      ? "The customer phone will update automatically."
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
        if (!response.ok || cancelled) {
          return;
        }

        const nextSession = (await response.json()) as PhysicalStoreSessionRecord;
        if (nextSession.status !== "completed") {
          return;
        }

        setCode("");
        setSession(null);
        setEnrollment(null);
        setState("scan");
        setError(null);
        setCompletionNotice("Pass issued successfully. Ready for the next customer.");
      } catch {
        // Issuance status is best-effort here; the customer flow remains authoritative.
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.28),_transparent_42%),_#f4f7ee] px-4 py-5 text-ink sm:px-6 sm:py-7">
      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-5xl flex-col overflow-hidden rounded-[40px] border border-white/80 bg-white/76 px-5 py-7 shadow-panel backdrop-blur-sm sm:min-h-[calc(100vh-3.5rem)] sm:px-8">
        <div
          className={`absolute inset-x-0 top-0 h-1.5 ${hasErrorState ? "bg-[#d27a86]" : "bg-[#69b889]"}`}
        />
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-9 text-center">
          <div className="zik-stage-copy">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
            Retail verification
          </p>
          <h1 className="mt-4 font-heading text-6xl font-semibold leading-[0.9] text-ink sm:text-8xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg font-semibold text-ink/68">{body}</p>
          </div>

          <div className="zik-stage-pop grid w-full max-w-xl gap-5">
          {completionNotice ? (
            <p
              className="rounded-[24px] border border-[#69b889]/35 bg-[#eef8e8] px-5 py-4 text-base font-semibold text-ink"
              role="status"
            >
              {completionNotice}
            </p>
          ) : null}
          <input
            aria-label="Customer verification code"
            className="h-20 w-full rounded-[8px] border border-white/18 bg-white px-5 text-center font-heading text-5xl font-semibold uppercase tracking-[0.2em] text-ink outline-none"
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
              className="rounded-full bg-ink px-7 py-4 text-base font-semibold text-mist disabled:opacity-50"
              disabled={!canLookup}
              onClick={() => lookupSession()}
              type="button"
            >
              {isPending ? "Finding..." : "Find session"}
            </button>
          ) : null}

          {session && state === "ready" ? (
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-ink/8 bg-[#f7faee] px-5 py-4 text-left">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
                  {session.store_name}
                </p>
                <p className="mt-2 text-sm font-semibold text-ink/76">
                  Your attestation: I physically checked this person&apos;s ID and confirmed they are at least 18.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="rounded-full bg-ink px-7 py-4 text-base font-semibold text-mist disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => submitIdCheck("confirm")}
                  type="button"
                >
                  Confirm 18+
                </button>
                <button
                  className="rounded-full border border-ink/15 px-7 py-4 text-base font-semibold text-ink disabled:opacity-50"
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
            <div className="rounded-[24px] border border-ink/8 bg-[#f7faee] px-5 py-4 text-sm font-semibold text-ink/76">
              {enrollment.last_user_message ?? "Customer verified. Their device can now receive ZikPass."}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-[8px] bg-white px-5 py-4 text-sm font-semibold text-[#B32646]">
              {error}
            </p>
          ) : null}
          </div>
        </div>

        <div className="mx-auto h-1.5 w-full max-w-3xl overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-700 ${
              hasErrorState ? "bg-[#d27a86]" : "bg-[#69b889]"
            }`}
            style={{ width: state === "confirmed" || state === "rejected" ? "100%" : state === "ready" ? "62%" : "24%" }}
          />
        </div>
      </div>
    </main>
  );
}
