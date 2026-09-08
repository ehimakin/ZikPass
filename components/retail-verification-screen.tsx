"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  isRetailVerificationCodeReady,
  parseRetailVerificationCode
} from "@/lib/shared/physical-flow";
import { isPhysicalCustomerPaused } from "@/lib/shared/physical-journey";
import { getStoreById } from "@/lib/shared/stores";
import { ClerkPaymentStatus } from "@/components/clerk-payment-status";
import { Alert, Button, Card, StatusBadge } from "@/components/customer/ui";
import type { EnrollmentRecord, PhysicalStoreSessionRecord } from "@/lib/shared/types";

interface ApiError {
  error: string;
  code?: string;
}

const demoRetailVerifierToken = "demo-retail-terminal";

type RetailState = "scan" | "loading" | "ready" | "confirmed" | "rejected" | "error";

export function RetailVerificationScreen({
  initialCode = "",
  storeId
}: {
  initialCode?: string;
  storeId: string;
}) {
  const [code, setCode] = useState(parseRetailVerificationCode(initialCode));
  const [session, setSession] = useState<PhysicalStoreSessionRecord | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [state, setState] = useState<RetailState>(initialCode ? "loading" : "scan");
  const [error, setError] = useState<string | null>(null);
  const [customerPaused, setCustomerPaused] = useState(false);
  const [statusWarning, setStatusWarning] = useState<string | null>(null);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  const [hasResolvedInitialCode, setHasResolvedInitialCode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canLookup = isRetailVerificationCodeReady(code) && !isPending;

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      "x-zik-retailer-token": demoRetailVerifierToken,
      "x-zik-store-id": storeId
    }),
    [storeId]
  );

  const lookupSession = useCallback(
    (nextCode = code) => {
      const parsedCode = parseRetailVerificationCode(nextCode);

      if (!isRetailVerificationCodeReady(parsedCode)) {
        setState("error");
        setError("Enter the six-character customer code shown on their phone.");
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
              headers: headers(),
              body: JSON.stringify({ userCode: parsedCode })
            });
            const data = (await response.json()) as PhysicalStoreSessionRecord | ApiError;
            if (!response.ok) throw new Error((data as ApiError).error);
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
    },
    [code, headers]
  );

  useEffect(() => {
    if (!initialCode || hasResolvedInitialCode) return;
    setHasResolvedInitialCode(true);
    lookupSession(parseRetailVerificationCode(initialCode));
  }, [hasResolvedInitialCode, initialCode, lookupSession]);

  function submitIdCheck(decision: "confirm" | "reject") {
    const parsedCode = parseRetailVerificationCode(code);
    if (!isRetailVerificationCodeReady(parsedCode)) return;

    setCode(parsedCode);
    setError(null);
    setCustomerPaused(false);
    setStatusWarning(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/physical/sessions/verify", {
            method: "POST",
            headers: headers(),
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
          if (!response.ok) throw new Error((data as ApiError).error);
          setEnrollment(data as EnrollmentRecord);
          setState(decision === "confirm" ? "confirmed" : "rejected");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to submit the ID check.");
          setState("error");
        }
      })();
    });
  }

  useEffect(() => {
    if (state !== "scan" || !canLookup) return;
    const timer = window.setTimeout(() => lookupSession(), 250);
    return () => window.clearTimeout(timer);
  }, [canLookup, lookupSession, state]);

  useEffect(() => {
    const sessionId = enrollment?.physical_verification?.session.session_id;
    if (state !== "confirmed" || !sessionId) return;
    let cancelled = false;
    let checking = false;

    async function checkIssuanceStatus() {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch(`/api/physical/sessions/${sessionId}`, { cache: "no-store" });
        if (!response.ok) {
          const failure = await response.json().catch(() => null) as ApiError | null;
          if (!cancelled) {
            setCustomerPaused(false);
            if (response.status === 410 && failure?.code === "session_expired") {
              setError("This session expired before the pass was issued. Ask the customer to restart.");
              setState("error");
            } else {
              setStatusWarning(failure?.code === "session_not_found"
                ? "The server cannot currently find this confirmed session. Retrying the status check; do not repeat the ID check or payment."
                : "The ID check was confirmed, but the server status check failed. Retrying automatically; do not repeat the ID check or payment.");
            }
          }
          return;
        }
        if (cancelled) return;
        const nextSession = (await response.json()) as PhysicalStoreSessionRecord;
        if (cancelled) return;
        setStatusWarning(null);
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
        setCompletionNotice("Pass issued. Ready for the next customer.");
      } catch {
        if (!cancelled) setStatusWarning("Connection interrupted while checking issuance. Retrying automatically; do not repeat the ID check or payment.");
      } finally {
        checking = false;
      }
    }

    void checkIssuanceStatus();
    const timer = window.setInterval(() => void checkIssuanceStatus(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enrollment?.physical_verification?.session.session_id, state]);

  useEffect(() => {
    if (!completionNotice) return;
    const timer = window.setTimeout(() => setCompletionNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [completionNotice]);

  const boundStore = getStoreById(storeId);
  const storeMismatch =
    session && boundStore && session.store_id !== storeId;

  return (
    <div className="space-y-4">
      {completionNotice ? <Alert tone="positive">{completionNotice}</Alert> : null}

      {state === "scan" || state === "loading" || state === "error" ? (
        <Card className="p-4">
          <label
            htmlFor="clerk-code"
            className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--zk-text-faint)]"
          >
            Customer code
          </label>
          <p className="mt-1 text-[13px] text-[var(--zk-text-soft)]">
            Type the six characters on the customer&rsquo;s phone, or open their QR link.
          </p>
          <input
            id="clerk-code"
            aria-label="Customer verification code"
            className="mt-3 h-14 w-full rounded-[var(--zk-r-md)] border border-[var(--zk-line-strong)] bg-[var(--zk-card)] px-4 text-center text-[26px] font-bold uppercase tracking-[0.24em] text-[var(--zk-text)] outline-none focus:border-[var(--zk-focus)] placeholder:text-[var(--zk-text-faint)] placeholder:tracking-normal"
            disabled={state === "loading"}
            inputMode="text"
            autoCapitalize="characters"
            maxLength={16}
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
          />
          <Button
            className="mt-3 w-full"
            loading={state === "loading" || isPending}
            disabled={!canLookup}
            onClick={() => lookupSession()}
          >
            Find session
          </Button>
          {error ? (
            <div className="mt-3">
              <Alert tone="critical">{error}</Alert>
            </div>
          ) : null}
        </Card>
      ) : null}

      {session && state === "ready" ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[var(--zk-text)]">{session.store_name}</p>
            <StatusBadge tone={storeMismatch ? "critical" : "neutral"}>
              {session.entry_mode === "retail_card" ? "Retail card" : "In person"}
            </StatusBadge>
          </div>

          {storeMismatch ? (
            <div className="mt-3">
              <Alert tone="critical" title="Wrong terminal">
                This code belongs to {session.store_name}. Confirming here will be rejected -
                switch this terminal&rsquo;s store at the top.
              </Alert>
            </div>
          ) : null}

          <p className="mt-3 text-[14px] leading-snug text-[var(--zk-text-soft)]">
            Check the customer&rsquo;s photo ID in person. Confirm only if it shows they are
            at least 18. The ID is not scanned or kept.
          </p>

          {session.enrollment_id ? (
            <div className="mt-3">
              <ClerkPaymentStatus enrollmentId={session.enrollment_id} storeId={session.store_id} />
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button loading={isPending} onClick={() => submitIdCheck("confirm")}>
              Confirm 18+
            </Button>
            <Button variant="danger" disabled={isPending} onClick={() => submitIdCheck("reject")}>
              Can&rsquo;t verify
            </Button>
          </div>
        </Card>
      ) : null}

      {enrollment && state === "confirmed" ? (
        <>
          {statusWarning ? <Alert tone="caution" title="Status temporarily unavailable">{statusWarning}</Alert> : null}
          <Alert tone="positive" title="18+ confirmed">
            {customerPaused
              ? "The customer's phone looks paused. Ask them to reopen Zik Pass - the session is waiting for their device check."
              : enrollment.last_user_message ?? "The customer's phone will continue automatically."}
          </Alert>
          {session?.enrollment_id ? (
            <ClerkPaymentStatus enrollmentId={session.enrollment_id} storeId={session.store_id} />
          ) : null}
        </>
      ) : null}

      {state === "rejected" ? (
        <Alert tone="caution" title="Verification stopped">
          Nothing was charged. Ask the customer to speak with staff or start again.
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => {
                setCode("");
                setSession(null);
                setEnrollment(null);
                setState("scan");
                setError(null);
              }}
            >
              Next customer
            </Button>
          </div>
        </Alert>
      ) : null}
    </div>
  );
}
